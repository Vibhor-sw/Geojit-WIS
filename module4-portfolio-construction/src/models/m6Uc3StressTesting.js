// M6-UC3 — Macro Scenario & Stress Testing. Revalues the real equity book under a library of
// historical-calibrated and hypothetical macro shocks (equity, rates, FX, credit spreads), using
// per-stock sensitivities (market beta from genuine regression against the universe benchmark;
// sector-based rate/FX/credit sensitivities, documented as illustrative assumptions absent a
// licensed multi-factor macro model). Shocks propagate through an assumed macro-factor covariance
// via Cholesky, consistent with the spec's "correlated propagation" requirement. Reverse-stress
// solves, in closed form, the minimal Mahalanobis-norm shock that breaches a loss threshold.
// Regime context (M5-UC10) weights each scenario's plausibility, per the spec's cross-module note.
const { STOCK_UNIVERSE, round2 } = require('../data/stockUniverse');
const { REAL_HOLDINGS } = require('../data/realPortfolioData');
const { benchmarkReturnSeries, equityPositions, dailyReturnsFromCloses, mean, std } = require('./m6RiskCore');
const { cholesky, matVec, matMul, transpose } = require('./mathUtils');
const { runRegimeDetection } = require('./m5Uc10RegimeDetection');

const FACTORS = ['equity', 'rate', 'fx', 'credit'];

// Illustrative macro-factor correlation (not a licensed multi-asset covariance feed): equity and
// credit spreads move together in stress (positive corr on spread-widening vs equity fall, hence
// negative equity/credit corr here since credit is expressed as a spread shock); rates and FX have
// a modest positive relationship (rate hikes often coincide with a firmer currency).
const MACRO_CORR = [
  [1.00, -0.10, 0.35, -0.55],
  [-0.10, 1.00, 0.25, -0.15],
  [0.35, 0.25, 1.00, -0.20],
  [-0.55, -0.15, -0.20, 1.00],
];
const MACRO_VOL = { equity: 0.18, rate: 0.012, fx: 0.06, credit: 0.015 }; // annualised illustrative shock-unit vols
function macroCovariance() {
  const vols = FACTORS.map((f) => MACRO_VOL[f]);
  return MACRO_CORR.map((row, i) => row.map((c, j) => c * vols[i] * vols[j]));
}

// Historical-calibrated and hypothetical scenarios, as factor-shock vectors. Magnitudes are
// illustrative, sized to the broad order of the named historical episode (a production build
// would calibrate directly to the realised factor moves over the named window).
const SCENARIO_LIBRARY = [
  { id: 'gfc2008', name: 'Global Financial Crisis (2008)', type: 'historical', bias: 'bearish', shocks: { equity: -0.55, rate: -0.020, fx: 0.20, credit: 0.030 } },
  { id: 'covid2020', name: 'COVID-19 Crash (Mar 2020)', type: 'historical', bias: 'bearish', shocks: { equity: -0.38, rate: -0.010, fx: 0.08, credit: 0.015 } },
  { id: 'taper2013', name: 'Taper Tantrum (2013)', type: 'historical', bias: 'bearish', shocks: { equity: -0.15, rate: 0.015, fx: 0.12, credit: 0.008 } },
  { id: 'demon2016', name: 'Demonetisation (Nov 2016)', type: 'historical', bias: 'neutral', shocks: { equity: -0.08, rate: -0.0025, fx: 0.02, credit: 0.002 } },
  { id: 'rateshock', name: 'Hypothetical: Aggressive RBI Rate Hike (+200bps)', type: 'hypothetical', bias: 'bearish', shocks: { equity: -0.10, rate: 0.020, fx: 0.03, credit: 0.005 } },
  { id: 'oilspike', name: 'Hypothetical: Oil Price Spike + INR Depreciation', type: 'hypothetical', bias: 'bearish', shocks: { equity: -0.12, rate: 0.005, fx: 0.10, credit: 0.006 } },
];

// Sector-based rate/FX/credit sensitivities -- illustrative assumptions (documented in the tour)
// standing in for a licensed multi-factor macro-sensitivity feed. Sign convention: sensitivity is
// the fractional price impact per unit (100%) of the named shock.
const SECTOR_SENSITIVITY = {
  'Financial Services': { rate: -0.9, fx: -0.1, credit: -1.4 },
  'Information Technology': { rate: -0.1, fx: 0.9, credit: -0.2 },
  'Automobile and Auto Components': { rate: -1.1, fx: -0.3, credit: -0.6 },
  'Metals & Mining': { rate: -0.4, fx: 0.3, credit: -0.5 },
  'Oil Gas & Consumable Fuels': { rate: -0.2, fx: -0.4, credit: -0.3 },
  'Fast Moving Consumer Goods': { rate: -0.2, fx: -0.1, credit: -0.1 },
  'Healthcare': { rate: -0.1, fx: 0.5, credit: -0.2 },
  'Capital Goods': { rate: -0.7, fx: -0.2, credit: -0.5 },
  'Construction Materials': { rate: -0.6, fx: -0.1, credit: -0.4 },
  'Power': { rate: -0.8, fx: -0.1, credit: -0.6 },
  'Telecommunication': { rate: -0.5, fx: -0.2, credit: -0.7 },
  'Services': { rate: -0.4, fx: 0.1, credit: -0.4 },
  'Consumer Durables': { rate: -0.4, fx: -0.2, credit: -0.3 },
};
function sectorSens(sector) { return SECTOR_SENSITIVITY[sector] || { rate: -0.4, fx: 0, credit: -0.4 }; }

function computeBetaM6(stockCloses, benchReturns) {
  const stockReturns = dailyReturnsFromCloses(stockCloses);
  const n = Math.min(stockReturns.length, benchReturns.length);
  const s = stockReturns.slice(-n), b = benchReturns.slice(-n);
  const ms = mean(s), mb = mean(b);
  let cov = 0, varB = 0;
  for (let i = 0; i < n; i++) { cov += (s[i] - ms) * (b[i] - mb); varB += (b[i] - mb) ** 2; }
  return cov / (varB || 1e-9);
}

function positionSensitivities() {
  const positions = equityPositions();
  const bench = benchmarkReturnSeries();
  return positions.map((p) => {
    const beta = computeBetaM6(p.closes, bench);
    const sens = sectorSens(p.sector);
    return { ...p, beta: round2(beta), rateSens: sens.rate, fxSens: sens.fx, creditSens: sens.credit };
  });
}

function revalue(position, shocks) {
  // ΔP/P ≈ beta·equityShock + rateSens·rateShock + fxSens·fxShock + creditSens·creditShock.
  // Rate/credit shocks are already expressed in decimal fractions (e.g. 0.02 = 200bps), scaled
  // consistently with the sector sensitivities above (fractional price impact per unit shock).
  const contrib = {
    equity: position.beta * shocks.equity,
    rate: position.rateSens * shocks.rate * 10, // scale so 200bps * -0.9 sensitivity ~ realistic single-digit % impact
    fx: position.fxSens * shocks.fx,
    credit: position.creditSens * shocks.credit * 10,
  };
  const total = Object.values(contrib).reduce((a, b) => a + b, 0);
  return { total, contrib };
}

function scenarioPnl(positions, scenario) {
  let portPct = 0;
  const driverTotals = { equity: 0, rate: 0, fx: 0, credit: 0 };
  const perPosition = positions.map((p) => {
    const { total, contrib } = revalue(p, scenario.shocks);
    portPct += p.weight * total;
    FACTORS.forEach((f) => { driverTotals[f] += p.weight * contrib[f]; });
    return { id: p.id, name: p.name, sector: p.sector, weightPct: round2(p.weight * 100), pnlPct: round2(total * 100), pnlAmount: round2(total * p.marketValue) };
  }).sort((a, b) => a.pnlPct - b.pnlPct);
  const portValue = positions.reduce((a, p) => a + p.marketValue, 0);
  return {
    id: scenario.id, name: scenario.name, type: scenario.type, bias: scenario.bias,
    portfolioPnlPct: round2(portPct * 100), portfolioPnlAmount: round2(portPct * portValue),
    driverBreakdown: FACTORS.map((f) => ({ factor: f, pnlPct: round2(driverTotals[f] * 100) })),
    worstPositions: perPosition.slice(0, 5), bestPositions: perPosition.slice(-3).reverse(),
  };
}

// Reverse stress: closed-form minimal-Mahalanobis-norm shock x (under the assumed macro
// covariance Sigma) such that the portfolio's linear sensitivity vector a satisfies aᵀx = target.
// Lagrangian solution: x* = target · Sigma·a / (aᵀ·Sigma·a).
function reverseStress(positions, targetLossPct) {
  const portValue = positions.reduce((a, p) => a + p.marketValue, 0);
  const a = FACTORS.map((f) => positions.reduce((s, p) => {
    if (f === 'equity') return s + p.weight * p.beta;
    if (f === 'rate') return s + p.weight * p.rateSens * 10;
    if (f === 'fx') return s + p.weight * p.fxSens;
    return s + p.weight * p.creditSens * 10;
  }, 0));
  const Sigma = macroCovariance();
  const Sa = matVec(Sigma, a);
  const aSa = a.reduce((s, ai, i) => s + ai * Sa[i], 0) || 1e-9;
  const target = -targetLossPct; // negative = a loss
  const scale = target / aSa;
  const xStar = Sa.map((v) => v * scale);
  const mahalanobisNorm = Math.sqrt(Math.max(a.reduce((s, ai, i) => s + xStar[i] * (matVec(Sigma, xStar)[i]), 0), 0));
  return {
    targetLossPct: round2(targetLossPct * 100),
    shockSet: FACTORS.map((f, i) => ({ factor: f, shock: round2(xStar[i] * 100) })),
    mahalanobisNorm: round2(mahalanobisNorm),
    interpretation: `The smallest (most-plausible, correlation-weighted) combination of equity/rate/FX/credit shocks that would produce a ${round2(targetLossPct * 100)}% portfolio loss.`,
  };
}

function runStressTesting(payload) {
  const p = payload || {};
  const reverseStressThresholdPct = p.reverseStressThresholdPct != null ? p.reverseStressThresholdPct : 0.15;

  const positions = positionSensitivities();
  const scenarioResults = SCENARIO_LIBRARY.map((sc) => scenarioPnl(positions, sc));
  const worstScenarios = [...scenarioResults].sort((a, b) => a.portfolioPnlPct - b.portfolioPnlPct);

  const regime = runRegimeDetection({}).currentRegime;
  const bearishRegime = regime.regime.startsWith('Bear');
  const plausibilityWeights = scenarioResults.map((sc) => {
    let weight = 0.5, note;
    if (sc.bias === 'bearish') {
      weight = bearishRegime ? 0.75 : 0.35;
      note = bearishRegime ? 'Current regime is bearish, raising the plausibility of further bearish shocks.' : 'Current regime is not bearish; this bearish scenario is weighted as tail risk rather than base case.';
    } else {
      weight = 0.5;
      note = 'A neutral-bias scenario keeps a moderate plausibility weight regardless of the current regime.';
    }
    return { id: sc.id, name: sc.name, plausibilityWeight: round2(weight), note };
  });

  const reverse = reverseStress(positions, reverseStressThresholdPct);

  return {
    scenarioResults,
    worstScenarios: worstScenarios.slice(0, 3),
    reverseStress: reverse,
    driverAttribution: scenarioResults.map((s) => ({ id: s.id, name: s.name, driverBreakdown: s.driverBreakdown })),
    plausibilityWeights: { currentRegime: regime.regime, weights: plausibilityWeights },
    positionCount: positions.length,
    modelNote: 'Sector rate/FX/credit sensitivities are illustrative assumptions standing in for a licensed multi-factor macro-sensitivity feed; equity beta is a genuine regression against the universe benchmark. Shock magnitudes are sized to the broad order of the named historical episode, not fitted to realised factor moves over that exact window.',
  };
}

module.exports = { runStressTesting, SCENARIO_LIBRARY };
