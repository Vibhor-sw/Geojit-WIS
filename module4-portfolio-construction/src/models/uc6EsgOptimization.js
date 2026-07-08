// M4-UC6 -- ESG & Mandate-Constrained Optimization
// FR-ES-01..06: hard exclusions, ESG/carbon portfolio-level constraints, tracking-error control,
// ESG-vs-benchmark/unconstrained reporting, frontier-shift (return cost of ESG constraints).
// Reuses the M4-UC3 optimizer core per the spec's "component library" build note.

const { UNIVERSE, BENCHMARK_WEIGHTS, EXCLUSION_LIST } = require('../data/sampleData');
const { buildUniverse, buildCovariance, optimize, portfolioStats } = require('./uc3Optimizer');
const { shrinkCovariance } = require('./mathUtils');

function runEsgOptimization(input) {
  const {
    universeIds = null,
    exclusions = EXCLUSION_LIST,
    esgMin = 65,
    carbonMax = 35,
    teMax = 0.06,
    boxMax = 0.30,
    shrinkageIntensity = 0.3,
    riskAversion = 3,
    tiltTargets = {},
  } = input;

  const universe = buildUniverse(universeIds);
  const n = universe.length;
  const mu = universe.map((u) => u.expReturn);
  const sampleSigma = buildCovariance(universe);
  const Sigma = shrinkCovariance(sampleSigma, shrinkageIntensity);

  const esgScores = universe.map((u) => u.esg);
  const carbonScores = universe.map((u) => u.carbon);
  const benchmarkWeights = universe.map((u) => BENCHMARK_WEIGHTS[u.id] || 0);
  const bmkSum = benchmarkWeights.reduce((a, b) => a + b, 0) || 1;
  const normBmk = benchmarkWeights.map((w) => w / bmkSum);

  const lb = new Array(n).fill(0);
  const ub = universe.map((u) => (exclusions.includes(u.id) ? 0 : boxMax));

  // Unconstrained (return-only) optimum for comparison / ESG-cost calculation.
  const unconstrainedWeights = optimize(universe, mu, Sigma, { objective: 'maxSharpe', lb: new Array(n).fill(0), ub: new Array(n).fill(boxMax), riskAversion });
  const unconstrainedStats = portfolioStats(unconstrainedWeights, mu, Sigma);

  const esgWeights = optimize(universe, mu, Sigma, {
    objective: 'maxSharpe', lb, ub, riskAversion,
    esgScores, esgMin, carbonScores, carbonMax, benchmarkWeights: normBmk, teMax,
    iterations: 800,
  });
  const esgStats = portfolioStats(esgWeights, mu, Sigma);

  const weightedEsg = esgWeights.reduce((s, w, i) => s + w * esgScores[i], 0);
  const weightedCarbon = esgWeights.reduce((s, w, i) => s + w * carbonScores[i], 0);
  const bmkEsg = normBmk.reduce((s, w, i) => s + w * esgScores[i], 0);
  const bmkCarbon = normBmk.reduce((s, w, i) => s + w * carbonScores[i], 0);
  const unconEsg = unconstrainedWeights.reduce((s, w, i) => s + w * esgScores[i], 0);
  const unconCarbon = unconstrainedWeights.reduce((s, w, i) => s + w * carbonScores[i], 0);

  const active = esgWeights.map((w, i) => w - normBmk[i]);
  let teVar = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) teVar += active[i] * active[j] * Sigma[i][j];
  const trackingError = Math.sqrt(Math.max(teVar, 0));

  const exclusionCompliance = {
    excludedNames: exclusions,
    allZeroWeight: exclusions.every((id) => {
      const idx = universe.findIndex((u) => u.id === id);
      return idx < 0 || esgWeights[idx] < 1e-6;
    }),
  };

  // ESG return cost: expected return foregone at (approximately) matched risk vs the unconstrained optimum.
  const esgReturnCost = Math.max(0, unconstrainedStats.ret - esgStats.ret);

  // Residual tilts: sector weight difference vs benchmark caused by exclusions/ESG constraints.
  const sectorWeights = (weights) => {
    const sw = {};
    universe.forEach((u, i) => { sw[u.sector] = (sw[u.sector] || 0) + weights[i]; });
    return sw;
  };
  const esgSectors = sectorWeights(esgWeights);
  const bmkSectors = sectorWeights(normBmk);
  const residualTilts = {};
  const allSectors = new Set([...Object.keys(esgSectors), ...Object.keys(bmkSectors)]);
  for (const s of allSectors) residualTilts[s] = Number(((esgSectors[s] || 0) - (bmkSectors[s] || 0)).toFixed(4));

  return {
    esgWeights: universe.map((u, i) => ({ security: u.id, weight: Number(esgWeights[i].toFixed(4)) })),
    esgCarbonReport: {
      portfolioEsg: Number(weightedEsg.toFixed(1)), portfolioCarbon: Number(weightedCarbon.toFixed(1)),
      benchmarkEsg: Number(bmkEsg.toFixed(1)), benchmarkCarbon: Number(bmkCarbon.toFixed(1)),
      unconstrainedEsg: Number(unconEsg.toFixed(1)), unconstrainedCarbon: Number(unconCarbon.toFixed(1)),
      esgMinConstraint: esgMin, carbonMaxConstraint: carbonMax,
      esgConstraintMet: weightedEsg >= esgMin - 0.5, carbonConstraintMet: weightedCarbon <= carbonMax + 0.5,
    },
    exclusionCompliance,
    trackingError: Number(trackingError.toFixed(4)),
    esgReturnCost: Number(esgReturnCost.toFixed(4)),
    residualTilts,
    comparison: {
      unconstrained: { return: unconstrainedStats.ret, risk: unconstrainedStats.vol },
      esgConstrained: { return: esgStats.ret, risk: esgStats.vol },
    },
  };
}

module.exports = { runEsgOptimization };
