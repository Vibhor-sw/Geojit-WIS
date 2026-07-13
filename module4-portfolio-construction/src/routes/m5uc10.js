const express = require('express');
const router = express.Router();
const { runRegimeDetection } = require('../models/m5Uc10RegimeDetection');

router.get('/sample', (req, res) => res.json({}));
router.post('/run', (req, res) => {
  try { res.json(runRegimeDetection(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
