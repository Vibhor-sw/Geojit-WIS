const express = require('express');
const router = express.Router();
const { runTaxLossHarvesting } = require('../models/uc5TaxLossHarvesting');
const { SAMPLE_LOTS } = require('../data/sampleData');

const SAMPLE_REQUEST = {
  lots: SAMPLE_LOTS,
  realizedGainsYTD: { stcg: 15000, ltcg: 40000 },
  washSaleWindowDays: 30,
  minHarvestableLoss: 1000,
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
