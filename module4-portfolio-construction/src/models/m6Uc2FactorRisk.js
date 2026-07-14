// M6-UC2 — Factor Risk Decomposition. A fundamental factor-risk model over the full Module 3/5
// stock universe (the same value/quality/momentum/lowvol/growth/size factors as M5-UC1, per the
// spec's "consistent factor taxonomy" instruction): factor loadings B come from M5-UC1's own
// cross-sectional z-scoring; factor returns are recovered day-by-day via cross-sectional OLS
// (Barra-style), giving a genuine factor-covariance matrix F and per-stock specific risk D, not
// assumed/fabricated numbers. Portfolio risk = systematic (factor) + specific (idiosyncratic);
// active risk (tracking error) vs the cap-weighted universe benchmark decomposes the same way.
const { STOCK_UNIVERSE, INDEX_WEIGHTS, round2 } = require('../data/stockUniverse');
const { REAL_HOLDINGS } = require('../data/realPortfolioData');
const { computeFactorTable, FACTOR_KEYS } = require('./m5Uc1QuantRanking');
const { invert, matMul, transpose, matVec, sampleCovariance, mean, std } = require('./mathUtils');

function dailyReturnsFromCloses(closes) {
  const r = [];
  for (let i = 1; i < closes.length; i++) r.push(closes[i] / closes[i - 1] - 1);
  return r;
}

function buildFactorModel(sectorNeutral) {
  const zTable = computeFactorTable(sectorNeutral, 3);
  const B = STOCK_UNIVERSE.map((s) => FACTOR_KEYS.map((k) => zTable[s.id][k]));
  const returnRows = STOCK_UNIVERSE.map((s) => dailyReturnsFromCloses(s.ohlcv.map((b) => b.close)));
  const nDays = returnRows[0].length;
  // Cross-sectional OLS projection matrix P = (BᵀB)⁻¹Bᵀ, applied to each day's return vector to
  // recover that day's factor returns f_t -- the standard Barra-style fundamental factor model.
  const Bt = transpose(B);
  const BtB = matMul(Bt, B);
  const BtBinv = invert(BtB);
  const P = matMul(BtBinv, Bt); // 6 x n
  const factorReturnRows = []; // nDays x 6
  const specificReturns = STOCK_UNIVERSE.map(() => []); // n x nDays
  for (let t = 0; t < nDays; t++) {
    const rVec = returnRows.map((r) => r[t]);
    const fVec = matVec(P, rVec); // 6x1
    factorReturnRows.push(fVec);
    const fitted = matVec(B, fVec); // n x1, B * f_t
    rVec.forEach((r, i) => specificReturns[i].push(r - fitted[i]));
  }
  const F = sampleCovariance(factorReturnRows); // 6x6 factor covariance
  const D = specificReturns.map((series) => std(series) ** 2); // per-stock specific variance
  return { B, F, D, ids: STOCK_UNIVERSE.map((s) => s.id), factorReturnRows, specificReturns };
}

function fullWeightVector(idOrder, weightById) {
  return idOrder.map((id) => weightById[id] || 0);
}

function riskDecompose(w, B, F, D) {
  const Bt = transpose(B);
  const exposure = matVec(Bt, w); // 6x1 portfolio factor exposure
  const Fexposure = matVec(F, exposure);
  const systematicVar = exposure.reduce((a, e, k) => a + e * Fexposure[k], 0);
  const specificVar = w.reduce((a, wi, i) => a + wi * wi * D[i], 0);
  const totalVar = systematicVar + specificVar;
  const factorContribution = exposure.map((e, k) => e * Fexposure[k]);
  return { exposure, systematicVar, specificVar, totalVar, factorContribution };
}

function runFactorRisk(payload) {
  const p = payload || {};
  const sectorNeutral = p.sectorNeutral !== false;
  const unintendedThreshold = p.unintendedThreshold != null ? p.unintendedThreshold : 0.5;

  const model = buildFactorModel(sectorNeutral);
  const { B, F, D, ids } = model;

  const stockPositions = REAL_HOLDINGS.filter((h) => h.type === 'STOCK');
  const mvById = {};
  stockPositions.forEach((h) => { mvById[h.id] = h.qty * h.currentPrice; });
  const totalMv = Object.values(mvById).reduce((a, b) => a + b, 0);
  const wPortById = {}; Object.keys(mvById).forEach((id) => { wPortById[id] = mvById[id] / totalMv; });

  const indexSum = Object.values(INDEX_WEIGHTS).reduce((a, b) => a + b, 0);
  const wBenchById = {}; Object.keys(INDEX_WEIGHTS).forEach((id) => { wBenchById[id] = INDEX_WEIGHTS[id] / indexSum; });

  const wPort = fullWeightVector(ids, wPortById);
  const wBench = fullWeightVector(ids, wBenchById);
  const wActive = wPort.map((w, i) => w - wBench[i]);

  const portRisk = riskDecompose(wPort, B, F, D);
  const benchRisk = riskDecompose(wBench, B, F, D);
  const activeRisk = riskDecompose(wActive, B, F, D);

  const portVol = Math.sqrt(Math.max(portRisk.totalVar, 0)) * Math.sqrt(252);
  const benchVol = Math.sqrt(Math.max(benchRisk.totalVar, 0)) * Math.sqrt(252);
  const trackingErrorAnnual = Math.sqrt(Math.max(activeRisk.totalVar, 0)) * Math.sqrt(252);

  const factorExposureTable = FACTOR_KEYS.map((k, i) => ({
    factor: k, portfolioExposure: round2(portRisk.exposure[i]), benchmarkExposure: round2(benchRisk.exposure[i]),
    activeExposure: round2(wActive.length ? matVec(transpose(B), wActive)[i] : 0),
    riskContributionPct: round2((portRisk.factorContribution[i] / (portRisk.totalVar || 1e-9)) * 100),
  }));

  const activeExposureVec = matVec(transpose(B), wActive);
  const teFactorContribution = FACTOR_KEYS.map((k, i) => {
    const Fexp = matVec(F, activeExposureVec)[i];
    return { factor: k, contribution: activeExposureVec[i] * Fexp };
  });
  const teDecomposition = teFactorContribution.map((r) => ({ factor: r.factor, contributionPct: round2((r.contribution / (activeRisk.totalVar || 1e-9)) * 100) }));

  const unintendedExposures = factorExposureTable.filter((r) => Math.abs(r.activeExposure) > unintendedThreshold)
    .map((r) => ({ factor: r.factor, activeExposure: r.activeExposure, note: `${Math.abs(r.activeExposure).toFixed(2)}-sigma ${r.activeExposure > 0 ? 'overweight' : 'underweight'} tilt vs benchmark on ${r.factor} — check if this is a deliberate view.` }));

  const riskContributions = factorExposureTable.map((r) => ({ factor: r.factor, portfolioContributionPct: r.riskContributionPct }))
    .concat([{ factor: 'Specific (idiosyncratic)', portfolioContributionPct: round2((portRisk.specificVar / (portRisk.totalVar || 1e-9)) * 100) }])
    .sort((a, b) => b.portfolioContributionPct - a.portfolioContributionPct);

  return {
    riskSplit: {
      portfolioVolAnnualPct: round2(portVol * 100), benchmarkVolAnnualPct: round2(benchVol * 100), trackingErrorAnnualPct: round2(trackingErrorAnnual * 100),
      systematicPctOfVar: round2((portRisk.systematicVar / (portRisk.totalVar || 1e-9)) * 100), specificPctOfVar: round2((portRisk.specificVar / (portRisk.totalVar || 1e-9)) * 100),
    },
    factorExposures: factorExposureTable,
    riskDecomposition: { table: riskContributions },
    trackingError: { annualPct: round2(trackingErrorAnnual * 100), factorContribution: teDecomposition },
    riskContributions,
    unintendedExposures,
    modelNote: 'Factor returns are recovered via a daily cross-sectional OLS regression of stock returns on static factor loadings (fundamental Barra-style approach) over the full stock universe, sector-neutral by default. Static loadings are a simplification -- a production model would refresh loadings each rebalance.',
    factorSet: FACTOR_KEYS, sectorNeutral,
  };
}

module.exports = { runFactorRisk, buildFactorModel };
