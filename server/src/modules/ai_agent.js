/**
 * MediLink AI — Multi-Engine Clinical AI & Prediction Intelligence System
 *
 * Supported Engines:
 * 1. Groq Cloud API (Llama 3.3 70B / 8B - ultra-fast 300ms inference) via GROQ_API_KEY
 * 2. Google Gemini API (Gemini 1.5 Flash) via GEMINI_API_KEY / GOOGLE_API_KEY
 * 3. Local Ollama GLM-4 (127.0.0.1:11434)
 * 4. High-Availability Cloud Generative AI (Zero-config free LLM engine)
 * 5. Dynamic Contextual Clinical Intelligence Synthesizer
 */
const http = require('http');
const { db } = require('../config/firebase');

const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = parseInt(process.env.OLLAMA_PORT || '11434', 10);
const GLM_MODEL = process.env.GLM_MODEL || 'glm4';

/**
 * Fast ping to check if local Ollama daemon is running
 */
function checkOllamaAlive(host = OLLAMA_HOST, port = OLLAMA_PORT, timeoutMs = 700) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: host, port: port, path: '/api/tags', timeout: timeoutMs }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/**
 * Call Local Ollama GLM-4 model
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
      keep_alive: "30m",
      options: {
        temperature: 0.25,
        num_predict: 120,
        top_p: 0.9
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
      timeout: 35000 // 35s timeout for local 9.4B model
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
      reject(new Error('GLM inference timed out'));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Call Groq Cloud API (Llama 3.3 70B / 8B)
 */
async function callGroqAPI(prompt, systemPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 300
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error('Empty response from Groq');
    return { reply: reply.trim(), model: `Groq (${model})` };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Call Google Gemini API (Gemini 1.5 Flash)
 */
async function callGeminiAPI(prompt, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 300
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error('Empty response from Gemini');
    return { reply: reply.trim(), model: 'Gemini 1.5 Flash' };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * High-Availability Cloud Generative AI Engine (Zero-key fallback)
 */
async function callCloudGenerativeAI(prompt, systemPrompt) {
  const encPrompt = encodeURIComponent(prompt);
  const encSystem = encodeURIComponent(systemPrompt || 'You are MediBot, clinical AI assistant for MediLink.');

  // Try openai-fast first, then default
  const endpoints = [
    `https://text.pollinations.ai/${encPrompt}?system=${encSystem}&model=openai-fast`,
    `https://text.pollinations.ai/${encPrompt}?system=${encSystem}`
  ];

  for (const url of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 MediLink/2.0'
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 5 && !text.includes('<!DOCTYPE html>') && !text.includes('Queue full') && !text.includes('502 Bad Gateway')) {
          return { reply: text.trim(), model: 'MediBot Cloud LLM' };
        }
      }
    } catch (e) {
      clearTimeout(timer);
    }
  }

  throw new Error('Cloud Generative AI unavailable');
}

/**
 * Dynamic Clinical Intelligence Synthesizer (Generates specific, contextual clinical reasoning)
 */
function generateClinicalReasoning(prompt, context = {}) {
  const { hospitalName = "Apollo Bangalore Central (H01)", inventory = [], predictions = [], transfers = [] } = context;
  const lowerPrompt = (prompt || '').toLowerCase();

  // 1. Greetings / Introduction
  if (lowerPrompt.includes('hi') || lowerPrompt.includes('hello') || lowerPrompt.includes('hey') || lowerPrompt.includes('who are you') || lowerPrompt.includes('what can you do')) {
    return `Hello! I am MediBot, the AI Clinical Intelligence Assistant for MediLink. I monitor real-time medicine load-cells across all 3 hospital nodes (${hospitalName}, Manipal Hospital Whitefield H02, and Mangalore General Hospital H03), predict stockout risks before they happen, and automate donor sourcing via Nash game-theoretic equilibrium. How can I assist you today?`;
  }

  // 2. Specific Medicine Query
  const matchedItem = inventory.find(i => lowerPrompt.includes((i.medicine || '').toLowerCase()));
  if (matchedItem) {
    const isCritical = matchedItem.currentStockKg <= (matchedItem.minThresholdKg || 1.0);
    const predMatch = predictions.find(p => p.medicine?.toLowerCase() === matchedItem.medicine?.toLowerCase());
    let stockMsg = `${matchedItem.medicine} at ${hospitalName} is currently at ${matchedItem.currentStockKg}kg (minimum reserve: ${matchedItem.minThresholdKg || 1.0}kg). `;
    if (isCritical) {
      stockMsg += `🚨 ALERT: Stock is at or below critical reserve threshold! `;
      if (predMatch) {
        stockMsg += `Projected burn rate of ${predMatch.consumptionRate} kg/hr indicates zero-stockout in ${predMatch.hoursToZero} hours. Automated donor sourcing from regional partner nodes is strongly advised.`;
      } else {
        stockMsg += `Immediate restocking or inter-hospital transfer dispatch is recommended to prevent clinical interruption.`;
      }
    } else {
      stockMsg += `Inventory is within safe operating margins. Load-cell telemetry is nominal and batch ${matchedItem.batch || 'verified'} is active.`;
    }
    return stockMsg;
  }

  // 3. Stockout / Prediction / Burn Rate
  if (lowerPrompt.includes('predict') || lowerPrompt.includes('shortage') || lowerPrompt.includes('stockout') || lowerPrompt.includes('risk') || lowerPrompt.includes('burn rate')) {
    if (predictions.length > 0) {
      const topPreds = predictions.slice(0, 2).map(p => `${p.medicine} (Deficit: ${p.deficitKg}kg, ${p.hoursToZero}h to stockout at ${p.consumptionRate} kg/hr, Urgency: ${p.urgency})`).join('; ');
      return `Clinical Shortage Forecast for ${hospitalName}: Critical risk detected for ${topPreds}. Proactive transfer requests have been calculated via regional node donors to avert care disruption.`;
    }
    return `Telemetry Analysis for ${hospitalName}: All monitored medicine inventories are currently sustaining safe reserves. No emergency stockout events projected in the next 12 hours. Continuous load-cell surveillance is active.`;
  }

  // 4. Transfers / Nash Equilibrium / Karma
  if (lowerPrompt.includes('transfer') || lowerPrompt.includes('nash') || lowerPrompt.includes('karma') || lowerPrompt.includes('donor') || lowerPrompt.includes('dispatch')) {
    return `MediLink utilizes a Nash Game-Theoretic Equilibrium to optimize inter-hospital medicine sharing. When a node incurs a deficit, donor hospitals (such as H02 or H03) with surplus stock are ranked by transit distance and burn-rate safety margin. Successful verified dispatches award +5 Karma points to donor nodes, ensuring balanced reciprocity and zero patient care disruption.`;
  }

  // 5. Hospital Nodes (H01, H02, H03)
  if (lowerPrompt.includes('node') || lowerPrompt.includes('h01') || lowerPrompt.includes('h02') || lowerPrompt.includes('h03') || lowerPrompt.includes('hospital')) {
    return `MediLink connects 3 primary clinical nodes: Node 1 (Apollo Bangalore Central - H01), Node 2 (Manipal Hospital Whitefield - H02), and Node 3 (Mangalore General Hospital - H03). Each node features dual-optical QR scanning, live load-cell weight sensors, and automated transit tracking with RFID verification.`;
  }

  // 6. General / Fallback
  if (predictions.length > 0) {
    const alertList = predictions.map(p => `${p.medicine} (${p.hoursToZero}h remaining)`).join(', ');
    return `Clinical Advisory for ${hospitalName}: Active stockout alerts present for ${alertList}. Automated Nash transfer sourcing is available to request supply from regional partner hospitals.`;
  }

  return `MediLink Clinical Analysis for ${hospitalName}: Medicine inventories, ESP32 load-cell weights, and optical scan logs are operating within nominal clinical standards. Use the quick action prompts or ask about specific medicines, shortages, or transfer logistics for deeper intelligence.`;
}

/**
 * Unified Multi-Engine AI Dispatcher
 */
async function generateUnifiedAIResponse(prompt, systemPrompt, context = {}) {
  // Tier 1: Groq Cloud API (if key configured)
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await callGroqAPI(prompt, systemPrompt);
      return { reply: res.reply, model: res.model, isLiveLLM: true };
    } catch (e) {
      console.warn('[AI Agent] Groq attempt failed:', e.message);
    }
  }

  // Tier 2: Google Gemini API (if key configured)
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    try {
      const res = await callGeminiAPI(prompt, systemPrompt);
      return { reply: res.reply, model: res.model, isLiveLLM: true };
    } catch (e) {
      console.warn('[AI Agent] Gemini attempt failed:', e.message);
    }
  }

  // Tier 3: Local Ollama GLM-4 (if running locally)
  try {
    const isAlive = await checkOllamaAlive();
    if (isAlive) {
      const reply = await callLocalGLM(prompt, systemPrompt);
      return { reply: reply.trim(), model: 'GLM-4 Local (Ollama)', isLiveLLM: true };
    }
  } catch (e) {
    console.warn('[AI Agent] Local Ollama attempt failed:', e.message);
  }

  // Tier 4: High-Availability Cloud Generative AI
  try {
    const res = await callCloudGenerativeAI(prompt, systemPrompt);
    return { reply: res.reply, model: res.model, isLiveLLM: true };
  } catch (e) {
    console.warn('[AI Agent] Cloud Generative AI attempt failed:', e.message);
  }

  // Tier 5: Context-Aware Dynamic Clinical Intelligence Synthesizer
  const syntheticReply = generateClinicalReasoning(prompt, context);
  return {
    reply: syntheticReply,
    model: 'MediLink Clinical Intelligence Engine',
    isLiveLLM: false
  };
}

const AIAgent = {
  /**
   * Check status of AI models and active inference engines
   */
  async checkModelStatus() {
    // Check Local Ollama
    try {
      const isOllamaUp = await checkOllamaAlive();
      if (isOllamaUp) {
        return { online: true, mode: 'ollama', model: 'GLM-4 Local (Ollama)', active: true };
      }
    } catch (e) {}

    // Check Groq
    if (process.env.GROQ_API_KEY) {
      const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
      return { online: true, mode: 'groq', model: `Groq (${model})`, active: true };
    }

    // Check Gemini
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      return { online: true, mode: 'gemini', model: 'Gemini 1.5 Flash (Google Cloud)', active: true };
    }

    // Cloud Engine Mode
    return { online: true, mode: 'cloud_engine', model: 'MediBot Clinical AI Engine', active: true };
  },

  /**
   * Process interactive chat with live hospital telemetry context
   */
  async processChat({ message, hospitalId, role }) {
    let inventorySummary = "All items nominal.";
    let predictionsSummary = "No active emergency shortages.";
    let transfersSummary = "No pending transfers.";
    let hospitalName = hospitalId || "Apollo Bangalore Central (H01)";
    let rawInv = [];
    let rawPreds = [];
    let rawTransfers = [];

    try {
      if (hospitalId) {
        const [inv, preds, transfers] = await Promise.all([
          db.getInventoryForHospital(hospitalId).catch(() => []),
          require('./predictor').generatePredictions(hospitalId).catch(() => []),
          db.getTransferRequests({ requestingHospitalId: hospitalId }).catch(() => [])
        ]);

        rawInv = inv || [];
        rawPreds = preds || [];
        rawTransfers = transfers || [];

        if (rawInv.length > 0) {
          inventorySummary = rawInv.map(i => `${i.medicine}: ${i.currentStockKg}kg (min: ${i.minThresholdKg || 1}kg)`).join(' | ');
        }
        if (rawPreds.length > 0) {
          predictionsSummary = rawPreds.map(p => `ALERT: ${p.medicine} will reach 0kg in ${p.hoursToZero}h (Deficit: ${p.deficitKg}kg, Urgency: ${p.urgency})`).join(' | ');
        }
        if (rawTransfers.length > 0) {
          transfersSummary = rawTransfers.slice(0, 3).map(t => `Req #${t.id}: ${t.medicine} (${t.quantityKg || t.sources?.[0]?.allocatedKg || 1}kg, Status: ${t.status})`).join(' | ');
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
2. Reference actual numbers (weights, deficits, hours) if available in the context.
3. If the user asks a medical or logistics question, answer with clinical precision.`;

    const result = await generateUnifiedAIResponse(message, systemPrompt, {
      hospitalName,
      inventory: rawInv,
      predictions: rawPreds,
      transfers: rawTransfers
    });

    return {
      reply: result.reply,
      model: result.model,
      isLiveLLM: result.isLiveLLM,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Deep clinical analysis for specific prediction
   */
  async explainPrediction(prediction) {
    const prompt = `Provide a concise 2-sentence clinical assessment for this shortage:
Medicine: ${prediction.medicine} (Batch ${prediction.batch})
Current Stock: ${prediction.currentStockKg}kg vs Min: ${prediction.minThresholdKg}kg
Rate: ${prediction.consumptionRate} kg/hr | Hours Left: ${prediction.hoursToZero}h | Deficit: ${prediction.deficitKg}kg | Urgency: ${prediction.urgency}
State the shortage cause and recommended inter-hospital sourcing action.`;

    const systemPrompt = "You are a Chief Clinical Pharmacologist AI for MediLink Hospital Network. Answer in 2 authoritative, clinical sentences.";

    try {
      const result = await generateUnifiedAIResponse(prompt, systemPrompt, {
        predictions: [prediction]
      });
      return {
        explanation: result.reply,
        model: result.model,
        isLiveLLM: result.isLiveLLM
      };
    } catch (err) {
      return {
        explanation: `Clinical Assessment: ${prediction.medicine} is consuming at ${prediction.consumptionRate} kg/hr with only ${prediction.currentStockKg} kg left (${prediction.hoursToZero}h to stockout). Recommended action: initiate emergency Nash transfer for ${prediction.deficitKg} kg from nearest regional hospital.`,
        model: 'Rule Engine Fallback',
        isLiveLLM: false
      };
    }
  }
};

module.exports = AIAgent;
