const express = require('express');
const router = express.Router();
const { runScreener } = require('../models/m3Screener');

router.get('/sample', (req, res) => res.json({ bucket: 'Quality Compounders', withConvictionAndPatterns: true }));
router.post('/run', (req, res) => {
  try { res.json(runScreener(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
