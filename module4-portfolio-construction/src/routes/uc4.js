const express = require('express');
const router = express.Router();
const { runRebalancing } = require('../models/uc4Rebalancing');
const { REAL_HOLDINGS } = require('../data/realPortfolioData');

const lots = REAL_HOLDINGS.map((h) => ({
  id: h.isin, security: h.id, qty: h.qty, costBasis: h.costBasis, purchaseDate: h.purchaseDate, currentPrice: h.currentPrice,
}));

// Default target weights: Sell-flagged holdings are targeted to a full exit (0%) so they surface as
// breaches; Buy-flagged holdings get a moderate boost; Hold-flagged holdings keep their current
// weight. This ties the rebalancing demo directly to the Reco column in the source holdings data
// rather than an arbitrary target, so it's obvious *why* a given security is flagged.
const totalValue = REAL_HOLDINGS.reduce((s, h) => s + h.qty * h.currentPrice, 0);
const rawTargets = {};
REAL_HOLDINGS.forEach((h) => {
  const currentWeight = (h.qty * h.currentPrice) / totalValue;
  rawTargets[h.id] = h.reco === 'Sell' ? 0 : h.reco === 'Buy' ? currentWeight * 1.4 : currentWeight;
});
const targetSum = Object.values(rawTargets).reduce((a, b) => a + b, 0) || 1;
const targetWeights = {};
Object.entries(rawTargets).forEach(([id, w]) => { targetWeights[id] = Number((w / targetSum).toFixed(4)); });

const SAMPLE_REQUEST = {
  lots,
  targetWeights,
  driftBandAbs: 0.05,
  driftBandRel: 0.20,
  policy: 'threshold',
  cashflow: 50000,
  transactionCostBps: 10,
  minTradeValue: 2000,
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
