const express = require('express');
const router = express.Router();
const { runTaxLossHarvesting } = require('../models/uc5TaxLossHarvesting');
const { REAL_HOLDINGS } = require('../data/realPortfolioData');

const lots = REAL_HOLDINGS.map((h) => ({
  id: h.isin, security: h.id, qty: h.qty, costBasis: h.costBasis, purchaseDate: h.purchaseDate, currentPrice: h.currentPrice,
}));

const SAMPLE_REQUEST = {
  lots,
  realizedGainsYTD: { stcg: 15000, ltcg: 40000 },
  washSaleWindowDays: 30,
  minHarvestableLoss: 500,
  recentlyPurchased: [],
};

router.get('/sample', (req, res) => res.json(SAMPLE_REQUEST));

router.post('/run', (req, res) => {
  try {
    res.json(runTaxLossHarvesting(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
