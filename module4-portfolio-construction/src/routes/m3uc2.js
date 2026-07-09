const express = require('express');
const router = express.Router();
const { runSixPillarAnalysis } = require('../models/m3Act2SixPillar');
const { STOCK_UNIVERSE } = require('../data/stockUniverse');

router.get('/sample', (req, res) => res.json({ stockId: 'INFY', universe: STOCK_UNIVERSE.map((s) => ({ id: s.id, name: s.name, sector: s.sector, macap: s.macap })) }));
router.post('/run', (req, res) => {
  try { res.json(runSixPillarAnalysis(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
