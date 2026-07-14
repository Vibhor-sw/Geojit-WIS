const express = require('express');
const router = express.Router();
const { runVarCvar } = require('../models/m6Uc1VarCvar');

router.get('/sample', (req, res) => res.json({ confidence: 0.95, horizonDays: 1, shrinkage: 0.2, mcPaths: 3000, tDegreesOfFreedom: 5, evtThresholdPercentile: 0.90 }));
router.post('/run', (req, res) => {
  try { res.json(runVarCvar(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
