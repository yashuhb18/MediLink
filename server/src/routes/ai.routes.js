const router = require('express').Router();
const AIAgent = require('../modules/ai_agent');

// GET /api/ai/status - Check local GLM model status
router.get('/status', async (req, res) => {
  try {
    const status = await AIAgent.checkModelStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/chat - Interactive AI Chat with live clinical context
router.post('/chat', async (req, res) => {
  try {
    const { message, hospitalId, role } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const result = await AIAgent.processChat({ message, hospitalId, role });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/explain - Deep LLM prediction explanation
router.post('/explain', async (req, res) => {
  try {
    const { prediction } = req.body;
    if (!prediction) {
      return res.status(400).json({ error: "Prediction object is required" });
    }
    const result = await AIAgent.explainPrediction(prediction);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
