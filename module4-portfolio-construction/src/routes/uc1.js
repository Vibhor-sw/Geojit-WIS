const express = require('express');
const router = express.Router();
const { runGoalAllocation } = require('../models/uc1GoalAllocation');

const SAMPLE_REQUEST = {
  riskCategory: 3,
  targetSuccessProbability: 0.80,
  goals: [
    { name: 'Child Education', targetAmount: 3000000, horizonYears: 12, inflation: 0.08, currentValue: 400000, lumpSum: 0, monthlySip: 8000 },
    { name: 'Retirement', targetAmount: 20000000, horizonYears: 25, inflation: 0.06, currentValue: 1500000, lumpSum: 0, monthlySip: 15000 },
    { name: 'Home Down-payment', targetAmount: 2000000, horizonYears: 4, inflation: 0.06, currentValue: 300000, lumpSum: 100000, monthlySip: 20000 },
  ],
};

router.get('/sample', (req, res) => res.json(SAMPLE_REQUEST));

router.post('/run', (req, res) => {
  try {
    const result = runGoalAllocation(req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
