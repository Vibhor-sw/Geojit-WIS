const express = require('express');
const router = express.Router();
const { runMonteCarlo } = require('../models/uc2MonteCarlo');

const SAMPLE_REQUEST = {
  currentCorpus: 5000000,
  accumulationYears: 15,
  decumulationYears: 25,
  monthlyContribution: 25000,
  annualWithdrawal: 420000,
  inflationMean: 0.06,
  inflationVol: 0.015,
  accumulationWeights: { Equity: 0.65, Debt: 0.25, Gold: 0.05, Cash: 0.05, International: 0.0 },
  decumulationWeights: { Equity: 0.35, Debt: 0.50, Gold: 0.10, Cash: 0.05, International: 0.0 },
  shockProbability: 0.03,
  shockSize: 300000,
  pathCount: 3000,
  targetSuccessProbability: 0.85,
};

router.get('/sample', (req, res) => res.json(SAMPLE_REQUEST));

router.post('/run', (req, res) => {
  try {
    res.json(runMonteCarlo(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
