/**
 * MediLink AI — Express Server Entry Point
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/hospitals', require('./routes/hospital.routes'));
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/transfers', require('./routes/transfer.routes'));
app.use('/api/karma', require('./routes/karma.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/iot', require('./routes/iot.routes'));
app.use('/api/ai', require('./routes/ai.routes'));

// Direct ESP32 Upload Endpoint Alias
const CapturedImage = require('./models/CapturedImage');
app.get('/api/upload', (req, res) => {
  res.json({
    status: "online",
    message: "MediLink ESP32-CAM Upload Endpoint Active!",
    expectedMethod: "POST",
    expectedPayload: { image_data: "<BASE64_STRING>", source: "ESP32-CAM" },
    timestamp: new Date().toISOString()
  });
});
app.post('/api/upload', async (req, res) => {
  try {
    const { image_data, source, requestId, inventoryItemId } = req.body;
    if (!image_data) {
      return res.status(400).json({ error: "No image_data provided in payload" });
    }
    const newImage = new CapturedImage({
      image_data,
      source: source || "ESP32-CAM",
      requestId: requestId || null,
      inventoryItemId: inventoryItemId || null
    });
    await newImage.save();
    console.log(`[ESP32-CAM] Image saved successfully to MongoDB at ${new Date().toISOString()}`);
    return res.status(200).json({ success: true, message: "Image saved to MongoDB!", id: newImage._id });
  } catch (error) {
    console.error("[ESP32-CAM] Upload error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', mode: process.env.DB_MODE, timestamp: new Date().toISOString() }));

const { connectMongoDB } = require('./config/mongodb');

app.listen(PORT, async () => {
  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║  MediLink AI — Express API Server        ║`);
  console.log(`  ║  Port: ${PORT}                              ║`);
  console.log(`  ║  DB Mode: ${(process.env.DB_MODE || 'memory').padEnd(30)}║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
  
  if (process.env.DB_MODE === 'mongodb' || process.env.MONGODB_URI) {
    try {
      await connectMongoDB();
    } catch (err) {
      console.warn('[MongoDB Atlas Warning]', err.message);
    }
  }
});

module.exports = app;
