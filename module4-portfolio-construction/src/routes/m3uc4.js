const express = require('express');
const router = express.Router();
const { runDiscovery } = require('../models/m3Act4Discovery');
const { runMarketIntelligence } = require('../models/m3Act1Market');

router.get('/sample', (req, res) => res.json({ scanCriteria: { minRoe: 12 } }));
router.post('/run', (req, res) => {
  try {
    const mi = runMarketIntelligence();
    res.json(runDiscovery({ ...(req.body || {}), sectorRotation: mi.sectorRotation }));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
