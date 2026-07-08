// M4-UC2 -- Monte Carlo Retirement & Wealth Simulation
// FR-MC-01..06: path-wise stochastic simulation across accumulation + decumulation,
// success probability, percentile wealth bands, safe withdrawal rate, sequence-risk overlay.

const { CAPITAL_MARKET_ASSUMPTIONS, ASSET_CLASSES } = require('../data/sampleData');
const { makeRng, randn, percentile } = require('./mathUtils');

function portfolioReturn(weights, mu, sigma, rng) {
  // Single-factor approximation of the portfolio-level normal return draw (mu/sigma pre-blended from weights).
  return mu + sigma * randn(rng);
}

function blendedMuSigma(weights) {
  const cma = CAPITAL_MARKET_ASSUMPTIONS;
  const w = ASSET_CLASSES.map((ac) => weights[ac] || 0);
  const mu = ASSET_CLASSES.reduce((s, ac, i) => s + w[i] * cma.expectedReturn[ac], 0);
  let variance = 0;
  for (let i = 0; i < ASSET_CLASSES.length; i++)
    for (let j = 0; j < ASSET_CLASSES.length; j++) {
      const covIJ = cma.correlation[i][j] * cma.volatility[ASSET_CLASSES[i]] * cma.volatility[ASSET_CLASSES[j]];
      variance += w[i] * w[j] * covIJ;
    }
  return { mu, sigma: Math.sqrt(Math.max(variance, 0)) };
}

function simulateOnce(params, rng, withdrawalOverride, shockOrderBias) {
  const {
    currentCorpus, accumulationYears, decumulationYears, monthlyContribution,
    annualWithdrawal, inflationMean, inflationVol, accumulationWeights, decumulationWeights,
    taxRateOnGains, shockProbability, shockSize,
  } = params;

  const { mu: muAcc, sigma: sigAcc } = blendedMuSigma(accumulationWeights);
  const { mu: muDec, sigma: sigDec } = blendedMuSigma(decumulationWeights);

  let wealth = currentCorpus;
  const totalYears = accumulationYears + decumulationYears;
  const yearlyWealth = [wealth];
  let depleted = false;
  let depletionYear = null;
  let inflationIndex = 1;

  // Pre-draw yearly return "quality" so we can optionally bias ordering for sequence-risk analysis.
  const yearReturns = [];
  for (let y = 0; y < totalYears; y++) {
    const inAccumulation = y < accumulationYears;
    const { mu, sigma } = inAccumulation ? { mu: muAcc, sigma: sigAcc } : { mu: muDec, sigma: sigDec };
    yearReturns.push(mu + sigma * randn(rng));
  }
  if (shockOrderBias === 'front') {
    yearReturns.sort((a, b) => a - b);
  } else if (shockOrderBias === 'back') {
    yearReturns.sort((a, b) => b - a);
  }

  for (let y = 0; y < totalYears; y++) {
    const inAccumulation = y < accumulationYears;
    const inflation = inflationMean + inflationVol * randn(rng);
    inflationIndex *= (1 + inflation);
    const r = yearReturns[y];

    if (inAccumulation) {
      wealth = (wealth + monthlyContribution * 12) * (1 + r);
    } else {
      const realWithdrawal = (withdrawalOverride != null ? withdrawalOverride : annualWithdrawal) * inflationIndex;
      let shock = 0;
      if (rng() < shockProbability) shock = shockSize;
      wealth = (wealth - realWithdrawal - shock) * (1 + r);
      wealth -= Math.max(0, wealth) * taxRateOnGains * 0.15; // simplified drag on realised gains during decumulation
    }
    if (wealth <= 0) {
      wealth = 0;
      if (!depleted) { depleted = true; depletionYear = y; }
    }
    yearlyWealth.push(wealth);
  }
  return { yearlyWealth, depleted, depletionYear, terminalWealth: wealth };
}

function runMonteCarlo(input) {
  const {
    currentCorpus = 5000000,
    accumulationYears = 15,
    decumulationYears = 25,
    monthlyContribution = 25000,
    annualWithdrawal = 420000,
    inflationMean = 0.06,
    inflationVol = 0.015,
    accumulationWeights = { Equity: 0.65, Debt: 0.25, Gold: 0.05, Cash: 0.05, International: 0.0 },
    decumulationWeights = { Equity: 0.35, Debt: 0.50, Gold: 0.10, Cash: 0.05, International: 0.0 },
    taxRateOnGains = 0.125,
    shockProbability = 0.03,
    shockSize = 300000,
    pathCount = 3000,
    targetSuccessProbability = 0.85,
    seed = 7,
  } = input;

  const rng = makeRng(seed);
  const params = {
    currentCorpus, accumulationYears, decumulationYears, monthlyContribution, annualWithdrawal,
    inflationMean, inflationVol, accumulationWeights, decumulationWeights, taxRateOnGains,
    shockProbability, shockSize,
  };

  const totalYears = accumulationYears + decumulationYears;
  const allPaths = [];
  let successes = 0;
  const depletionAges = [];

  for (let s = 0; s < pathCount; s++) {
    const { yearlyWealth, depleted, depletionYear } = simulateOnce(params, rng);
    allPaths.push(yearlyWealth);
    if (!depleted) successes++;
    else depletionAges.push(accumulationYears + depletionYear);
  }

  const successProbability = successes / pathCount;

  const percentileWealthPaths = { p5: [], p25: [], p50: [], p75: [], p95: [] };
  for (let y = 0; y <= totalYears; y++) {
    const vals = allPaths.map((p) => p[y]).sort((a, b) => a - b);
    percentileWealthPaths.p5.push(Math.round(percentile(vals, 0.05)));
    percentileWealthPaths.p25.push(Math.round(percentile(vals, 0.25)));
    percentileWealthPaths.p50.push(Math.round(percentile(vals, 0.50)));
    percentileWealthPaths.p75.push(Math.round(percentile(vals, 0.75)));
    percentileWealthPaths.p95.push(Math.round(percentile(vals, 0.95)));
  }

  // Safe withdrawal rate: bisect annual withdrawal (as % of corpus at retirement) for target success probability.
  const swrRng = makeRng(seed + 1);
  let lo = 0, hi = currentCorpus * 0.15;
  let bestWithdrawal = 0;
  for (let iter = 0; iter < 16; iter++) {
    const mid = (lo + hi) / 2;
    let succ = 0;
    const trials = 400;
    for (let s = 0; s < trials; s++) {
      const { depleted } = simulateOnce(params, swrRng, mid);
      if (!depleted) succ++;
    }
    const p = succ / trials;
    if (p >= targetSuccessProbability) { bestWithdrawal = mid; lo = mid; } else { hi = mid; }
  }
  const safeWithdrawalRate = currentCorpus > 0 ? bestWithdrawal / currentCorpus : 0;

  // Sequence-of-returns risk: compare success probability under front-loaded vs back-loaded bad-return ordering.
  const seqRng1 = makeRng(seed + 2), seqRng2 = makeRng(seed + 3);
  const trialsSeq = 500;
  let frontSucc = 0, backSucc = 0;
  for (let s = 0; s < trialsSeq; s++) {
    if (!simulateOnce(params, seqRng1, null, 'front').depleted) frontSucc++;
    if (!simulateOnce(params, seqRng2, null, 'back').depleted) backSucc++;
  }
  const sequenceRiskDelta = (backSucc - frontSucc) / trialsSeq;

  const depletionAgeDist = depletionAges.length
    ? {
        count: depletionAges.length,
        min: Math.min(...depletionAges),
        median: percentile([...depletionAges].sort((a, b) => a - b), 0.5),
        max: Math.max(...depletionAges),
      }
    : { count: 0, min: null, median: null, max: null };

  return {
    successProbability,
    percentileWealthPaths,
    safeWithdrawalRate,
    depletionAgeDist,
    sequenceRiskDelta,
    runManifest: {
      assumptions: CAPITAL_MARKET_ASSUMPTIONS.version,
      pathCount,
      seed,
      model: 'iid-normal-per-asset-class',
      timestamp: new Date().toISOString(),
    },
  };
}

module.exports = { runMonteCarlo };
