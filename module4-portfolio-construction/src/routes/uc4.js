const express = require('express');
const router = express.Router();
const { runRebalancing } = require('../models/uc4Rebalancing');
const { SAMPLE_LOTS } = require('../data/sampleData');

const SAMPLE_REQUEST = {
  lots: SAMPLE_LOTS,
  targetWeights: {
    RELIANCE: 0.12, TCS: 0.10, HDFCBANK: 0.15, INFY: 0.08, ITC: 0.05,
    LT: 0.08, NIFTYBEES: 0.25, GOLDBEES: 0.07, LIQUIDBEES: 0.10,
  },
  driftBandAbs: 0.05,
  driftBandRel: 0.20,
  policy: 'threshold',
  cashflow: 50000,
  transactionCostBps: 10,
  minTradeValue: 5000,
};

router.get('/sample', (req, res) => res.json(SAMPLE_REQUEST));

router.post('/run', (req, res) => {
  try {
    res.json(runRebalancing(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
