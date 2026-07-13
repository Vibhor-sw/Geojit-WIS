const express = require('express');
const router = express.Router();
const { runDcfValuation } = require('../models/m5Uc2DcfValuation');
const { STOCK_UNIVERSE } = require('../data/stockUniverse');

router.get('/sample', (req, res) => res.json({ stockId: 'INFY', horizonYears: 5, erp: 0.06, universe: STOCK_UNIVERSE.map((s) => ({ id: s.id, name: s.name })) }));
router.post('/run', (req, res) => {
  try { res.json(runDcfValuation(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
