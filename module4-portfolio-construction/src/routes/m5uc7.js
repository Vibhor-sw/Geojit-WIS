const express = require('express');
const router = express.Router();
const { runMacroForecast } = require('../models/m5Uc7MacroForecast');

router.get('/sample', (req, res) => res.json({}));
router.post('/run', (req, res) => {
  try { res.json(runMacroForecast(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
