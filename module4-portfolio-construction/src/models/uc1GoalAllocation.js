// M4-UC1 -- Goal-Based Asset Allocation
// Implements FR-GA-01..07: horizon bucketing -> glide-path allocation, probability-of-success
// via forward projection, SIP/allocation goal-seek, household aggregation, drift triggers.

const { CAPITAL_MARKET_ASSUMPTIONS, GLIDE_PATH_MATRIX, RISK_GUARDRAILS, ASSET_CLASSES } = require('../data/sampleData');
const { mean, percentile, normCdf, makeRng, randn, cholesky } = require('./mathUtils');

function horizonBucket(years) {
  if (years < 3) return 'short';
  if (years <= 7) return 'medium';
  return 'long';
}

// Apply risk-category guardrails to a base glide-path allocation by clipping + renormalising.
function applyGuardrails(baseWeights, riskCategory) {
  const guard = RISK_GUARDRAILS[riskCategory] || RISK_GUARDRAILS[3];
  const clipped = {};
  for (const ac of ASSET_CLASSES) {
    const [lo, hi] = guard[ac] || [0, 1];
    clipped[ac] = Math.min(hi, Math.max(lo, baseWeights[ac] || 0));
  }
  const sum = Object.values(clipped).reduce((a, b) => a + b, 0) || 1;
  const out = {};
  for (const ac of ASSET_CLASSES) out[ac] = clipped[ac] / sum;
  return out;
}

function portfolioMuSigma(weights) {
  const cma = CAPITAL_MARKET_ASSUMPTIONS;
  const w = ASSET_CLASSES.map((ac) => weights[ac] || 0);
  const mu = ASSET_CLASSES.reduce((s, ac, i) => s + w[i] * cma.expectedReturn[ac], 0);
  let variance = 0;
  for (let i = 0; i < ASSET_CLASSES.length; i++) {
    for (let j = 0; j < ASSET_CLASSES.length; j++) {
      const covIJ = cma.correlation[i][j] * cma.volatility[ASSET_CLASSES[i]] * cma.volatility[ASSET_CLASSES[j]];
      variance += w[i] * w[j] * covIJ;
    }
  }
  return { mu, sigma: Math.sqrt(Math.max(variance, 0)) };
}

// Analytic probability of ending wealth >= requiredCorpus under a lognormal-ish approximation
// of accumulated wealth with periodic contributions, using a fast Monte Carlo of terminal values
// (cheap: only the terminal draw is simulated, not a full path) for use inside the SIP goal-seek loop.
function probabilityOfSuccess(currentWealth, monthlySip, lumpSumToday, years, mu, sigma, requiredCorpus, rng, nSims = 4000) {
  const months = Math.round(years * 12);
  const monthlyMu = mu / 12;
  const monthlySigma = sigma / Math.sqrt(12);
  let successes = 0;
  const terminals = [];
  for (let s = 0; s < nSims; s++) {
    let wealth = currentWealth + lumpSumToday;
    for (let m = 0; m < months; m++) {
      const r = monthlyMu + monthlySigma * randn(rng);
      wealth = (wealth + monthlySip) * (1 + r);
    }
    terminals.push(wealth);
    if (wealth >= requiredCorpus) successes++;
  }
  terminals.sort((a, b) => a - b);
  return { probability: successes / nSims, terminals };
}

function requiredCorpusFor(goal) {
  const inflation = goal.inflation != null ? goal.inflation : 0.06;
  return goal.targetAmount * Math.pow(1 + inflation, goal.horizonYears);
}

// Goal-seek: bisect the additional monthly SIP needed to reach targetProbability.
function solveSipForTarget(currentWealth, lumpSum, years, mu, sigma, requiredCorpus, targetProbability, rng) {
  let lo = 0, hi = requiredCorpus / Math.max(years * 12, 1); // generous upper bound
  let bestSip = hi;
  for (let iter = 0; iter < 20; iter++) {
    const mid = (lo + hi) / 2;
    const { probability } = probabilityOfSuccess(currentWealth, mid, lumpSum, years, mu, sigma, requiredCorpus, rng, 800);
    if (probability >= targetProbability) {
      bestSip = mid;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return Math.round(bestSip);
}

function runGoalAllocation(input) {
  const {
    goals = [],
    riskCategory = 3,
    targetSuccessProbability = 0.80,
    driftBandAbs = 0.05,
    seed = 42,
  } = input;

  const rng = makeRng(seed);
  const goalAllocations = [];
  const scenarioPaths = [];
  const aggregatedWeights = ASSET_CLASSES.reduce((o, ac) => ({ ...o, [ac]: 0 }), {});
  let totalWeight = 0;

  for (const goal of goals) {
    const bucket = horizonBucket(goal.horizonYears);
    const base = GLIDE_PATH_MATRIX[bucket];
    const weights = applyGuardrails(base, riskCategory);
    const { mu, sigma } = portfolioMuSigma(weights);
    const requiredCorpus = requiredCorpusFor(goal);
    const currentWealth = goal.currentValue || 0;
    const lumpSum = goal.lumpSum || 0;
    let monthlySip = goal.monthlySip || 0;

    let { probability, terminals } = probabilityOfSuccess(
      currentWealth, monthlySip, lumpSum, goal.horizonYears, mu, sigma, requiredCorpus, rng
    );

    let recommendedSip = monthlySip;
    if (probability < targetSuccessProbability) {
      recommendedSip = solveSipForTarget(currentWealth, lumpSum, goal.horizonYears, mu, sigma, requiredCorpus, targetSuccessProbability, rng);
      const resolved = probabilityOfSuccess(currentWealth, recommendedSip, lumpSum, goal.horizonYears, mu, sigma, requiredCorpus, rng);
      probability = resolved.probability;
      terminals = resolved.terminals;
    }

    const goalAttainmentScore = Math.min(100, Math.round((probability / targetSuccessProbability) * 100));

    // Build a simplified percentile wealth path (annual steps) using the analytic mu/sigma for charting.
    const years = Math.max(1, Math.round(goal.horizonYears));
    const pathRng = makeRng(seed + goals.indexOf(goal) + 1);
    const nPaths = 500;
    const annualPaths = Array.from({ length: nPaths }, () => {
      let w = currentWealth + lumpSum;
      const path = [w];
      for (let y = 0; y < years; y++) {
        let yearWealth = w;
        for (let m = 0; m < 12; m++) {
          const r = mu / 12 + (sigma / Math.sqrt(12)) * randn(pathRng);
          yearWealth = (yearWealth + monthlySip) * (1 + r);
        }
        w = yearWealth;
        path.push(w);
      }
      return path;
    });
    const percentileSeries = { p5: [], p25: [], p50: [], p75: [], p95: [] };
    for (let y = 0; y <= years; y++) {
      const vals = annualPaths.map((p) => p[y]).sort((a, b) => a - b);
      percentileSeries.p5.push(Math.round(percentile(vals, 0.05)));
      percentileSeries.p25.push(Math.round(percentile(vals, 0.25)));
      percentileSeries.p50.push(Math.round(percentile(vals, 0.50)));
      percentileSeries.p75.push(Math.round(percentile(vals, 0.75)));
      percentileSeries.p95.push(Math.round(percentile(vals, 0.95)));
    }
    scenarioPaths.push({ goalName: goal.name, years, series: percentileSeries });

    goalAllocations.push({
      goalName: goal.name,
      horizonBucket: bucket,
      recommendedWeights: weights,
      requiredCorpus: Math.round(requiredCorpus),
      currentValue: currentWealth,
      requiredMonthlySip: recommendedSip,
      inputMonthlySip: monthlySip,
      goalAttainmentScore,
      probability,
    });

    const goalWeight = requiredCorpus; // weight household aggregation by required corpus
    totalWeight += goalWeight;
    for (const ac of ASSET_CLASSES) aggregatedWeights[ac] += weights[ac] * goalWeight;
  }

  const householdAllocation = {};
  for (const ac of ASSET_CLASSES) householdAllocation[ac] = totalWeight ? aggregatedWeights[ac] / totalWeight : 0;

  const rebalancingTriggers = [];
  for (const g of goalAllocations) {
    if (g.probability < targetSuccessProbability) {
      rebalancingTriggers.push({
        type: 'probability', goal: g.goalName, threshold: targetSuccessProbability,
        currentValue: Number(g.probability.toFixed(3)),
      });
    }
  }
  for (const ac of ASSET_CLASSES) {
    // Illustrative: flag if household weight for an asset class is at a guardrail edge (proxy for realised drift).
    const guard = RISK_GUARDRAILS[riskCategory][ac];
    if (householdAllocation[ac] >= guard[1] - 0.001 || householdAllocation[ac] <= guard[0] + 0.001) {
      rebalancingTriggers.push({ type: 'drift', assetClass: ac, band: driftBandAbs, currentValue: Number(householdAllocation[ac].toFixed(3)) });
    }
  }

  return {
    goalAllocations,
    householdAllocation,
    rebalancingTriggers,
    scenarioPaths,
    assumptionSet: CAPITAL_MARKET_ASSUMPTIONS,
  };
}

module.exports = { runGoalAllocation, horizonBucket, applyGuardrails, portfolioMuSigma, requiredCorpusFor };
