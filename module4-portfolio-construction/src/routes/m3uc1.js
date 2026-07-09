const express = require('express');
const router = express.Router();
const { runMarketIntelligence } = require('../models/m3Act1Market');

router.get('/sample', (req, res) => res.json({}));
router.post('/run', (req, res) => {
  try { res.json(runMarketIntelligence()); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
