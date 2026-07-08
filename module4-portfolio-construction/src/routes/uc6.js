const express = require('express');
const router = express.Router();
const { runEsgOptimization } = require('../models/uc6EsgOptimization');
const { EXCLUSION_LIST } = require('../data/sampleData');

const SAMPLE_REQUEST = {
  exclusions: EXCLUSION_LIST,
  esgMin: 65,
  carbonMax: 35,
  teMax: 0.06,
  boxMax: 0.30,
};

router.get('/sample', (req, res) => res.json(SAMPLE_REQUEST));

router.post('/run', (req, res) => {
  try {
    res.json(runEsgOptimization(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
