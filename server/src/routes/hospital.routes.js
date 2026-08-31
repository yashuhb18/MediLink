const router = require('express').Router();
const { db } = require('../config/firebase');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);

// GET /api/hospitals
router.get('/', async (req, res) => {
  try { res.json(await db.getHospitals()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/hospitals/:id
router.get('/:id', async (req, res) => {
  try {
    const h = await db.getHospital(req.params.id);
    if (!h) return res.status(404).json({ error: 'Hospital not found' });
    res.json(h);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/hospitals/:id (admin only)
router.put('/:id', requireRole('NETWORK_ADMIN'), async (req, res) => {
  try {
    const updated = await db.updateHospital(req.params.id, req.body);
    await db.addAuditLog('HOSPITAL_UPDATED', `${req.params.id} updated: ${JSON.stringify(req.body)}`, req.params.id, req.user.id);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
