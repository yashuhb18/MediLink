/**
 * MediLink AI — Real-Time Server-Sent Events (SSE) Stream & Notification Hub
 */
const router = require('express').Router();

let clients = [];
let notificationHistory = [];

/**
 * Broadcast event to all connected browser portals and retain in history
 */
function broadcastSSE(data) {
  const enhancedData = {
    ...data,
    id: data.id || `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: data.timestamp || new Date().toISOString()
  };

  notificationHistory.unshift(enhancedData);
  if (notificationHistory.length > 50) notificationHistory.pop();

  const payload = `data: ${JSON.stringify(enhancedData)}\n\n`;
  clients.forEach(client => {
    try {
      client.res.write(payload);
    } catch (err) {
      console.warn('[SSE] Client write error:', err.message);
    }
  });
}

const sseHandler = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const clientId = Date.now() + Math.random().toString(36).substring(2, 9);
  const newClient = { id: clientId, res };
  clients.push(newClient);

  // Send initial connection handshake with recent notifications
  res.write(`data: ${JSON.stringify({
    type: 'CONNECTED',
    clientId,
    message: 'Connected to MediLink Real-time Telemetry & Notification Stream',
    recentNotifications: notificationHistory.slice(0, 10)
  })}\n\n`);

  // Heartbeat ping every 15 seconds
  const pingInterval = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'PING', timestamp: Date.now() })}\n\n`);
    } catch (e) {
      clearInterval(pingInterval);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    clients = clients.filter(c => c.id !== clientId);
  });
};

// Handle both /api/events and /api/events/stream
router.get('/', sseHandler);
router.get('/stream', sseHandler);

// GET /api/events/recent - Fetch recent alerts
router.get('/recent', (req, res) => {
  res.json(notificationHistory);
});

module.exports = { router, broadcastSSE };
