const express = require('express');
const router = express.Router();
const { runEarningsQuality } = require('../models/m5Uc3EarningsQuality');
const { STOCK_UNIVERSE } = require('../data/stockUniverse');

router.get('/sample', (req, res) => res.json({ stockId: 'INFY', universe: STOCK_UNIVERSE.map((s) => ({ id: s.id, name: s.name })) }));
router.post('/run', (req, res) => {
  try { res.json(runEarningsQuality(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
