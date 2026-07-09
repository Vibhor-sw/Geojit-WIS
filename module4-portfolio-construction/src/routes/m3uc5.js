const express = require('express');
const router = express.Router();
const { runConvictionSynthesis, DEFAULT_WEIGHTS } = require('../models/m3Act5Conviction');
const { STOCK_UNIVERSE } = require('../data/stockUniverse');

router.get('/sample', (req, res) => res.json({ stockId: 'INFY', weights: DEFAULT_WEIGHTS, publish: true, sandbox: { gdpDelta: 0, repoDelta: 0, inrDelta: 0 }, universe: STOCK_UNIVERSE.map((s) => ({ id: s.id, name: s.name })) }));
router.post('/run', (req, res) => {
  try { res.json(runConvictionSynthesis(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
