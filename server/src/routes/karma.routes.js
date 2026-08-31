const router = require('express').Router();
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// GET /api/karma/:hospitalId
router.get('/:hospitalId', async (req, res) => {
  try {
    const hospital = await db.getHospital(req.params.hospitalId);
    const history = await db.getKarmaHistory(req.params.hospitalId);
    const cls = hospital.karmaScore >= 60 ? 'high' : hospital.karmaScore >= 35 ? 'medium' : 'low';
    res.json({ score: hospital.karmaScore, class: cls, history });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/karma — all hospitals ranked
router.get('/', async (req, res) => {
  try {
    const hospitals = await db.getHospitals();
    const ranked = hospitals.sort((a, b) => b.karmaScore - a.karmaScore).map(h => ({
      id: h.id, code: h.code, name: h.name, karmaScore: h.karmaScore,
      class: h.karmaScore >= 60 ? 'high' : h.karmaScore >= 35 ? 'medium' : 'low'
    }));
    res.json(ranked);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
