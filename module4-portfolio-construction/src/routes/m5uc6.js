const express = require('express');
const router = express.Router();
const { runFundSelection } = require('../models/m5Uc6FundSelection');

router.get('/sample', (req, res) => res.json({ riskFreeRate: 0.068 }));
router.post('/run', (req, res) => {
  try { res.json(runFundSelection(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
