const express = require('express');
const router = express.Router();
const { runBondRelativeValue } = require('../models/m5Uc5BondRelativeValue');

router.get('/sample', (req, res) => res.json({ lgdPct: 45, liquidityWeight: 0.3 }));
router.post('/run', (req, res) => {
  try { res.json(runBondRelativeValue(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
