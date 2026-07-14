const express = require('express');
const router = express.Router();
const { runStressTesting } = require('../models/m6Uc3StressTesting');

router.get('/sample', (req, res) => res.json({ reverseStressThresholdPct: 0.15 }));
router.post('/run', (req, res) => {
  try { res.json(runStressTesting(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
