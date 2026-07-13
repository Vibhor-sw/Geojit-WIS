const express = require('express');
const router = express.Router();
const { runQuantRanking, DEFAULT_FACTOR_WEIGHTS } = require('../models/m5Uc1QuantRanking');

router.get('/sample', (req, res) => res.json({ weights: DEFAULT_FACTOR_WEIGHTS, sectorNeutral: true }));
router.post('/run', (req, res) => {
  try { res.json(runQuantRanking(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
