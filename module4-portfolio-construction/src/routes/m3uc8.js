const express = require('express');
const router = express.Router();
const { runPlatform, RBAC_MATRIX } = require('../models/m3Platform');

router.get('/sample', (req, res) => res.json({ token: 'Research Analyst', userId: 'demo-user', searchQuery: 'infy', roles: Object.keys(RBAC_MATRIX) }));
router.post('/run', (req, res) => {
  try { res.json(runPlatform(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
