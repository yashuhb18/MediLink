const router = require('express').Router();
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');
const Predictor = require('../modules/predictor');

router.use(verifyToken);

// GET /api/inventory?hospitalId=H01
router.get('/', async (req, res) => {
  try {
    const { hospitalId } = req.query;
    const items = hospitalId ? await db.getInventoryForHospital(hospitalId) : await db.getAllInventory();
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/inventory/search?medicine=Paracetamol&viewerHospitalId=H01
router.get('/search', async (req, res) => {
  try {
    const { medicine, viewerHospitalId } = req.query;
    const all = await db.getAllInventory();
    let filtered = all;
    if (medicine) filtered = filtered.filter(i => i.medicine.toLowerCase().includes(medicine.toLowerCase()));

    const results = filtered.map(item => ({
      ...item,
      availability: db.getPublicAvailability(item, viewerHospitalId || req.user.hospitalId),
      isExpired: db.isExpired(item),
      statusColor: db.isExpired(item) ? 'expired' :
        item.currentStockKg <= 0 ? 'red' :
        item.currentStockKg < item.minThresholdKg ? 'yellow' : 'green'
    }));
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/inventory/:id/history
router.get('/:id/history', async (req, res) => {
  try {
    const history = db.getWeightHistory(req.params.id);
    res.json(history);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/inventory/:id/weight
router.put('/:id/weight', async (req, res) => {
  try {
    const { weightKg } = req.body;
    const updated = await db.updateInventoryItem(req.params.id, { currentStockKg: parseFloat(weightKg) });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/inventory/predictions?hospitalId=H01
router.get('/predictions/:hospitalId', async (req, res) => {
  try {
    const predictions = await Predictor.generatePredictions(req.params.hospitalId);
    res.json(predictions);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
