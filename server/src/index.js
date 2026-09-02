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
app.use('/api/events', require('./routes/events.routes').router);

// Direct ESP32 Upload Endpoint Alias & Vision Engine
const CapturedImage = require('./models/CapturedImage');
const { decodeQRFromBuffer } = require('./modules/qr_decoder');
const { uploadToCloudinary } = require('./config/cloudinary');
const AutoScanner = require('./modules/auto_scanner');
const { broadcastSSE } = require('./routes/events.routes');

app.get('/api/upload', (req, res) => {
  res.json({
    status: "online",
    service: "MediLink ESP32-CAM Image Receiver & Optical Processor",
    timestamp: new Date().toISOString()
  });
});

app.get('/api/upload/latest', async (req, res) => {
  try {
    const images = await CapturedImage.find().sort({ createdAt: -1 }).limit(12).lean();
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', async (req, res) => {
  try {
    const { image_data, source, requestId, inventoryItemId } = req.body;
    if (!image_data) {
      return res.status(400).json({ error: "No image_data provided in payload" });
    }

    // Read custom HTTP Headers sent by ESP32-CAM
    const headerAction = req.headers['x-action'] || req.headers['action'] || req.body.action;
    const headerMedicine = req.headers['x-medicine'] || req.headers['medicine'] || req.body.medicine;
    const headerWeight = req.headers['x-quantity'] || req.headers['x-weight'] || req.body.quantityKg || req.body.weightKg;
    const headerBatch = req.headers['x-batch'] || req.headers['batch'] || req.body.batch;
    const headerHospital = req.headers['x-hospital-id'] || req.headers['hospital-id'] || req.body.hospitalId || 'H01';

    // 1. Upload to Cloudinary CDN (Fast, durable cloud asset storage)
    const cloudinaryRes = await uploadToCloudinary(image_data).catch(err => {
      console.warn('[Cloudinary] Cloud upload skipped:', err.message);
      return null;
    });

    // 2. Save Image record to MongoDB
    const newImage = new CapturedImage({
      image_data,
      imageUrl: cloudinaryRes?.url || null,
      cloudinaryPublicId: cloudinaryRes?.public_id || null,
      source: source || "ESP32-CAM",
      requestId: requestId || null,
      inventoryItemId: inventoryItemId || null
    });
    await newImage.save();
    console.log(`[ESP32-CAM] Image saved successfully to MongoDB at ${new Date().toISOString()}${cloudinaryRes?.url ? ` (Cloudinary: ${cloudinaryRes.url})` : ''}`);

    // 2. Optical QR/Barcode Auto-Decoding
    const imgBuffer = Buffer.from(image_data, 'base64');
    const qrResult = await decodeQRFromBuffer(imgBuffer);

    let scanResult = null;

    if (qrResult && qrResult.found && qrResult.payload) {
      // 🎯 DYNAMIC: Real Medicine & Batch extracted from the scanned QR code!
      console.log(`[ESP32-CAM] 🎯 Optical QR Code Detected from Image:`, qrResult.payload);
      
      // If the ESP32 OLED sent a specific action (ADD or REMOVE), use it; otherwise use the QR action
      const resolvedAction = (headerAction && headerAction !== 'AUTO') 
        ? headerAction.toUpperCase() 
        : (qrResult.payload.action || 'TRANSFER_DISPATCH');

      scanResult = await AutoScanner.processScan({
        payload: {
          ...qrResult.payload,
          action: resolvedAction,
          destHospital: qrResult.payload.destHospital || qrResult.payload.hospitalId || headerHospital || 'H01',
          sourceHospital: qrResult.payload.sourceHospital || headerHospital || 'H01'
        },
        rawImageId: newImage._id,
        imageBase64: image_data
      });
    } else if (headerAction && headerMedicine && headerMedicine !== 'QR_Scan_Pending') {
      // Fallback: If no QR in frame, use header medicine
      console.log(`[ESP32-CAM] 🏷️ Processing Action from HTTP Headers: Action=${headerAction}, Medicine=${headerMedicine}, Qty=${headerWeight || 1.0}`);
      scanResult = await AutoScanner.processScan({
        payload: {
          action: headerAction.toUpperCase(),
          medicine: headerMedicine,
          weightKg: parseFloat(headerWeight) || 1.0,
          batch: headerBatch || 'BATCH-ESP32',
          destHospital: headerHospital,
          sourceHospital: headerHospital
        },
        rawImageId: newImage._id,
        imageBase64: image_data
      });
    }

    if (scanResult) {
      newImage.medicine = scanResult.medicine || qrResult?.payload?.medicine || headerMedicine || "Paracetamol 500mg";
      newImage.batch = scanResult.batch || qrResult?.payload?.batch || headerBatch || "BATCH-2026-X902";
      newImage.action = scanResult.action || "ADD";
      newImage.weightKg = scanResult.weightKg || parseFloat(headerWeight) || 1.0;
      newImage.decodedPayload = qrResult?.payload || null;
      newImage.glmReasoning = scanResult.glmVerification?.explanation || scanResult.message;
      await newImage.save();
    }

    return res.status(200).json({
      success: true,
      message: "Image & action processed!",
      id: newImage._id,
      headerActionDetected: !!headerAction,
      qrFound: qrResult ? qrResult.found : false,
      scanResult
    });
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
