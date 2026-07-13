const express = require('express');
const router = express.Router();
const { runYieldCurve } = require('../models/m5Uc9YieldCurve');

router.get('/sample', (req, res) => res.json({}));
router.post('/run', (req, res) => {
  try { res.json(runYieldCurve(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
