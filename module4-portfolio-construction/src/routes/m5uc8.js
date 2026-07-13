const express = require('express');
const router = express.Router();
const { runReturnForecast } = require('../models/m5Uc8ReturnForecast');

router.get('/sample', (req, res) => res.json({ horizon: '3M' }));
router.post('/run', (req, res) => {
  try { res.json(runReturnForecast(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
