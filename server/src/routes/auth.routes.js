const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');
const { verifyToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await db.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, hospitalId: user.hospitalId, name: user.name, initials: user.initials },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await db.addAuditLog('LOGIN', `${user.name} logged in (${user.role})`, user.hospitalId, user.id);

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, hospitalId: user.hospitalId, initials: user.initials }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
