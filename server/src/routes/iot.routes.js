/**
 * MediLink AI — IoT Hardware REST API Routes
 * Endpoints for physical ESP32 / ESP8266 microcontrollers with HX711 load cell and RC522 RFID reader.
 */
const router = require('express').Router();
const { db } = require('../config/firebase');
const Verifier = require('../modules/verifier');
const KarmaMarket = require('../modules/karma');

// POST /api/iot/weight — ESP32 posts real-time load cell scale weight
router.post('/weight', async (req, res) => {
  try {
    const { inventoryItemId, weightKg, apiKey } = req.body;
    if (!inventoryItemId || weightKg === undefined) {
      return res.status(400).json({ error: 'inventoryItemId and weightKg are required' });
    }

    const numericWeight = parseFloat(weightKg);
    const updated = await db.updateInventoryItem(inventoryItemId, { currentStockKg: numericWeight });
    
    // Log telemetry event
    await db.addAuditLog('IOT_WEIGHT_TELEMETRY', `LoadCell update for ${inventoryItemId}: ${numericWeight} kg`, updated?.hospitalId || 'H01');

    res.json({ success: true, item: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/iot/verify-tap — ESP32 posts RFID UID tap + measured scale weight
router.post('/verify-tap', async (req, res) => {
  try {
    const { requestId, scannedRfidUid, measuredWeightKg } = req.body;
    if (!requestId || !scannedRfidUid) {
      return res.status(400).json({ error: 'requestId and scannedRfidUid required' });
    }

    const reqObj = await db.getTransferRequest(requestId);
    if (!reqObj) return res.status(404).json({ error: 'Request not found' });

    const result = Verifier.dualLockCheck(
      scannedRfidUid,
      reqObj.targetRfidUid || 'A101-B',
      parseFloat(measuredWeightKg || reqObj.quantityKg),
      reqObj.quantityKg
    );

    await db.updateTransferRequest(requestId, {
      rfidVerified: result.rfidOk,
      weightVerified: result.weightOk,
      rfidUidScanned: scannedRfidUid
    });

    if (!result.rfidOk) {
      await KarmaMarket.applyRule(reqObj.sourceHospitalId, 'WRONG_MEDICINE');
    }

    await db.addAuditLog('IOT_RFID_TAP', `RFID ${scannedRfidUid} tapped for ${requestId}. Result: ${result.overallPass ? 'PASS' : 'FAIL'}`, reqObj.sourceHospitalId);

    res.json({
      success: true,
      requestId,
      verificationResult: result,
      trafficLightState: result.overallPass ? 'pass' : 'fail'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/iot/images — Fetch recent ESP32-CAM captured images
router.get('/images', async (req, res) => {
  try {
    const CapturedImage = require('../models/CapturedImage');
    const images = await CapturedImage.find().sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/iot/execute-action — 1-click execution for Add, Remove, Restock, Dispense
router.post('/execute-action', async (req, res) => {
  try {
    const { action, medicine, weightKg, batch, hospitalId, imageId } = req.body;
    const AutoScanner = require('../modules/auto_scanner');
    const result = await AutoScanner.processScan({
      payload: {
        action: (action || 'ADD').toUpperCase(),
        medicine: medicine || 'Paracetamol 500mg',
        weightKg: parseFloat(weightKg) || 1.0,
        batch: batch || 'BATCH-01',
        destHospital: hospitalId || 'H01',
        sourceHospital: hospitalId || 'H01'
      },
      rawImageId: imageId || null
    });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
