/**
 * MediLink AI — Real-Time Server-Sent Events (SSE) Stream
 */
const router = require('express').Router();

let clients = [];

/**
 * Broadcast event to all connected browser portals
 */
function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try {
      client.res.write(payload);
    } catch (err) {
      console.warn('[SSE] Client write error:', err.message);
    }
  });
}

// GET /api/events/stream - SSE connection endpoint for browser
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const clientId = Date.now() + Math.random().toString(36).substring(2, 9);
  const newClient = { id: clientId, res };
  clients.push(newClient);

  // Send initial connection handshake
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId, message: 'Connected to MediLink Real-time Telemetry Stream' })}\n\n`);

  // Heartbeat ping every 20 seconds
  const pingInterval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'PING', timestamp: Date.now() })}\n\n`);
  }, 20000);

  req.on('close', () => {
    clearInterval(pingInterval);
    clients = clients.filter(c => c.id !== clientId);
  });
});

module.exports = { router, broadcastSSE };
