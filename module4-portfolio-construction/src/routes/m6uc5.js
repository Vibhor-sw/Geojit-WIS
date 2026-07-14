const express = require('express');
const router = express.Router();
const { runDrawdownHedging } = require('../models/m6Uc5DrawdownHedging');

router.get('/sample', (req, res) => res.json({ horizonDays: 60, mddThresholdPct: -15, riskTargetVolPct: 7, simPaths: 4000 }));
router.post('/run', (req, res) => {
  try { res.json(runDrawdownHedging(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
