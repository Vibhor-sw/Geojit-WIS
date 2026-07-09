const express = require('express');
const router = express.Router();
const { runPersonalization } = require('../models/m3Personalization');
const { REAL_HOLDINGS } = require('../data/realPortfolioData');

router.get('/sample', (req, res) => res.json({ stockId: 'INFY', templateName: 'Balanced', heldStocks: REAL_HOLDINGS.filter((h) => h.type === 'STOCK').map((h) => ({ id: h.id, name: h.name })) }));
router.post('/run', (req, res) => {
  try { res.json(runPersonalization(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
