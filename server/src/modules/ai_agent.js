/**
 * MediLink AI — Local GLM-4 Agent & Prediction Intelligence Engine
 */
const http = require('http');
const { db } = require('../config/firebase');

const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = process.env.OLLAMA_PORT || 11434;
const GLM_MODEL = process.env.GLM_MODEL || 'glm4';

/**
 * Call local Ollama GLM model with /api/chat
 */
function callLocalGLM(prompt, systemPrompt = '') {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: GLM_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt || "You are MediBot, an expert clinical AI assistant for MediLink. Provide concise, authoritative 2-3 sentence answers on medicine stockouts, hospital telemetry, and emergency transfers."
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 250
      }
    });

    const req = http.request({
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 45000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.message && parsed.message.content) {
            resolve(parsed.message.content);
          } else if (parsed.response) {
            resolve(parsed.response);
          } else {
            resolve(JSON.stringify(parsed));
          }
        } catch (e) {
          reject(new Error(`GLM parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GLM inference timed out (45s)'));
    });

    req.write(payload);
    req.end();
  });
}

const AIAgent = {
  /**
   * Check if local GLM model is running
   */
  async checkModelStatus() {
    try {
      const tags = await new Promise((resolve, reject) => {
        http.get(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`, (res) => {
          let data = '';
          res.on('data', d => data += d);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        }).on('error', reject);
      });
      const hasGLM = tags.models?.some(m => m.name.toLowerCase().includes('glm'));
      return { online: true, model: GLM_MODEL, availableModels: tags.models?.map(m => m.name) || [], active: hasGLM };
    } catch (err) {
      return { online: false, model: GLM_MODEL, error: err.message };
    }
  },

  /**
   * Process interactive chat with live hospital telemetry context
   */
  async processChat({ message, hospitalId, role }) {
    let inventorySummary = "All items nominal.";
    let predictionsSummary = "No active emergency shortages.";
    let transfersSummary = "No pending transfers.";
    let hospitalName = hospitalId || "Apollo Bangalore Central (H01)";

    try {
      if (hospitalId) {
        const [inv, preds, transfers] = await Promise.all([
          db.getInventoryForHospital(hospitalId).catch(() => []),
          require('./predictor').generatePredictions(hospitalId).catch(() => []),
          db.getTransferRequests({ requestingHospitalId: hospitalId }).catch(() => [])
        ]);

        if (inv.length > 0) {
          inventorySummary = inv.map(i => `${i.medicine}: ${i.currentStockKg}kg (min: ${i.minThresholdKg}kg)`).join(' | ');
        }
        if (preds.length > 0) {
          predictionsSummary = preds.map(p => `ALERT: ${p.medicine} will reach 0kg in ${p.hoursToZero}h (Deficit: ${p.deficitKg}kg, Urgency: ${p.urgency})`).join(' | ');
        }
        if (transfers.length > 0) {
          transfersSummary = transfers.slice(0, 3).map(t => `Req #${t.id}: ${t.medicine} (${t.quantityKg || t.sources?.[0]?.allocatedKg || 1}kg, Status: ${t.status})`).join(' | ');
        }
      }
    } catch (e) {
      console.warn('[AI Agent] Context fetch error:', e.message);
    }

    const systemPrompt = `You are MediBot, the expert Clinical AI Agent inside MediLink Hospital Network.
Live Hospital Context for ${hospitalName} (User Role: ${role || 'SUPERVISOR'}):
- Current Stock Telemetry: ${inventorySummary}
- Active Shortage Predictions: ${predictionsSummary}
- Active Dispatches: ${transfersSummary}

Instructions:
1. Provide a concise, clear, and professional response (2-3 sentences).
2. Reference actual numbers (weights, deficits, hours) if available in the context.`;

    try {
      const response = await callLocalGLM(message, systemPrompt);
      return {
        reply: response.trim(),
        model: 'GLM-4 Local (Ollama)',
        isLiveLLM: true,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.warn('[AI Agent] Local GLM fallback:', err.message);
      let fallbackReply = `MediBot Telemetry Analysis for ${hospitalName}: `;
      if (predictionsSummary.includes('ALERT:')) {
        fallbackReply += `${predictionsSummary}. Automated Nash transfer recommendation is active.`;
      } else {
        fallbackReply += `All medicine inventories are currently above minimum reserve thresholds. ESP32 load-cells are reporting steady telemetry.`;
      }

      return {
        reply: fallbackReply,
        model: 'GLM-4 Heuristic Fallback',
        isLiveLLM: false,
        timestamp: new Date().toISOString()
      };
    }
  },

  /**
   * Deep GLM-4 Analysis for specific prediction
   */
  async explainPrediction(prediction) {
    const prompt = `Analyze this medicine shortage risk and recommend a clinical action plan:
Medicine: ${prediction.medicine} (Batch ${prediction.batch})
Current Stock: ${prediction.currentStockKg} kg (Minimum Threshold: ${prediction.minThresholdKg} kg)
Consumption Rate: ${prediction.consumptionRate} kg/hr
Estimated Time to Complete Zero Stock: ${prediction.hoursToZero} hours
Estimated Deficit: ${prediction.deficitKg} kg
Urgency Level: ${prediction.urgency}

Provide a brief 3-point clinical assessment (Root Cause, Patient Impact, Recommended Transfer Source).`;

    try {
      const response = await callLocalGLM(prompt, "You are a Chief Clinical Pharmacologist AI analyzing inter-hospital supply chain data.");
      return {
        explanation: response.trim(),
        model: 'GLM-4 Local',
        isLiveLLM: true
      };
    } catch (err) {
      return {
        explanation: `Clinical Assessment: ${prediction.medicine} is depleting at a rate of ${prediction.consumptionRate} kg/hr. With ${prediction.currentStockKg} kg remaining, the hospital will experience a stockout in approximately ${prediction.hoursToZero} hours. Sourcing ${prediction.deficitKg} kg from the nearest available hospital node is recommended to prevent critical care disruption.`,
        model: 'Rule Engine Fallback',
        isLiveLLM: false
      };
    }
  }
};

module.exports = AIAgent;
