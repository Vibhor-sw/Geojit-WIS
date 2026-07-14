const express = require('express');
const router = express.Router();
const { runLiquidityConcentration } = require('../models/m6Uc6LiquidityConcentration');

router.get('/sample', (req, res) => res.json({ maxParticipationRate: 0.15, stressVolumeHaircut: 0.5, liquidationHorizonDays: 5, limits: { singleNamePct: 10, sectorPct: 25, issuerPct: 15 } }));
router.post('/run', (req, res) => {
  try { res.json(runLiquidityConcentration(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
