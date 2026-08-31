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

module.exports = router;
