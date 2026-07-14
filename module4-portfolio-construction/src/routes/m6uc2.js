const express = require('express');
const router = express.Router();
const { runFactorRisk } = require('../models/m6Uc2FactorRisk');

router.get('/sample', (req, res) => res.json({ sectorNeutral: true, unintendedThreshold: 0.5 }));
router.post('/run', (req, res) => {
  try { res.json(runFactorRisk(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
