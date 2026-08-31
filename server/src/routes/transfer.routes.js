const router = require('express').Router();
const { db } = require('../config/firebase');
const { verifyToken, requireRole } = require('../middleware/auth');
const KarmaMarket = require('../modules/karma');
const Bundler = require('../modules/bundler');
const Verifier = require('../modules/verifier');

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
    const { medicine, sources, requestingHospitalId, urgency, reason, manual } = req.body;
    if (manual) {
      // Manual: pick best source via AI
      const result = await Bundler.findFulfillment(medicine, req.body.quantityKg, requestingHospitalId);
      if (!result.canFulfill) return res.status(400).json({ error: 'No hospital can fulfill this request' });
      const { requests } = await Bundler.createSplitRequests(medicine, result.sources, requestingHospitalId, urgency, req.user.id);
      return res.json({ requests });
    }
    // AI-approved: sources already selected
    if (sources && sources.length) {
      const fullSources = [];
      for (const s of sources) {
        const donors = await KarmaMarket.rankDonorHospitals(medicine, requestingHospitalId);
        const match = donors.find(d => d.hospital.id === s.hospitalId);
        if (match) fullSources.push({ ...match, allocatedKg: s.allocatedKg });
      }
      const { requests } = await Bundler.createSplitRequests(medicine, fullSources, requestingHospitalId, urgency, req.user.id);
      return res.json({ requests });
    }
    res.status(400).json({ error: 'Invalid request data' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/transfers/:id/accept
router.put('/:id/accept', requireRole('SOURCE_SUPERVISOR', 'NETWORK_ADMIN'), async (req, res) => {
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
router.put('/:id/reject', requireRole('SOURCE_SUPERVISOR', 'NETWORK_ADMIN'), async (req, res) => {
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
router.put('/:id/verify', requireRole('DISPATCH_PHARMACIST', 'NETWORK_ADMIN'), async (req, res) => {
  try {
    const { scannedRfidUid, measuredWeightKg } = req.body;
    const reqObj = await db.getTransferRequest(req.params.id);
    if (!reqObj) return res.status(404).json({ error: 'Request not found' });

    const result = Verifier.dualLockCheck(scannedRfidUid, reqObj.targetRfidUid, measuredWeightKg, reqObj.quantityKg);
    await db.updateTransferRequest(req.params.id, {
      rfidVerified: result.rfidOk, weightVerified: result.weightOk,
      rfidUidScanned: scannedRfidUid
    });

    if (!result.rfidOk) await KarmaMarket.applyRule(reqObj.sourceHospitalId, 'WRONG_MEDICINE');

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/transfers/:id/dispatch — Final dispatch
router.put('/:id/dispatch', requireRole('DISPATCH_PHARMACIST', 'NETWORK_ADMIN'), async (req, res) => {
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

module.exports = router;
