const express = require('express');
const router = express.Router();
const { runOptimization } = require('../models/uc3Optimizer');
const { REAL_HOLDINGS } = require('../data/realPortfolioData');

// Current holdings weight = each real holding's actual market value (qty * currentPrice), normalised.
const totalValue = REAL_HOLDINGS.reduce((s, h) => s + h.qty * h.currentPrice, 0);
const currentHoldings = {};
REAL_HOLDINGS.forEach((h) => { currentHoldings[h.id] = Number(((h.qty * h.currentPrice) / totalValue).toFixed(4)); });

const SAMPLE_REQUEST = {
  objective: 'maxSharpe',
  riskFreeRate: 0.065,
  shrinkageIntensity: 0.3,
  useBlackLitterman: true,
  views: [{ assetId: 'HDFCBANK', viewReturn: 0.16, confidence: 0.6 }],
  sectorCaps: { 'Information Technology': 0.15, 'Financial Services': 0.30 },
  boxMax: 0.15,
  riskAversion: 3,
  turnoverCap: null,
  currentHoldings,
  transactionCostBps: 15,
};

router.get('/sample', (req, res) => res.json({ ...SAMPLE_REQUEST, universe: REAL_HOLDINGS }));

router.post('/run', (req, res) => {
  try {
    res.json(runOptimization(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
