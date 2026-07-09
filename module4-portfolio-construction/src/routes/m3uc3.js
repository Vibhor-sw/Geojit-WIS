const express = require('express');
const router = express.Router();
const { runRiskQuantAnalytics } = require('../models/m3Act3RiskQuant');
const { STOCK_UNIVERSE } = require('../data/stockUniverse');

router.get('/sample', (req, res) => res.json({ stockId: 'INFY', pathCount: 2000, horizonDays: 126, riskFreeRate: 0.068, universe: STOCK_UNIVERSE.map((s) => ({ id: s.id, name: s.name })) }));
router.post('/run', (req, res) => {
  try { res.json(runRiskQuantAnalytics(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
