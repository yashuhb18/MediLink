const router = require('express').Router();
const { db } = require('../config/firebase');
const { verifyToken, requireRole } = require('../middleware/auth');
const Guardian = require('../modules/guardian');

router.use(verifyToken);
router.use(requireRole('NETWORK_ADMIN'));

// GET /api/admin/heatmap
router.get('/heatmap', async (req, res) => {
  try {
    const hospitals = await db.getHospitals();
    const allInv = await db.getAllInventory();
    const medicines = [...new Set(allInv.map(i => i.medicine))];
    const heatmap = medicines.map(med => {
      const row = { medicine: med };
      hospitals.forEach(h => {
        const items = allInv.filter(i => i.hospitalId === h.id && i.medicine === med);
        if (!items.length) { row[h.id] = { status: 'NONE', color: 'grey' }; return; }
        const item = items[0];
        const expired = db.isExpired(item);
        const ratio = item.currentStockKg / item.minThresholdKg;
        row[h.id] = {
          status: expired ? 'EXPIRED' : ratio > 1.5 ? 'IN_STOCK' : ratio > 0.5 ? 'LOW' : item.currentStockKg > 0 ? 'CRITICAL' : 'OUT',
          color: expired ? 'black' : ratio > 1.5 ? 'green' : ratio > 0.5 ? 'yellow' : 'red',
          currentKg: item.currentStockKg, thresholdKg: item.minThresholdKg
        };
      });
      return row;
    });
    res.json({ hospitals, medicines, heatmap });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/force-approve/:requestId
router.post('/force-approve/:requestId', async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason required for emergency override' });
    const reqObj = await db.getTransferRequest(req.params.requestId);
    if (!reqObj) return res.status(404).json({ error: 'Request not found' });
    await db.updateTransferRequest(req.params.requestId, { status: 'ACCEPTED', acceptedAt: new Date().toISOString() });
    await db.addAuditLog('EMERGENCY_OVERRIDE', `Admin force-approved ${req.params.requestId}: "${reason}"`, reqObj.sourceHospitalId, req.user.id, false);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/impersonate
router.post('/impersonate', async (req, res) => {
  try {
    const { hospitalId, supervisorName } = req.body;
    await db.addAuditLog('IMPERSONATION_START', `Admin impersonating ${supervisorName} at ${hospitalId}`, hospitalId, req.user.id, true);
    res.json({ success: true, impersonating: { hospitalId, supervisorName } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/audit-log
router.get('/audit-log', async (req, res) => {
  try { res.json(await db.getAuditLog(200)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/sensor-alerts
router.get('/sensor-alerts', async (req, res) => {
  try { res.json(await Guardian.getActiveAlerts()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/create-batch (Factory Batch Serialization)
router.post('/create-batch', async (req, res) => {
  try {
    const {
      medicine,
      batch,
      weightKg,
      minThresholdKg,
      hospitalId,
      rfidUid,
      boxId,
      expiryDate,
      shelfPosition,
      coldChain,
      temperatureRange,
      tareWeightKg,
      dosageForm = 'Tablets',
      dosageUnit = 'Strips',
      packageCount = 100,
      unitDescription = '100 Strips'
    } = req.body;

    if (!medicine || !batch) {
      return res.status(400).json({ error: 'Medicine name and batch number are required.' });
    }

    const newItem = await db.createInventoryItem({
      medicine,
      batch,
      currentStockKg: parseFloat(weightKg) || 1.0,
      minThresholdKg: parseFloat(minThresholdKg) || 1.0,
      dosageForm,
      dosageUnit,
      packageCount: parseInt(packageCount) || 100,
      unitDescription: unitDescription || `${packageCount} ${dosageUnit}`,
      hospitalId: hospitalId || 'H01',
      rfidUid: rfidUid || `TAG-${Math.floor(Math.random() * 9000 + 1000)}`,
      boxId: boxId || `BOX-${Math.floor(Math.random() * 900 + 100)}`,
      shelfPosition: shelfPosition || 'Central DC / Bay 1',
      expiryDate: expiryDate || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
    });

    const auditDetail = `Warehouse Serialized Batch: ${medicine} (${newItem.packageCount} ${newItem.dosageUnit}, Batch: ${batch}, RFID: ${newItem.rfidUid}) allocated to ${hospitalId || 'H01'}`;
    await db.addAuditLog('FACTORY_BATCH_CREATED', auditDetail, hospitalId || 'H01', req.user.id);

    res.status(201).json({
      success: true,
      message: `Batch serialized as ${newItem.packageCount} ${newItem.dosageUnit} and published to network successfully!`,
      item: newItem
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/consignments
router.get('/consignments', async (req, res) => {
  try {
    const allInv = await db.getAllInventory();
    const consignments = allInv.slice(-10).map((inv, idx) => ({
      consignmentId: `CSG-2026-${1000 + idx}`,
      medicine: inv.medicine,
      batch: inv.batch,
      weightKg: inv.currentStockKg,
      rfidUid: inv.rfidUid,
      boxId: inv.boxId,
      destHospital: inv.hospitalId,
      status: 'DISPATCHED_TO_NODE',
      dispatchedAt: inv.createdAt || new Date(Date.now() - (idx + 1) * 3600000 * 2).toISOString(),
      qrToken: `SECURE-TOKEN-GS1-${inv.batch}`
    }));
    res.json(consignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
