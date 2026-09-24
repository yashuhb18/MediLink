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

// POST /api/iot/transit-gps — Driver Mobile Companion / IoT GPS Telemetry Stream (Zero-Auth, High Frequency)
router.post('/transit-gps', async (req, res) => {
  try {
    const { requestId, lat, lng, progressPercent, currentSpeedKmH, temperatureC, etaMinutes, currentLocationName, liveTrackingStatus, accuracy } = req.body;
    
    // Auto-resolve requestId if not provided (pick first in-transit or accepted transfer)
    let targetRequestId = requestId;
    if (!targetRequestId) {
      const inTransit = await db.getTransferRequests({ status: 'IN_TRANSIT' });
      const activeTransfers = await db.getTransferRequests({ status: 'ACCEPTED' });
      const candidate = inTransit[0] || activeTransfers[0];
      if (candidate) targetRequestId = candidate.id;
    }

    if (!targetRequestId) {
      return res.status(404).json({ error: 'No active transfer request found to track' });
    }

    const reqObj = await db.getTransferRequest(targetRequestId);
    if (!reqObj) return res.status(404).json({ error: `Request ${targetRequestId} not found` });

    const existingGps = reqObj.transitGps || {};
    const parsedLat = (lat !== undefined && lat !== null && lat !== '') ? parseFloat(lat) : (existingGps.lat ?? null);
    const parsedLng = (lng !== undefined && lng !== null && lng !== '') ? parseFloat(lng) : (existingGps.lng ?? null);
    const hasFix = parsedLat !== null && parsedLng !== null && !isNaN(parsedLat) && !isNaN(parsedLng);

    const newGps = {
      lat: hasFix ? parsedLat : null,
      lng: hasFix ? parsedLng : null,
      isRealFix: hasFix,
      progressPercent: progressPercent !== undefined ? Math.min(100, Math.max(0, parseInt(progressPercent))) : (existingGps.progressPercent ?? 0),
      currentSpeedKmH: currentSpeedKmH !== undefined ? Math.round(parseFloat(currentSpeedKmH)) : (existingGps.currentSpeedKmH ?? 0),
      temperatureC: temperatureC !== undefined ? +(parseFloat(temperatureC)).toFixed(1) : (existingGps.temperatureC ?? 4.0),
      etaMinutes: etaMinutes !== undefined ? parseInt(etaMinutes) : (existingGps.etaMinutes ?? 35),
      currentLocationName: currentLocationName || existingGps.currentLocationName || (hasFix ? 'En-Route (Driver Phone GPS)' : 'Awaiting Driver GPS Broadcast...'),
      accuracy: (accuracy !== undefined && accuracy !== null && accuracy !== '') ? +(parseFloat(accuracy)).toFixed(1) : (existingGps.accuracy ?? null),
      updatedAt: new Date().toISOString()
    };

    const newStatus = liveTrackingStatus || (newGps.progressPercent >= 100 ? 'ARRIVED_AT_DOCK' : 'IN_TRANSIT');

    const updated = await db.updateTransferRequest(targetRequestId, {
      transitGps: newGps,
      status: 'IN_TRANSIT',
      liveTrackingStatus: newStatus
    });

    const { broadcastSSE } = require('./events.routes');
    broadcastSSE({
      type: 'TRANSIT_GPS_UPDATED',
      requestId: targetRequestId,
      transitGps: newGps,
      liveTrackingStatus: newStatus,
      transfer: updated
    });

    res.json({
      success: true,
      requestId: targetRequestId,
      transitGps: newGps,
      status: newStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/iot/transit-gps/:id — Zero-Auth Telemetry Polling Endpoint for Frontend Cards & Driver App
router.get('/transit-gps/:id', async (req, res) => {
  try {
    const transfer = await db.getTransferRequest(req.params.id);
    if (!transfer) return res.status(404).json({ error: `Transfer ${req.params.id} not found` });
    res.json({
      success: true,
      requestId: transfer.id,
      transitGps: transfer.transitGps || {},
      liveTrackingStatus: transfer.liveTrackingStatus,
      status: transfer.status,
      medicine: transfer.medicine,
      quantityKg: transfer.quantityKg,
      dosageUnit: transfer.dosageUnit,
      packageCount: transfer.packageCount,
      requestingHospitalId: transfer.requestingHospitalId,
      sourceHospitalId: transfer.sourceHospitalId,
      driverName: transfer.driverName,
      driverPhone: transfer.driverPhone,
      vehicleNumber: transfer.vehicleNumber
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/iot/active-transfers — List active consignments ready for driver tracking
router.get('/active-transfers', async (req, res) => {
  try {
    const { req: requestedId } = req.query;
    const all = await db.getTransferRequests();
    // Return all consignments that are not terminated (rejected or received)
    const active = all.filter(t => t.status !== 'REJECTED' && t.status !== 'RECEIVED');
    
    // If a specific req was queried, ensure it is placed first
    if (requestedId) {
      const specific = all.find(t => t.id === requestedId);
      if (specific && !active.some(t => t.id === requestedId)) {
        active.unshift(specific);
      }
    }

    res.json({
      success: true,
      transfers: active.length > 0 ? active : all
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/iot/qr-codes — List all registered QR codes with live count variables
router.get('/qr-codes', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const qrCodes = await db.getAllQRCodes(limit);
    res.json({
      success: true,
      count: qrCodes.length,
      qrCodes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/iot/qr-codes/:qrId — Get specific QR code details & scan history
router.get('/qr-codes/:qrId', async (req, res) => {
  try {
    const qr = await db.getQRCode(req.params.qrId);
    if (!qr) return res.status(404).json({ error: `QR Code '${req.params.qrId}' not found` });
    res.json({ success: true, qrCode: qr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/iot/qr-codes — Register a new QR code with custom initial count
router.post('/qr-codes', async (req, res) => {
  try {
    const { qrId, medicine, batch, count, initialCount, weightKg, dosageUnit, hospitalId, action, rawQrData } = req.body;
    if (!medicine && !batch && !qrId) {
      return res.status(400).json({ error: 'Medicine, batch, or qrId required' });
    }
    const created = await db.createOrUpdateQRCode({
      qrId,
      medicine: medicine || 'Paracetamol 500mg',
      batch: batch || 'BATCH-01',
      count: count !== undefined ? parseInt(count) : (initialCount !== undefined ? parseInt(initialCount) : 1),
      initialCount: initialCount !== undefined ? parseInt(initialCount) : 1,
      weightKg: parseFloat(weightKg) || 1.0,
      dosageUnit: dosageUnit || 'Strips',
      hospitalId: hospitalId || 'H01',
      action: (action || 'ADD').toUpperCase(),
      rawQrData
    });
    res.status(201).json({ success: true, qrCode: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

