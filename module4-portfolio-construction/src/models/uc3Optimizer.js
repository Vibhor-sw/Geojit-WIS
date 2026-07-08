// M4-UC3 -- Mean-Variance & Factor Optimization
// FR-MV-01..07: Markowitz / Black-Litterman / shrinkage covariance / factor & sector constraints /
// efficient frontier / trade list. Implemented as a constrained projected-gradient optimizer
// (numerically equivalent in spirit to a QP solve for this prototype's universe size) so the
// output reflects a genuinely solved portfolio rather than a lookup table.

const { UNIVERSE } = require('../data/sampleData');
const { invert, shrinkCovariance, projectToSimplexBox, transpose, matMul, matVec } = require('./mathUtils');

function buildUniverse(ids) {
  const list = ids && ids.length ? UNIVERSE.filter((u) => ids.includes(u.id)) : UNIVERSE;
  return list;
}

// Synthetic covariance for the sample universe: derive from vol + a factor-driven correlation
// proxy (assets sharing sector/asset-class correlate more), since we don't have real return history.
function buildCovariance(universe) {
  const n = universe.length;
  const Sigma = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        Sigma[i][j] = universe[i].vol * universe[i].vol;
        continue;
      }
      let corr = 0.15; // baseline market correlation
      if (universe[i].sector === universe[j].sector) corr += 0.35;
      if (universe[i].assetClass === universe[j].assetClass) corr += 0.15;
      corr = Math.min(corr, 0.9);
      if (universe[i].assetClass !== universe[j].assetClass) corr *= 0.4;
      Sigma[i][j] = corr * universe[i].vol * universe[j].vol;
    }
  }
  return Sigma;
}

function blackLitterman(priorReturns, Sigma, views, tau = 0.05) {
  // views: [{ assetIndex, viewReturn, confidence (0-1) }]
  if (!views || !views.length) return priorReturns.slice();
  const n = priorReturns.length;
  const P = views.map((v) => {
    const row = new Array(n).fill(0);
    row[v.assetIndex] = 1;
    return row;
  });
  const Q = views.map((v) => [v.viewReturn]);
  const Omega = views.map((v, i) => {
    const row = new Array(views.length).fill(0);
    const varP = P[i].reduce((s, p, k) => s + p * p * Sigma[k][k], 0) * tau;
    row[i] = varP / Math.max(v.confidence, 0.05);
    return row;
  });

  const tauSigma = Sigma.map((row) => row.map((v) => v * tau));
  const tauSigmaInv = invert(tauSigma);
  const Pt = transpose(P);
  const OmegaInv = invert(Omega);
  // A = (tauSigma)^-1 + P' Omega^-1 P
  const PtOmegaInv = matMul(Pt, OmegaInv);
  const PtOmegaInvP = matMul(PtOmegaInv, P);
  const A = tauSigmaInv.map((row, i) => row.map((v, j) => v + PtOmegaInvP[i][j]));
  const AInv = invert(A);
  // B = (tauSigma)^-1 * pi + P' Omega^-1 Q
  const piVec = priorReturns.map((v) => [v]);
  const term1 = matMul(tauSigmaInv, piVec);
  const term2 = matMul(PtOmegaInv, Q);
  const B = term1.map((row, i) => [row[0] + term2[i][0]]);
  const muBL = matMul(AInv, B);
  return muBL.map((r) => r[0]);
}

function portfolioStats(w, mu, Sigma) {
  const ret = w.reduce((s, wi, i) => s + wi * mu[i], 0);
  let variance = 0;
  for (let i = 0; i < w.length; i++)
    for (let j = 0; j < w.length; j++) variance += w[i] * w[j] * Sigma[i][j];
  return { ret, vol: Math.sqrt(Math.max(variance, 0)) };
}

// Projected-gradient solve. objective: 'maxSharpe' | 'minVariance' | 'targetReturn'
function optimize(universe, mu, Sigma, opts) {
  const n = universe.length;
  const {
    objective = 'maxSharpe', riskFreeRate = 0.065, targetReturn = null,
    lb = new Array(n).fill(0), ub = new Array(n).fill(0.35),
    sectorCaps = {}, riskAversion = 3, iterations = 600, lr = 0.05,
    factorTargets = null, // { value: {min,max}, ... }
    turnoverCap = null, currentWeights = null,
    esgScores = null, esgMin = null, // ESG mandate: portfolio-level minimum weighted ESG score
    carbonScores = null, carbonMax = null, // portfolio-level maximum weighted carbon intensity
    benchmarkWeights = null, teMax = null, // tracking-error cap vs a benchmark
  } = opts;

  let w = projectToSimplexBox(new Array(n).fill(1 / n), lb, ub);

  function sectorPenaltyGrad(w) {
    const grad = new Array(n).fill(0);
    const sectorSums = {};
    universe.forEach((u, i) => { sectorSums[u.sector] = (sectorSums[u.sector] || 0) + w[i]; });
    for (const [sector, cap] of Object.entries(sectorCaps)) {
      const sum = sectorSums[sector] || 0;
      if (sum > cap) {
        universe.forEach((u, i) => { if (u.sector === sector) grad[i] += 2 * (sum - cap); });
      }
    }
    return grad;
  }

  function factorPenaltyGrad(w) {
    const grad = new Array(n).fill(0);
    if (!factorTargets) return grad;
    for (const [factor, range] of Object.entries(factorTargets)) {
      let exposure = 0;
      universe.forEach((u, i) => { exposure += w[i] * (u.factors[factor] || 0); });
      if (range.min != null && exposure < range.min) {
        universe.forEach((u, i) => { grad[i] += 2 * (exposure - range.min) * (u.factors[factor] || 0); });
      }
      if (range.max != null && exposure > range.max) {
        universe.forEach((u, i) => { grad[i] += 2 * (exposure - range.max) * (u.factors[factor] || 0); });
      }
    }
    return grad;
  }

  function turnoverPenaltyGrad(w) {
    const grad = new Array(n).fill(0);
    if (!turnoverCap || !currentWeights) return grad;
    const turnover = w.reduce((s, wi, i) => s + Math.abs(wi - currentWeights[i]), 0);
    if (turnover > turnoverCap) {
      w.forEach((wi, i) => { grad[i] += 2 * Math.sign(wi - currentWeights[i]) * (turnover - turnoverCap); });
    }
    return grad;
  }

  function esgPenaltyGrad(w) {
    const grad = new Array(n).fill(0);
    if (!esgScores || esgMin == null) return grad;
    const weightedEsg = w.reduce((s, wi, i) => s + wi * esgScores[i], 0);
    if (weightedEsg < esgMin) {
      w.forEach((wi, i) => { grad[i] += 2 * (weightedEsg - esgMin) * esgScores[i]; });
    }
    return grad;
  }

  function carbonPenaltyGrad(w) {
    const grad = new Array(n).fill(0);
    if (!carbonScores || carbonMax == null) return grad;
    const weightedCarbon = w.reduce((s, wi, i) => s + wi * carbonScores[i], 0);
    if (weightedCarbon > carbonMax) {
      w.forEach((wi, i) => { grad[i] += 2 * (weightedCarbon - carbonMax) * carbonScores[i]; });
    }
    return grad;
  }

  function trackingErrorPenaltyGrad(w) {
    const grad = new Array(n).fill(0);
    if (!benchmarkWeights || teMax == null) return grad;
    const active = w.map((wi, i) => wi - benchmarkWeights[i]);
    const Sa = matVec(Sigma, active);
    const teVar = active.reduce((s, a, i) => s + a * Sa[i], 0);
    const te = Math.sqrt(Math.max(teVar, 0));
    if (te > teMax) {
      Sa.forEach((v, i) => { grad[i] += 2 * (te - teMax) * v; });
    }
    return grad;
  }

  for (let iter = 0; iter < iterations; iter++) {
    const Sw = matVec(Sigma, w);
    let grad;
    if (objective === 'minVariance') {
      grad = Sw.map((v) => -2 * v); // ascend on -variance == descend variance
    } else if (objective === 'targetReturn') {
      const { ret } = portfolioStats(w, mu, Sigma);
      const retPenalty = 50 * (ret - (targetReturn != null ? targetReturn : ret));
      grad = Sw.map((v, i) => -2 * v + retPenalty * mu[i]);
    } else {
      // maxSharpe proxy: maximize mu'w - (riskAversion/2) w'Sigma w
      grad = mu.map((m, i) => m - riskAversion * Sw[i]);
    }
    const secGrad = sectorPenaltyGrad(w);
    const facGrad = factorPenaltyGrad(w);
    const turnGrad = turnoverPenaltyGrad(w);
    const esgGrad = esgPenaltyGrad(w);
    const carbonGrad = carbonPenaltyGrad(w);
    const teGrad = trackingErrorPenaltyGrad(w);
    const step = grad.map((g, i) => g - secGrad[i] - facGrad[i] - turnGrad[i] - esgGrad[i] - carbonGrad[i] - teGrad[i]);
    w = w.map((wi, i) => wi + lr * step[i]);
    w = projectToSimplexBox(w, lb, ub);
  }
  return w;
}

function computeFrontier(universe, mu, Sigma, opts, points = 12) {
  const minRet = Math.min(...mu), maxRet = Math.max(...mu);
  const frontier = [];
  for (let k = 0; k <= points; k++) {
    const target = minRet + ((maxRet - minRet) * k) / points;
    const w = optimize(universe, mu, Sigma, { ...opts, objective: 'targetReturn', targetReturn: target, iterations: 250 });
    const { ret, vol } = portfolioStats(w, mu, Sigma);
    frontier.push({ targetReturn: target, return: ret, risk: vol });
  }
  return frontier;
}

function runOptimization(input) {
  const {
    universeIds = null,
    objective = 'maxSharpe',
    riskFreeRate = 0.065,
    shrinkageIntensity = 0.3,
    useBlackLitterman = false,
    views = [], // [{assetId, viewReturn, confidence}]
    sectorCaps = {},
    boxMax = 0.35,
    riskAversion = 3,
    turnoverCap = null,
    currentHoldings = {}, // { assetId: weight }
    transactionCostBps = 15,
  } = input;

  const universe = buildUniverse(universeIds);
  const n = universe.length;
  const priorReturns = universe.map((u) => u.expReturn);
  const sampleSigma = buildCovariance(universe);
  const Sigma = shrinkCovariance(sampleSigma, shrinkageIntensity);

  const viewsIdx = views.map((v) => ({
    assetIndex: universe.findIndex((u) => u.id === v.assetId),
    viewReturn: v.viewReturn,
    confidence: v.confidence,
  })).filter((v) => v.assetIndex >= 0);

  const mu = useBlackLitterman ? blackLitterman(priorReturns, Sigma, viewsIdx) : priorReturns;

  const currentWeights = universe.map((u) => currentHoldings[u.id] || 0);
  const lb = new Array(n).fill(0);
  const ub = new Array(n).fill(boxMax);

  const optOpts = { objective, riskFreeRate, lb, ub, sectorCaps, riskAversion, turnoverCap, currentWeights };
  const optimalWeights = optimize(universe, mu, Sigma, optOpts);
  const { ret, vol } = portfolioStats(optimalWeights, mu, Sigma);
  const sharpe = vol > 0 ? (ret - riskFreeRate) / vol : 0;

  const efficientFrontier = computeFrontier(universe, mu, Sigma, { lb, ub, sectorCaps });
  const currentStats = portfolioStats(currentWeights, mu, Sigma);

  const factorReport = {};
  ['value', 'quality', 'momentum', 'size', 'lowvol'].forEach((f) => {
    factorReport[f] = universe.reduce((s, u, i) => s + optimalWeights[i] * (u.factors[f] || 0), 0);
  });

  const tradeList = universe.map((u, i) => {
    const delta = optimalWeights[i] - currentWeights[i];
    return {
      security: u.id, name: u.name, currentWeight: currentWeights[i], targetWeight: Number(optimalWeights[i].toFixed(4)),
      delta: Number(delta.toFixed(4)), side: delta > 0.0005 ? 'BUY' : delta < -0.0005 ? 'SELL' : 'HOLD',
      estimatedCostBps: Math.abs(delta) * transactionCostBps * 100,
    };
  }).filter((t) => t.side !== 'HOLD');

  const turnover = tradeList.reduce((s, t) => s + Math.abs(t.delta), 0);
  const estimatedCost = tradeList.reduce((s, t) => s + Math.abs(t.delta) * (transactionCostBps / 10000), 0);

  // Diversification ratio = weighted avg vol / portfolio vol.
  const weightedAvgVol = universe.reduce((s, u, i) => s + optimalWeights[i] * u.vol, 0);
  const diversificationRatio = vol > 0 ? weightedAvgVol / vol : 1;

  const feasibility = {
    sumWeights: Number(optimalWeights.reduce((a, b) => a + b, 0).toFixed(6)),
    boxSatisfied: optimalWeights.every((w) => w >= -1e-6 && w <= boxMax + 1e-6),
    sectorCapsSatisfied: Object.entries(sectorCaps).every(([sector, cap]) => {
      const sum = universe.reduce((s, u, i) => (u.sector === sector ? s + optimalWeights[i] : s), 0);
      return sum <= cap + 0.01;
    }),
  };

  return {
    universe: universe.map((u) => ({ id: u.id, name: u.name, sector: u.sector, vol: u.vol })),
    optimalWeights: universe.map((u, i) => ({ security: u.id, weight: Number(optimalWeights[i].toFixed(4)) })),
    efficientFrontier,
    currentPortfolio: { return: currentStats.ret, risk: currentStats.vol },
    factorReport,
    tradeList,
    riskMetrics: { expectedReturn: ret, volatility: vol, sharpe, diversificationRatio, turnover, estimatedCost },
    feasibility,
    muUsed: useBlackLitterman ? 'black-litterman-blended' : 'house-view-prior',
    // Exposed so the UI can let a user override weights and recompute stats client-side without a
    // full re-solve: expected return / covariance are in the same order as `universe` above.
    mu, covariance: Sigma, riskFreeRate,
  };
}

module.exports = { runOptimization, buildUniverse, buildCovariance, blackLitterman, optimize, portfolioStats };
