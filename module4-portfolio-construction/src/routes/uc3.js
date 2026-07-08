const express = require('express');
const router = express.Router();
const { runOptimization } = require('../models/uc3Optimizer');
const { UNIVERSE } = require('../data/sampleData');

const SAMPLE_REQUEST = {
  objective: 'maxSharpe',
  riskFreeRate: 0.065,
  shrinkageIntensity: 0.3,
  useBlackLitterman: true,
  views: [{ assetId: 'TCS', viewReturn: 0.16, confidence: 0.6 }],
  sectorCaps: { IT: 0.30, Financials: 0.30 },
  boxMax: 0.25,
  riskAversion: 3,
  turnoverCap: null,
  currentHoldings: { RELIANCE: 0.12, TCS: 0.08, HDFCBANK: 0.15, NIFTYBEES: 0.20, GOLDBEES: 0.05, LIQUIDBEES: 0.10 },
  transactionCostBps: 15,
};

router.get('/sample', (req, res) => res.json({ ...SAMPLE_REQUEST, universe: UNIVERSE }));

router.post('/run', (req, res) => {
  try {
    res.json(runOptimization(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
