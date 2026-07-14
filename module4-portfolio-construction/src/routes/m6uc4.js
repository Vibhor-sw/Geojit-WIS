const express = require('express');
const router = express.Router();
const { runVolatilityForecast } = require('../models/m6Uc4VolatilityForecast');

router.get('/sample', (req, res) => res.json({ horizonsDays: [1, 5, 21], simPaths: 800, impliedAnchorWeight: 0.25 }));
router.post('/run', (req, res) => {
  try { res.json(runVolatilityForecast(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
