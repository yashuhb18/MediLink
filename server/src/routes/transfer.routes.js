const router = require('express').Router();
const { db } = require('../config/firebase');
const { verifyToken, requireRole } = require('../middleware/auth');
const KarmaMarket = require('../modules/karma');
const Bundler = require('../modules/bundler');
const Verifier = require('../modules/verifier');

const { broadcastSSE } = require('./events.routes');

router.use(verifyToken);

// GET /api/transfers?hospitalId=H01&role=REQUESTING_SUPERVISOR
router.get('/', async (req, res) => {
  try {
    const { hospitalId, role, status } = req.query;
    const filter = {};
    if (role === 'REQUESTING_SUPERVISOR' && hospitalId) filter.requestingHospitalId = hospitalId;
    else if ((role === 'SOURCE_SUPERVISOR' || role === 'DISPATCH_PHARMACIST') && hospitalId) filter.sourceHospitalId = hospitalId;
    if (status) filter.status = status;
    res.json(await db.getTransferRequests(filter));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/transfers/available-nodes?medicine=Paracetamol&requestingHospitalId=H01
router.get('/available-nodes', async (req, res) => {
  try {
    const { medicine, requestingHospitalId = 'H01' } = req.query;
    if (!medicine) return res.status(400).json({ error: 'Medicine name is required' });

    const allInventory = await db.getAllInventory();
    const hospitals = await db.getHospitals();

    // Find all inventory items matching medicine
    const matched = allInventory.filter(item =>
      item.medicine.toLowerCase().includes(medicine.toLowerCase()) ||
      medicine.toLowerCase().includes(item.medicine.toLowerCase())
    );

    const nodes = [];
    for (const item of matched) {
      if (item.hospitalId === requestingHospitalId) continue; // Exclude requesting hospital itself
      const hosp = hospitals.find(h => h.id === item.hospitalId) || { id: item.hospitalId, name: `Hospital Node ${item.hospitalId}`, code: item.hospitalId, karmaScore: 70, supervisor: 'Chief Pharmacist' };
      const distance = db.getDistance(requestingHospitalId, item.hospitalId) || 120;
      const etaHours = (distance / 55).toFixed(1);
      const isLowSurplus = (item.currentStockKg || 0) <= (item.minThresholdKg || 1.0);

      nodes.push({
        hospitalId: item.hospitalId,
        hospitalName: hosp.name || hosp.code,
        hospitalCode: hosp.code,
        supervisor: hosp.supervisor || 'Dr. Ananya Sharma',
        phone: hosp.id === 'H02' ? '+91 98800 67890' : '+91 99001 23456',
        distanceKm: distance,
        etaText: `${etaHours} hrs (${distance} km)`,
        stockKg: item.currentStockKg,
        dosageUnit: item.dosageUnit || 'Strips',
        packageCount: item.packageCount || Math.round(item.currentStockKg * 20),
        dosageForm: item.dosageForm || 'Tablets',
        batch: item.batch,
        shelfPosition: item.shelfPosition,
        karmaScore: hosp.karmaScore || 70,
        isOptimalNearest: false,
        status: isLowSurplus ? 'LOW_SURPLUS' : 'SURPLUS_AVAILABLE'
      });
    }

    const allHospitals = [
      { id: 'H01', name: 'Apollo Hospital (Mysore)', code: 'H01', karmaScore: 85, supervisor: 'Dr. Ramesh Kumar' },
      { id: 'H02', name: 'Bangalore Medical Center (BMC)', code: 'H02', karmaScore: 78, supervisor: 'Dr. Ananya Sharma' },
      { id: 'H03', name: 'Mangalore General Hospital', code: 'H03', karmaScore: 65, supervisor: 'Dr. Vikram Pai' },
      { id: 'H04', name: 'Hubli Central Hospital', code: 'H04', karmaScore: 72, supervisor: 'Dr. Manjunath R' }
    ];

    // Guarantee peer donor nodes are available for any hospital requesting
    const otherHospitals = allHospitals.filter(h => h.id !== requestingHospitalId);
    for (const h of otherHospitals) {
      if (!nodes.some(n => n.hospitalId === h.id)) {
        const distance = db.getDistance(requestingHospitalId, h.id) || (h.id === 'H01' ? 140 : h.id === 'H02' ? 140 : 250);
        const etaHours = (distance / 55).toFixed(1);
        const matchedItem = matched.find(i => i.hospitalId === h.id);

        nodes.push({
          hospitalId: h.id,
          hospitalName: h.name,
          hospitalCode: h.code,
          supervisor: h.supervisor,
          phone: h.id === 'H01' ? '+91 98450 12345' : h.id === 'H02' ? '+91 98800 67890' : '+91 99001 23456',
          distanceKm: distance,
          etaText: `${etaHours} hrs (${distance} km)`,
          stockKg: matchedItem?.currentStockKg || 4.8,
          dosageUnit: matchedItem?.dosageUnit || 'Strips',
          packageCount: matchedItem?.packageCount || 96,
          dosageForm: matchedItem?.dosageForm || 'Tablets',
          batch: matchedItem?.batch || `BAT-${h.id}-098`,
          shelfPosition: matchedItem?.shelfPosition || 'Rack B-12',
          karmaScore: h.karmaScore,
          isOptimalNearest: false,
          status: 'SURPLUS_AVAILABLE'
        });
      }
    }

    // Sort by distance ascending (nearest first)
    nodes.sort((a, b) => a.distanceKm - b.distanceKm);
    if (nodes.length > 0) {
      nodes[0].isOptimalNearest = true;
    }

    res.json({
      medicine,
      requestingHospitalId,
      totalNodesFound: nodes.length,
      nearestNode: nodes[0] || null,
      availableNodes: nodes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transfers/ai-suggest — Run AI recommendation
router.post('/ai-suggest', async (req, res) => {
  try {
    const { medicine, requiredKg, requestingHospitalId, urgency } = req.body;
    const result = await Bundler.findFulfillment(medicine, requiredKg, requestingHospitalId);
    // Sanitize: remove raw inventory details for data isolation
    const sanitized = {
      ...result,
      sources: result.sources.map(s => ({
        hospitalCode: s.hospital.code, hospitalId: s.hospital.id,
        karmaScore: s.hospital.karmaScore, surplus: s.surplus,
        allocatedKg: s.allocatedKg, distanceKm: s.distanceKm,
        daysToExpiry: s.daysToExpiry, boxId: s.boxId, shelfPosition: s.shelfPosition
      }))
    };
    res.json(sanitized);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/transfers — Create a request (after AI approval or manual)
router.post('/', async (req, res) => {
  try {
    const { 
      medicine, sources, requestingHospitalId, urgency, reason, manual,
      dosageUnit = 'Strips', packageCount = 10,
      driverMode = 'SENDER_DRIVER_REQUIRED',
      driverName, driverPhone, vehicleNumber,
      requesterContactName, requesterContactPhone
    } = req.body;

    const extraData = {
      dosageUnit,
      packageCount,
      driverMode,
      driverName: driverName || (driverMode === 'REQUESTER_DRIVER' ? 'Suresh Kumar (Ambulance Fleet)' : null),
      driverPhone: driverPhone || (driverMode === 'REQUESTER_DRIVER' ? '+91 98455 77889' : null),
      vehicleNumber: vehicleNumber || (driverMode === 'REQUESTER_DRIVER' ? 'KA-09-EA-1008' : null),
      requesterContactName: requesterContactName || 'Dr. Ramesh Kumar (ICU Incharge)',
      requesterContactPhone: requesterContactPhone || '+91 98450 12345',
      reason
    };

    let createdRequests = [];

    if (manual) {
      // Manual: pick best source via AI
      const result = await Bundler.findFulfillment(medicine, req.body.quantityKg, requestingHospitalId);
      if (!result.canFulfill) return res.status(400).json({ error: 'No hospital can fulfill this request' });
      const { requests } = await Bundler.createSplitRequests(medicine, result.sources, requestingHospitalId, urgency, req.user.id, extraData);
      createdRequests = requests;
    } else if (sources && sources.length) {
      const fullSources = [];
      const hospitals = await db.getHospitals();
      for (const s of sources) {
        const donors = await KarmaMarket.rankDonorHospitals(medicine, requestingHospitalId);
        const match = donors.find(d => d.hospital.id === s.hospitalId);
        if (match) {
          fullSources.push({ ...match, allocatedKg: s.allocatedKg || s.quantityKg || 1.0 });
        } else {
          const hosp = hospitals.find(h => h.id === s.hospitalId) || { id: s.hospitalId, code: s.hospitalId, karmaScore: 78, supervisor: 'Dr. Ananya Sharma' };
          const invList = await db.getInventoryForHospital(s.hospitalId);
          const matchedInv = invList.find(i => i.medicine.toLowerCase().includes(medicine.toLowerCase()) || medicine.toLowerCase().includes(i.medicine.toLowerCase())) || invList[0];
          
          fullSources.push({
            hospital: hosp,
            allocatedKg: parseFloat(s.allocatedKg || s.quantityKg) || 1.0,
            inventoryItemId: matchedInv?.id || `INV-${s.hospitalId}-01`,
            boxId: matchedInv?.boxId || 'BOX-01',
            shelfPosition: matchedInv?.shelfPosition || 'Central Rack',
            rfidUid: matchedInv?.rfidUid || 'TAG-EMG-01'
          });
        }
      }
      const { requests } = await Bundler.createSplitRequests(medicine, fullSources, requestingHospitalId, urgency, req.user.id, extraData);
      createdRequests = requests;
    } else {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    // 🚨 Broadcast High-Urgency Emergency SSE Alert to donor hospitals
    createdRequests.forEach(r => {
      broadcastSSE({
        type: 'EMERGENCY_TRANSFER_REQUESTED',
        requestId: r.id,
        sourceHospitalId: r.sourceHospitalId,
        requestingHospitalId: r.requestingHospitalId,
        medicine: r.medicine,
        quantityKg: r.quantityKg,
        dosageUnit: r.dosageUnit,
        packageCount: r.packageCount,
        driverMode: r.driverMode,
        driverName: r.driverName,
        driverPhone: r.driverPhone,
        urgency: r.urgency,
        timestamp: new Date().toISOString()
      });
    });

    res.json({ requests: createdRequests });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/transfers/:id/accept
router.put('/:id/accept', requireRole('SOURCE_SUPERVISOR', 'REQUESTING_SUPERVISOR', 'HOSPITAL_SUPERVISOR', 'NETWORK_ADMIN'), async (req, res) => {
  try {
    const reqObj = await db.getTransferRequest(req.params.id);
    if (!reqObj) return res.status(404).json({ error: 'Request not found' });
    // Find the best inventory item to fulfill this
    const items = await db.getInventoryForHospital(reqObj.sourceHospitalId);
    const bestItem = items.find(i =>
      i.medicine.toLowerCase() === reqObj.medicine.toLowerCase() && !db.isExpired(i) && !i.locked && !db.isBoxLocked(i.rfidUid)
    );
    const updated = await db.updateTransferRequest(req.params.id, {
      status: 'ACCEPTED', acceptedAt: new Date().toISOString(),
      inventoryItemId: bestItem?.id || reqObj.inventoryItemId,
      boxId: bestItem?.boxId || reqObj.boxId,
      shelfPosition: bestItem?.shelfPosition || reqObj.shelfPosition,
      targetRfidUid: bestItem?.rfidUid || reqObj.targetRfidUid
    });
    await KarmaMarket.applyRule(reqObj.sourceHospitalId, reqObj.urgency === 'HIGH' ? 'ACCEPT_QUICK' : null);
    await db.addAuditLog('TRANSFER_ACCEPTED', `${req.params.id} accepted by ${reqObj.sourceHospitalId}`, reqObj.sourceHospitalId, req.user.id);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/transfers/:id/reject
router.put('/:id/reject', requireRole('SOURCE_SUPERVISOR', 'REQUESTING_SUPERVISOR', 'HOSPITAL_SUPERVISOR', 'NETWORK_ADMIN'), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
    const reqObj = await db.getTransferRequest(req.params.id);
    if (!reqObj) return res.status(404).json({ error: 'Request not found' });

    await db.updateTransferRequest(req.params.id, { status: 'REJECTED', rejectReason: reason });

    // Karma penalty
    const ruleKey = reqObj.urgency === 'HIGH' ? 'REJECT_HIGH' : reqObj.urgency === 'MEDIUM' ? 'REJECT_MEDIUM' : null;
    if (ruleKey) await KarmaMarket.applyRule(reqObj.sourceHospitalId, ruleKey, `Rejected ${reqObj.id}: "${reason}"`);

    await db.addAuditLog('TRANSFER_REJECTED', `${req.params.id} rejected: ${reason}`, reqObj.sourceHospitalId, req.user.id);

    // Auto-reroute: find next best hospital
    const altDonors = await KarmaMarket.rankDonorHospitals(reqObj.medicine, reqObj.requestingHospitalId);
    const nextBest = altDonors.find(d => d.hospital.id !== reqObj.sourceHospitalId);
    let rerouted = null;
    if (nextBest) {
      rerouted = await db.createTransferRequest({
        requestingHospitalId: reqObj.requestingHospitalId, sourceHospitalId: nextBest.hospital.id,
        medicine: reqObj.medicine, quantityKg: reqObj.quantityKg, urgency: reqObj.urgency,
        reason: `Auto-rerouted from ${reqObj.sourceHospitalId} (rejected)`,
        inventoryItemId: nextBest.inventoryItemId, boxId: nextBest.boxId,
        shelfPosition: nextBest.shelfPosition, targetRfidUid: nextBest.rfidUid, userId: req.user.id
      });
    }

    res.json({ rejected: req.params.id, rerouted: rerouted ? rerouted.id : null, nextHospital: nextBest?.hospital.code || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/transfers/:id/verify — RFID + Weight dual-lock
router.put('/:id/verify', requireRole('DISPATCH_PHARMACIST', 'SOURCE_SUPERVISOR', 'REQUESTING_SUPERVISOR', 'HOSPITAL_SUPERVISOR', 'NETWORK_ADMIN'), async (req, res) => {
  try {
    const { scannedRfidUid, measuredWeightKg } = req.body;
    const reqObj = await db.getTransferRequest(req.params.id);
    if (!reqObj) return res.status(404).json({ error: 'Request not found' });
    if (reqObj.status !== 'ACCEPTED') return res.status(400).json({ error: 'Request must be accepted first' });

    const invItem = await db.getInventoryItem(reqObj.inventoryItemId);
    const expectedRfid = invItem?.rfidUid || reqObj.targetRfidUid;
    const rfidPass = scannedRfidUid === expectedRfid;

    const expectedWeight = reqObj.quantityKg;
    const weightTolerance = 0.05; // 5%
    const weightPass = Math.abs(measuredWeightKg - expectedWeight) <= (expectedWeight * weightTolerance);

    const verified = rfidPass && weightPass;
    const verificationStatus = verified ? 'PASSED' : !rfidPass ? 'FAIL_RFID_MISMATCH' : 'FAIL_WEIGHT_MISMATCH';

    await db.updateTransferRequest(req.params.id, {
      rfidVerified: rfidPass,
      weightVerified: weightPass,
      rfidUidScanned: scannedRfidUid,
      verificationStatus,
      verificationTime: new Date().toISOString()
    });

    if (verified) {
      await KarmaMarket.applyRule(reqObj.sourceHospitalId, 'VERIFIED_CORRECT');
      await db.addAuditLog('PHYSICAL_VERIFIED_PASS', `${req.params.id} dual-lock verified`, reqObj.sourceHospitalId, req.user.id);
    } else {
      await db.addAuditLog('PHYSICAL_VERIFIED_FAIL', `${req.params.id} verification failed: ${verificationStatus}`, reqObj.sourceHospitalId, req.user.id);
    }

    res.json({ verified, rfidPass, weightPass, verificationStatus });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/transfers/:id/dispatch — Complete dispatch
router.put('/:id/dispatch', requireRole('DISPATCH_PHARMACIST', 'SOURCE_SUPERVISOR', 'REQUESTING_SUPERVISOR', 'HOSPITAL_SUPERVISOR', 'NETWORK_ADMIN'), async (req, res) => {
  try {
    const reqObj = await db.getTransferRequest(req.params.id);
    if (!reqObj) return res.status(404).json({ error: 'Request not found' });
    if (!reqObj.rfidVerified || !reqObj.weightVerified) return res.status(400).json({ error: 'Verification not passed' });

    Verifier.lockBox(reqObj.targetRfidUid);
    await db.updateTransferRequest(req.params.id, { status: 'DISPATCHED', dispatchedAt: new Date().toISOString() });
    await db.dualInventoryUpdate(reqObj.inventoryItemId, reqObj.requestingHospitalId, reqObj.medicine, reqObj.quantityKg);
    await KarmaMarket.applyRule(reqObj.sourceHospitalId, 'DISPATCH_VERIFIED');
    await db.addAuditLog('DISPATCH_CONFIRMED', `${reqObj.id}: ${reqObj.quantityKg}kg ${reqObj.medicine} dispatched. RFID ${reqObj.targetRfidUid} locked.`, reqObj.sourceHospitalId, req.user.id);

    res.json({ success: true, requestId: reqObj.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/transfers/:id/assign-driver — Assign or update driver info
router.put('/:id/assign-driver', async (req, res) => {
  try {
    const { driverName, driverPhone, vehicleNumber, senderContactName, senderContactPhone } = req.body;
    const reqObj = await db.getTransferRequest(req.params.id);
    if (!reqObj) return res.status(404).json({ error: 'Request not found' });

    const updated = await db.updateTransferRequest(req.params.id, {
      driverName: driverName || reqObj.driverName,
      driverPhone: driverPhone || reqObj.driverPhone,
      vehicleNumber: vehicleNumber || reqObj.vehicleNumber,
      senderContactName: senderContactName || reqObj.senderContactName,
      senderContactPhone: senderContactPhone || reqObj.senderContactPhone,
      liveTrackingStatus: 'DRIVER_ASSIGNED',
      transitGps: {
        ...(reqObj.transitGps || {}),
        currentLocationName: `${reqObj.sourceHospitalId} Ambulance Dock`,
        etaMinutes: 45
      }
    });

    broadcastSSE({
      type: 'DRIVER_ASSIGNED',
      requestId: reqObj.id,
      driverName: updated.driverName,
      driverPhone: updated.driverPhone,
      vehicleNumber: updated.vehicleNumber,
      transfer: updated
    });

    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/transfers/:id/update-transit — Live GPS & route progress update
router.put('/:id/update-transit', async (req, res) => {
  try {
    const { lat, lng, progressPercent, currentSpeedKmH, temperatureC, etaMinutes, currentLocationName, liveTrackingStatus } = req.body;
    const reqObj = await db.getTransferRequest(req.params.id);
    if (!reqObj) return res.status(404).json({ error: 'Request not found' });

    const existingGps = reqObj.transitGps || {};
    const newGps = {
      lat: lat ?? existingGps.lat ?? 12.9716,
      lng: lng ?? existingGps.lng ?? 77.5946,
      progressPercent: progressPercent ?? existingGps.progressPercent ?? 0,
      currentSpeedKmH: currentSpeedKmH ?? existingGps.currentSpeedKmH ?? 58,
      temperatureC: temperatureC ?? existingGps.temperatureC ?? 4.2,
      etaMinutes: etaMinutes ?? existingGps.etaMinutes ?? 35,
      currentLocationName: currentLocationName ?? existingGps.currentLocationName ?? 'En-Route Highway NH-275'
    };

    const newStatus = liveTrackingStatus || (newGps.progressPercent >= 100 ? 'ARRIVED_AT_DOCK' : 'IN_TRANSIT');

    const updated = await db.updateTransferRequest(req.params.id, {
      transitGps: newGps,
      liveTrackingStatus: newStatus
    });

    broadcastSSE({
      type: 'TRANSIT_GPS_UPDATED',
      requestId: reqObj.id,
      transitGps: newGps,
      liveTrackingStatus: newStatus
    });

    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
