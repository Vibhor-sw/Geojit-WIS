const express = require('express');
const router = express.Router();
const { runAnalystEstimates } = require('../models/m5Uc4AnalystEstimates');
const { STOCK_UNIVERSE } = require('../data/stockUniverse');

router.get('/sample', (req, res) => res.json({ stockId: 'INFY', staleLambda: 0.02, universe: STOCK_UNIVERSE.map((s) => ({ id: s.id, name: s.name })) }));
router.post('/run', (req, res) => {
  try { res.json(runAnalystEstimates(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
