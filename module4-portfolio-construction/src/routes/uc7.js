const express = require('express');
const router = express.Router();
const { runRoboAdvisory } = require('../models/uc7RoboAdvisory');
const { SAMPLE_LOTS } = require('../data/sampleData');

const SAMPLE_REQUEST = {
  riskQuestionnaire: { tolerance: [4, 4, 3, 5], capacity: [3, 4, 3] },
  goals: [
    { name: 'Child Education', targetAmount: 3000000, horizonYears: 12, inflation: 0.08, currentValue: 400000, monthlySip: 8000 },
    { name: 'Retirement', targetAmount: 20000000, horizonYears: 25, inflation: 0.06, currentValue: 1500000, monthlySip: 15000 },
  ],
  lots: SAMPLE_LOTS,
  cashflow: 20000,
  targetSuccessProbability: 0.80,
};

router.get('/sample', (req, res) => res.json(SAMPLE_REQUEST));

router.post('/run', (req, res) => {
  try {
    res.json(runRoboAdvisory(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
