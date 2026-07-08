// Browser bundle of all Module 4 model logic + sample data.
// This is a direct, dependency-free port of the Node/Express version's
// src/data/sampleData.js, src/models/*.js and src/routes/*.js sample payloads
// into a single in-browser namespace (window.WISModels), so the whole app
// runs as static files with no backend -- deployable on Netlify Drop, etc.
(function (global) {
  'use strict';

  // ============================== mathUtils ==============================
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) { return mulberry32(seed == null ? Date.now() % 2147483647 : seed); }
  function randn(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
  function percentile(sortedArr, p) {
    const idx = (sortedArr.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sortedArr[lo];
    return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
  }
  function matVec(A, v) { return A.map((row) => row.reduce((s, a, j) => s + a * v[j], 0)); }
  function transpose(A) { return A[0].map((_, j) => A.map((row) => row[j])); }
  function addMat(A, B) { return A.map((row, i) => row.map((v, j) => v + B[i][j])); }
  function scaleMat(A, s) { return A.map((row) => row.map((v) => v * s)); }
  function matMul(A, B) {
    const n = A.length, m = B[0].length, k = B.length;
    const C = Array.from({ length: n }, () => new Array(m).fill(0));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++) {
        let s = 0;
        for (let p = 0; p < k; p++) s += A[i][p] * B[p][j];
        C[i][j] = s;
      }
    return C;
  }
  function invert(Ain) {
    const n = Ain.length;
    const A = Ain.map((row) => row.slice());
    const I = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
      if (Math.abs(A[pivot][col]) < 1e-10) A[pivot][col] += 1e-8;
      [A[col], A[pivot]] = [A[pivot], A[col]];
      [I[col], I[pivot]] = [I[pivot], I[col]];
      const pv = A[col][col];
      for (let j = 0; j < n; j++) { A[col][j] /= pv; I[col][j] /= pv; }
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = A[r][col];
        for (let j = 0; j < n; j++) { A[r][j] -= factor * A[col][j]; I[r][j] -= factor * I[col][j]; }
      }
    }
    return I;
  }
  function shrinkCovariance(Sigma, delta) {
    const n = Sigma.length;
    const avgVar = mean(Sigma.map((row, i) => row[i]));
    const F = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? avgVar : 0)));
    return addMat(scaleMat(F, delta), scaleMat(Sigma, 1 - delta));
  }
  function projectToSimplexBox(w, lb, ub) {
    let x = w.slice();
    for (let iter = 0; iter < 200; iter++) {
      x = x.map((v, i) => Math.min(ub[i], Math.max(lb[i], v)));
      const sum = x.reduce((a, b) => a + b, 0);
      const diff = (1 - sum) / x.length;
      x = x.map((v) => v + diff);
      const clipped = x.map((v, i) => Math.min(ub[i], Math.max(lb[i], v)));
      const err = Math.max(...clipped.map((v, i) => Math.abs(v - x[i])));
      x = clipped;
      if (err < 1e-9) break;
    }
    const sum = x.reduce((a, b) => a + b, 0) || 1;
    return x.map((v) => v / sum);
  }

  // ============================== sample data ==============================
  const ASSET_CLASSES = ['Equity', 'Debt', 'Gold', 'Cash', 'International'];
  const CAPITAL_MARKET_ASSUMPTIONS = {
    version: 'CMA-2026Q3-v1', effectiveDate: '2026-07-01', assetClasses: ASSET_CLASSES,
    expectedReturn: { Equity: 0.12, Debt: 0.07, Gold: 0.08, Cash: 0.045, International: 0.10 },
    volatility: { Equity: 0.19, Debt: 0.05, Gold: 0.15, Cash: 0.01, International: 0.17 },
    correlation: [
      [1.00, -0.10, 0.05, 0.00, 0.65],
      [-0.10, 1.00, 0.10, 0.20, -0.05],
      [0.05, 0.10, 1.00, 0.05, 0.20],
      [0.00, 0.20, 0.05, 1.00, 0.00],
      [0.65, -0.05, 0.20, 0.00, 1.00],
    ],
  };
  const GLIDE_PATH_MATRIX = {
    short: { Equity: 0.15, Debt: 0.45, Gold: 0.10, Cash: 0.30, International: 0.00 },
    medium: { Equity: 0.45, Debt: 0.35, Gold: 0.10, Cash: 0.05, International: 0.05 },
    long: { Equity: 0.60, Debt: 0.20, Gold: 0.08, Cash: 0.02, International: 0.10 },
  };
  const RISK_GUARDRAILS = {
    1: { Equity: [0, 0.25], Debt: [0.40, 0.80], Gold: [0, 0.15], Cash: [0.05, 0.40], International: [0, 0.05] },
    2: { Equity: [0.10, 0.40], Debt: [0.30, 0.65], Gold: [0, 0.15], Cash: [0.02, 0.25], International: [0, 0.10] },
    3: { Equity: [0.25, 0.55], Debt: [0.20, 0.55], Gold: [0, 0.15], Cash: [0.02, 0.15], International: [0, 0.15] },
    4: { Equity: [0.40, 0.70], Debt: [0.10, 0.40], Gold: [0, 0.12], Cash: [0, 0.10], International: [0, 0.20] },
    5: { Equity: [0.55, 0.85], Debt: [0, 0.25], Gold: [0, 0.10], Cash: [0, 0.08], International: [0, 0.25] },
  };
  const UNIVERSE = [
    { id: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', assetClass: 'Equity', expReturn: 0.14, vol: 0.24, esg: 62, carbon: 78, factors: { value: -0.2, quality: 0.8, momentum: 0.4, size: 1.2, lowvol: -0.3 } },
    { id: 'TCS', name: 'Tata Consultancy Services', sector: 'IT', assetClass: 'Equity', expReturn: 0.13, vol: 0.20, esg: 78, carbon: 12, factors: { value: -0.5, quality: 1.4, momentum: 0.2, size: 1.1, lowvol: 0.6 } },
    { id: 'HDFCBANK', name: 'HDFC Bank', sector: 'Financials', assetClass: 'Equity', expReturn: 0.135, vol: 0.22, esg: 70, carbon: 8, factors: { value: 0.3, quality: 1.0, momentum: -0.1, size: 1.0, lowvol: 0.2 } },
    { id: 'INFY', name: 'Infosys', sector: 'IT', assetClass: 'Equity', expReturn: 0.125, vol: 0.21, esg: 80, carbon: 10, factors: { value: -0.3, quality: 1.2, momentum: 0.3, size: 0.9, lowvol: 0.5 } },
    { id: 'ICICIBANK', name: 'ICICI Bank', sector: 'Financials', assetClass: 'Equity', expReturn: 0.14, vol: 0.23, esg: 65, carbon: 9, factors: { value: 0.4, quality: 0.9, momentum: 0.5, size: 0.8, lowvol: 0.0 } },
    { id: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'FMCG', assetClass: 'Equity', expReturn: 0.10, vol: 0.16, esg: 82, carbon: 20, factors: { value: -0.8, quality: 1.5, momentum: -0.2, size: 0.7, lowvol: 1.0 } },
    { id: 'ITC', name: 'ITC Ltd', sector: 'FMCG', assetClass: 'Equity', expReturn: 0.115, vol: 0.18, esg: 55, carbon: 35, factors: { value: 0.9, quality: 0.7, momentum: 0.1, size: 0.6, lowvol: 0.7 } },
    { id: 'LT', name: 'Larsen & Toubro', sector: 'Industrials', assetClass: 'Equity', expReturn: 0.135, vol: 0.24, esg: 60, carbon: 55, factors: { value: 0.2, quality: 0.6, momentum: 0.4, size: 0.9, lowvol: -0.4 } },
    { id: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom', assetClass: 'Equity', expReturn: 0.13, vol: 0.22, esg: 58, carbon: 40, factors: { value: 0.0, quality: 0.5, momentum: 0.6, size: 0.8, lowvol: -0.2 } },
    { id: 'SUNPHARMA', name: 'Sun Pharma', sector: 'Healthcare', assetClass: 'Equity', expReturn: 0.12, vol: 0.20, esg: 68, carbon: 25, factors: { value: -0.1, quality: 0.9, momentum: 0.0, size: 0.5, lowvol: 0.3 } },
    { id: 'NIFTYBEES', name: 'Nifty 50 ETF', sector: 'Diversified', assetClass: 'Equity', expReturn: 0.12, vol: 0.17, esg: 68, carbon: 30, factors: { value: 0.0, quality: 0.8, momentum: 0.1, size: 1.0, lowvol: 0.2 } },
    { id: 'GOLDBEES', name: 'Gold ETF', sector: 'Commodity', assetClass: 'Gold', expReturn: 0.08, vol: 0.15, esg: 50, carbon: 5, factors: { value: 0, quality: 0, momentum: 0, size: 0, lowvol: 1.5 } },
    { id: 'LIQUIDBEES', name: 'Liquid / Debt Fund', sector: 'Debt', assetClass: 'Debt', expReturn: 0.07, vol: 0.05, esg: 50, carbon: 2, factors: { value: 0, quality: 0, momentum: 0, size: 0, lowvol: 2.0 } },
  ];
  const BENCHMARK_WEIGHTS = {
    RELIANCE: 0.10, TCS: 0.08, HDFCBANK: 0.11, INFY: 0.07, ICICIBANK: 0.08,
    HINDUNILVR: 0.06, ITC: 0.05, LT: 0.06, BHARTIARTL: 0.05, SUNPHARMA: 0.04,
    NIFTYBEES: 0.20, GOLDBEES: 0.05, LIQUIDBEES: 0.05,
  };
  const SAMPLE_LOTS = [
    { id: 'L1', security: 'RELIANCE', qty: 40, costBasis: 2450, purchaseDate: '2024-02-10', currentPrice: 2870 },
    { id: 'L2', security: 'TCS', qty: 25, costBasis: 4100, purchaseDate: '2023-11-05', currentPrice: 3820 },
    { id: 'L3', security: 'HDFCBANK', qty: 60, costBasis: 1620, purchaseDate: '2025-01-20', currentPrice: 1590 },
    { id: 'L4', security: 'INFY', qty: 50, costBasis: 1550, purchaseDate: '2024-08-14', currentPrice: 1690 },
    { id: 'L5', security: 'ITC', qty: 200, costBasis: 460, purchaseDate: '2025-05-02', currentPrice: 430 },
    { id: 'L6', security: 'LT', qty: 20, costBasis: 3600, purchaseDate: '2024-12-18', currentPrice: 3420 },
    { id: 'L7', security: 'NIFTYBEES', qty: 300, costBasis: 240, purchaseDate: '2023-06-01', currentPrice: 268 },
    { id: 'L8', security: 'GOLDBEES', qty: 500, costBasis: 55, purchaseDate: '2024-04-22', currentPrice: 63 },
    { id: 'L9', security: 'LIQUIDBEES', qty: 1000, costBasis: 100, purchaseDate: '2025-03-11', currentPrice: 101.8 },
  ];
  const EXCLUSION_LIST = ['ITC'];
  const TAX_RULES = {
    equity: { shortTermMonths: 12, stcgRate: 0.20, ltcgRate: 0.125, ltcgExemption: 125000 },
    debt: { shortTermMonths: 24, stcgRate: 0.30, ltcgRate: 0.20 },
    washSaleWindowDays: 30,
  };
  const MODEL_PORTFOLIO_LIBRARY = {
    1: { name: 'Capital Preservation', weights: { Equity: 0.15, Debt: 0.55, Gold: 0.10, Cash: 0.20, International: 0.00 } },
    2: { name: 'Conservative Growth', weights: { Equity: 0.30, Debt: 0.45, Gold: 0.10, Cash: 0.10, International: 0.05 } },
    3: { name: 'Balanced Growth', weights: { Equity: 0.45, Debt: 0.32, Gold: 0.10, Cash: 0.05, International: 0.08 } },
    4: { name: 'Growth', weights: { Equity: 0.58, Debt: 0.20, Gold: 0.08, Cash: 0.02, International: 0.12 } },
    5: { name: 'Aggressive Growth', weights: { Equity: 0.72, Debt: 0.08, Gold: 0.05, Cash: 0.00, International: 0.15 } },
  };

  // ============================== UC1: Goal-Based Asset Allocation ==============================
  function horizonBucket(years) { if (years < 3) return 'short'; if (years <= 7) return 'medium'; return 'long'; }
  function applyGuardrails(baseWeights, riskCategory) {
    const guard = RISK_GUARDRAILS[riskCategory] || RISK_GUARDRAILS[3];
    const clipped = {};
    for (const ac of ASSET_CLASSES) { const [lo, hi] = guard[ac] || [0, 1]; clipped[ac] = Math.min(hi, Math.max(lo, baseWeights[ac] || 0)); }
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
    for (let i = 0; i < ASSET_CLASSES.length; i++)
      for (let j = 0; j < ASSET_CLASSES.length; j++) {
        const covIJ = cma.correlation[i][j] * cma.volatility[ASSET_CLASSES[i]] * cma.volatility[ASSET_CLASSES[j]];
        variance += w[i] * w[j] * covIJ;
      }
    return { mu, sigma: Math.sqrt(Math.max(variance, 0)) };
  }
  function probabilityOfSuccess(currentWealth, monthlySip, lumpSumToday, years, mu, sigma, requiredCorpus, rng, nSims) {
    nSims = nSims || 4000;
    const months = Math.round(years * 12);
    const monthlyMu = mu / 12, monthlySigma = sigma / Math.sqrt(12);
    let successes = 0; const terminals = [];
    for (let s = 0; s < nSims; s++) {
      let wealth = currentWealth + lumpSumToday;
      for (let m = 0; m < months; m++) { const r = monthlyMu + monthlySigma * randn(rng); wealth = (wealth + monthlySip) * (1 + r); }
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
  function solveSipForTarget(currentWealth, lumpSum, years, mu, sigma, requiredCorpus, targetProbability, rng) {
    let lo = 0, hi = requiredCorpus / Math.max(years * 12, 1);
    let bestSip = hi;
    for (let iter = 0; iter < 20; iter++) {
      const mid = (lo + hi) / 2;
      const { probability } = probabilityOfSuccess(currentWealth, mid, lumpSum, years, mu, sigma, requiredCorpus, rng, 800);
      if (probability >= targetProbability) { bestSip = mid; hi = mid; } else { lo = mid; }
    }
    return Math.round(bestSip);
  }
  function runGoalAllocation(input) {
    const { goals = [], riskCategory = 3, targetSuccessProbability = 0.80, driftBandAbs = 0.05, seed = 42 } = input;
    const rng = makeRng(seed);
    const goalAllocations = []; const scenarioPaths = [];
    const aggregatedWeights = ASSET_CLASSES.reduce((o, ac) => ({ ...o, [ac]: 0 }), {});
    let totalWeight = 0;
    for (const goal of goals) {
      const bucket = horizonBucket(goal.horizonYears);
      const weights = applyGuardrails(GLIDE_PATH_MATRIX[bucket], riskCategory);
      const { mu, sigma } = portfolioMuSigma(weights);
      const requiredCorpus = requiredCorpusFor(goal);
      const currentWealth = goal.currentValue || 0, lumpSum = goal.lumpSum || 0;
      let monthlySip = goal.monthlySip || 0;
      let { probability } = probabilityOfSuccess(currentWealth, monthlySip, lumpSum, goal.horizonYears, mu, sigma, requiredCorpus, rng);
      let recommendedSip = monthlySip;
      if (probability < targetSuccessProbability) {
        recommendedSip = solveSipForTarget(currentWealth, lumpSum, goal.horizonYears, mu, sigma, requiredCorpus, targetSuccessProbability, rng);
        probability = probabilityOfSuccess(currentWealth, recommendedSip, lumpSum, goal.horizonYears, mu, sigma, requiredCorpus, rng).probability;
      }
      const goalAttainmentScore = Math.min(100, Math.round((probability / targetSuccessProbability) * 100));
      const years = Math.max(1, Math.round(goal.horizonYears));
      const pathRng = makeRng(seed + goals.indexOf(goal) + 1);
      const nPaths = 500;
      const annualPaths = Array.from({ length: nPaths }, () => {
        let w = currentWealth + lumpSum; const path = [w];
        for (let y = 0; y < years; y++) {
          let yearWealth = w;
          for (let m = 0; m < 12; m++) { const r = mu / 12 + (sigma / Math.sqrt(12)) * randn(pathRng); yearWealth = (yearWealth + monthlySip) * (1 + r); }
          w = yearWealth; path.push(w);
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
        goalName: goal.name, horizonBucket: bucket, recommendedWeights: weights,
        requiredCorpus: Math.round(requiredCorpus), currentValue: currentWealth,
        requiredMonthlySip: recommendedSip, inputMonthlySip: monthlySip, goalAttainmentScore, probability,
      });
      const goalWeight = requiredCorpus; totalWeight += goalWeight;
      for (const ac of ASSET_CLASSES) aggregatedWeights[ac] += weights[ac] * goalWeight;
    }
    const householdAllocation = {};
    for (const ac of ASSET_CLASSES) householdAllocation[ac] = totalWeight ? aggregatedWeights[ac] / totalWeight : 0;
    const rebalancingTriggers = [];
    for (const g of goalAllocations) {
      if (g.probability < targetSuccessProbability) rebalancingTriggers.push({ type: 'probability', goal: g.goalName, threshold: targetSuccessProbability, currentValue: Number(g.probability.toFixed(3)) });
    }
    for (const ac of ASSET_CLASSES) {
      const guard = RISK_GUARDRAILS[riskCategory][ac];
      if (householdAllocation[ac] >= guard[1] - 0.001 || householdAllocation[ac] <= guard[0] + 0.001) {
        rebalancingTriggers.push({ type: 'drift', assetClass: ac, band: driftBandAbs, currentValue: Number(householdAllocation[ac].toFixed(3)) });
      }
    }
    return { goalAllocations, householdAllocation, rebalancingTriggers, scenarioPaths, assumptionSet: CAPITAL_MARKET_ASSUMPTIONS };
  }

  // ============================== UC2: Monte Carlo Retirement Simulation ==============================
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
    const { currentCorpus, accumulationYears, decumulationYears, monthlyContribution, annualWithdrawal,
      inflationMean, inflationVol, accumulationWeights, decumulationWeights, taxRateOnGains, shockProbability, shockSize } = params;
    const { mu: muAcc, sigma: sigAcc } = blendedMuSigma(accumulationWeights);
    const { mu: muDec, sigma: sigDec } = blendedMuSigma(decumulationWeights);
    let wealth = currentCorpus;
    const totalYears = accumulationYears + decumulationYears;
    const yearlyWealth = [wealth]; let depleted = false, depletionYear = null, inflationIndex = 1;
    const yearReturns = [];
    for (let y = 0; y < totalYears; y++) {
      const inAccumulation = y < accumulationYears;
      const { mu, sigma } = inAccumulation ? { mu: muAcc, sigma: sigAcc } : { mu: muDec, sigma: sigDec };
      yearReturns.push(mu + sigma * randn(rng));
    }
    if (shockOrderBias === 'front') yearReturns.sort((a, b) => a - b);
    else if (shockOrderBias === 'back') yearReturns.sort((a, b) => b - a);
    for (let y = 0; y < totalYears; y++) {
      const inAccumulation = y < accumulationYears;
      const inflation = inflationMean + inflationVol * randn(rng);
      inflationIndex *= (1 + inflation);
      const r = yearReturns[y];
      if (inAccumulation) { wealth = (wealth + monthlyContribution * 12) * (1 + r); }
      else {
        const realWithdrawal = (withdrawalOverride != null ? withdrawalOverride : annualWithdrawal) * inflationIndex;
        let shock = 0; if (rng() < shockProbability) shock = shockSize;
        wealth = (wealth - realWithdrawal - shock) * (1 + r);
        wealth -= Math.max(0, wealth) * taxRateOnGains * 0.15;
      }
      if (wealth <= 0) { wealth = 0; if (!depleted) { depleted = true; depletionYear = y; } }
      yearlyWealth.push(wealth);
    }
    return { yearlyWealth, depleted, depletionYear, terminalWealth: wealth };
  }
  function runMonteCarlo(input) {
    const {
      currentCorpus = 5000000, accumulationYears = 15, decumulationYears = 25, monthlyContribution = 25000,
      annualWithdrawal = 420000, inflationMean = 0.06, inflationVol = 0.015,
      accumulationWeights = { Equity: 0.65, Debt: 0.25, Gold: 0.05, Cash: 0.05, International: 0.0 },
      decumulationWeights = { Equity: 0.35, Debt: 0.50, Gold: 0.10, Cash: 0.05, International: 0.0 },
      taxRateOnGains = 0.125, shockProbability = 0.03, shockSize = 300000, pathCount = 3000,
      targetSuccessProbability = 0.85, seed = 7,
    } = input;
    const rng = makeRng(seed);
    const params = { currentCorpus, accumulationYears, decumulationYears, monthlyContribution, annualWithdrawal, inflationMean, inflationVol, accumulationWeights, decumulationWeights, taxRateOnGains, shockProbability, shockSize };
    const totalYears = accumulationYears + decumulationYears;
    const allPaths = []; let successes = 0; const depletionAges = [];
    for (let s = 0; s < pathCount; s++) {
      const { yearlyWealth, depleted, depletionYear } = simulateOnce(params, rng);
      allPaths.push(yearlyWealth);
      if (!depleted) successes++; else depletionAges.push(accumulationYears + depletionYear);
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
    const swrRng = makeRng(seed + 1);
    let lo = 0, hi = currentCorpus * 0.15, bestWithdrawal = 0;
    for (let iter = 0; iter < 16; iter++) {
      const mid = (lo + hi) / 2; let succ = 0; const trials = 400;
      for (let s = 0; s < trials; s++) if (!simulateOnce(params, swrRng, mid).depleted) succ++;
      const p = succ / trials;
      if (p >= targetSuccessProbability) { bestWithdrawal = mid; lo = mid; } else { hi = mid; }
    }
    const safeWithdrawalRate = currentCorpus > 0 ? bestWithdrawal / currentCorpus : 0;
    const seqRng1 = makeRng(seed + 2), seqRng2 = makeRng(seed + 3);
    const trialsSeq = 500; let frontSucc = 0, backSucc = 0;
    for (let s = 0; s < trialsSeq; s++) {
      if (!simulateOnce(params, seqRng1, null, 'front').depleted) frontSucc++;
      if (!simulateOnce(params, seqRng2, null, 'back').depleted) backSucc++;
    }
    const sequenceRiskDelta = (backSucc - frontSucc) / trialsSeq;
    const depletionAgeDist = depletionAges.length
      ? { count: depletionAges.length, min: Math.min(...depletionAges), median: percentile([...depletionAges].sort((a, b) => a - b), 0.5), max: Math.max(...depletionAges) }
      : { count: 0, min: null, median: null, max: null };
    return {
      successProbability, percentileWealthPaths, safeWithdrawalRate, depletionAgeDist, sequenceRiskDelta,
      runManifest: { assumptions: CAPITAL_MARKET_ASSUMPTIONS.version, pathCount, seed, model: 'iid-normal-per-asset-class', timestamp: new Date().toISOString() },
    };
  }

  // ============================== UC3: Mean-Variance & Factor Optimization ==============================
  function buildUniverse(ids) { return ids && ids.length ? UNIVERSE.filter((u) => ids.includes(u.id)) : UNIVERSE; }
  function buildCovariance(universe) {
    const n = universe.length;
    const Sigma = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) { Sigma[i][j] = universe[i].vol * universe[i].vol; continue; }
      let corr = 0.15;
      if (universe[i].sector === universe[j].sector) corr += 0.35;
      if (universe[i].assetClass === universe[j].assetClass) corr += 0.15;
      corr = Math.min(corr, 0.9);
      if (universe[i].assetClass !== universe[j].assetClass) corr *= 0.4;
      Sigma[i][j] = corr * universe[i].vol * universe[j].vol;
    }
    return Sigma;
  }
  function blackLitterman(priorReturns, Sigma, views, tau) {
    tau = tau || 0.05;
    if (!views || !views.length) return priorReturns.slice();
    const n = priorReturns.length;
    const P = views.map((v) => { const row = new Array(n).fill(0); row[v.assetIndex] = 1; return row; });
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
    const PtOmegaInv = matMul(Pt, OmegaInv);
    const PtOmegaInvP = matMul(PtOmegaInv, P);
    const A = tauSigmaInv.map((row, i) => row.map((v, j) => v + PtOmegaInvP[i][j]));
    const AInv = invert(A);
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
    for (let i = 0; i < w.length; i++) for (let j = 0; j < w.length; j++) variance += w[i] * w[j] * Sigma[i][j];
    return { ret, vol: Math.sqrt(Math.max(variance, 0)) };
  }
  function optimize(universe, mu, Sigma, opts) {
    const n = universe.length;
    const {
      objective = 'maxSharpe', targetReturn = null, lb = new Array(n).fill(0), ub = new Array(n).fill(0.35),
      sectorCaps = {}, riskAversion = 3, iterations = 600, lr = 0.05, factorTargets = null,
      turnoverCap = null, currentWeights = null, esgScores = null, esgMin = null, carbonScores = null,
      carbonMax = null, benchmarkWeights = null, teMax = null,
    } = opts;
    let w = projectToSimplexBox(new Array(n).fill(1 / n), lb, ub);
    function sectorPenaltyGrad(w) {
      const grad = new Array(n).fill(0); const sectorSums = {};
      universe.forEach((u, i) => { sectorSums[u.sector] = (sectorSums[u.sector] || 0) + w[i]; });
      for (const [sector, cap] of Object.entries(sectorCaps)) {
        const sum = sectorSums[sector] || 0;
        if (sum > cap) universe.forEach((u, i) => { if (u.sector === sector) grad[i] += 2 * (sum - cap); });
      }
      return grad;
    }
    function factorPenaltyGrad(w) {
      const grad = new Array(n).fill(0); if (!factorTargets) return grad;
      for (const [factor, range] of Object.entries(factorTargets)) {
        let exposure = 0; universe.forEach((u, i) => { exposure += w[i] * (u.factors[factor] || 0); });
        if (range.min != null && exposure < range.min) universe.forEach((u, i) => { grad[i] += 2 * (exposure - range.min) * (u.factors[factor] || 0); });
        if (range.max != null && exposure > range.max) universe.forEach((u, i) => { grad[i] += 2 * (exposure - range.max) * (u.factors[factor] || 0); });
      }
      return grad;
    }
    function turnoverPenaltyGrad(w) {
      const grad = new Array(n).fill(0); if (!turnoverCap || !currentWeights) return grad;
      const turnover = w.reduce((s, wi, i) => s + Math.abs(wi - currentWeights[i]), 0);
      if (turnover > turnoverCap) w.forEach((wi, i) => { grad[i] += 2 * Math.sign(wi - currentWeights[i]) * (turnover - turnoverCap); });
      return grad;
    }
    function esgPenaltyGrad(w) {
      const grad = new Array(n).fill(0); if (!esgScores || esgMin == null) return grad;
      const weightedEsg = w.reduce((s, wi, i) => s + wi * esgScores[i], 0);
      if (weightedEsg < esgMin) w.forEach((wi, i) => { grad[i] += 2 * (weightedEsg - esgMin) * esgScores[i]; });
      return grad;
    }
    function carbonPenaltyGrad(w) {
      const grad = new Array(n).fill(0); if (!carbonScores || carbonMax == null) return grad;
      const weightedCarbon = w.reduce((s, wi, i) => s + wi * carbonScores[i], 0);
      if (weightedCarbon > carbonMax) w.forEach((wi, i) => { grad[i] += 2 * (weightedCarbon - carbonMax) * carbonScores[i]; });
      return grad;
    }
    function trackingErrorPenaltyGrad(w) {
      const grad = new Array(n).fill(0); if (!benchmarkWeights || teMax == null) return grad;
      const active = w.map((wi, i) => wi - benchmarkWeights[i]);
      const Sa = matVec(Sigma, active);
      const teVar = active.reduce((s, a, i) => s + a * Sa[i], 0);
      const te = Math.sqrt(Math.max(teVar, 0));
      if (te > teMax) Sa.forEach((v, i) => { grad[i] += 2 * (te - teMax) * v; });
      return grad;
    }
    for (let iter = 0; iter < iterations; iter++) {
      const Sw = matVec(Sigma, w); let grad;
      if (objective === 'minVariance') grad = Sw.map((v) => -2 * v);
      else if (objective === 'targetReturn') {
        const { ret } = portfolioStats(w, mu, Sigma);
        const retPenalty = 50 * (ret - (targetReturn != null ? targetReturn : ret));
        grad = Sw.map((v, i) => -2 * v + retPenalty * mu[i]);
      } else grad = mu.map((m, i) => m - riskAversion * Sw[i]);
      const secGrad = sectorPenaltyGrad(w), facGrad = factorPenaltyGrad(w), turnGrad = turnoverPenaltyGrad(w);
      const esgGrad = esgPenaltyGrad(w), carbonGrad = carbonPenaltyGrad(w), teGrad = trackingErrorPenaltyGrad(w);
      const step = grad.map((g, i) => g - secGrad[i] - facGrad[i] - turnGrad[i] - esgGrad[i] - carbonGrad[i] - teGrad[i]);
      w = w.map((wi, i) => wi + lr * step[i]);
      w = projectToSimplexBox(w, lb, ub);
    }
    return w;
  }
  function computeFrontier(universe, mu, Sigma, opts, points) {
    points = points || 12;
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
      universeIds = null, objective = 'maxSharpe', riskFreeRate = 0.065, shrinkageIntensity = 0.3,
      useBlackLitterman = false, views = [], sectorCaps = {}, boxMax = 0.35, riskAversion = 3,
      turnoverCap = null, currentHoldings = {}, transactionCostBps = 15,
    } = input;
    const universe = buildUniverse(universeIds);
    const n = universe.length;
    const priorReturns = universe.map((u) => u.expReturn);
    const sampleSigma = buildCovariance(universe);
    const Sigma = shrinkCovariance(sampleSigma, shrinkageIntensity);
    const viewsIdx = views.map((v) => ({ assetIndex: universe.findIndex((u) => u.id === v.assetId), viewReturn: v.viewReturn, confidence: v.confidence })).filter((v) => v.assetIndex >= 0);
    const mu = useBlackLitterman ? blackLitterman(priorReturns, Sigma, viewsIdx) : priorReturns;
    const currentWeights = universe.map((u) => currentHoldings[u.id] || 0);
    const lb = new Array(n).fill(0), ub = new Array(n).fill(boxMax);
    const optOpts = { objective, riskFreeRate, lb, ub, sectorCaps, riskAversion, turnoverCap, currentWeights };
    const optimalWeights = optimize(universe, mu, Sigma, optOpts);
    const { ret, vol } = portfolioStats(optimalWeights, mu, Sigma);
    const sharpe = vol > 0 ? (ret - riskFreeRate) / vol : 0;
    const efficientFrontier = computeFrontier(universe, mu, Sigma, { lb, ub, sectorCaps });
    const currentStats = portfolioStats(currentWeights, mu, Sigma);
    const factorReport = {};
    ['value', 'quality', 'momentum', 'size', 'lowvol'].forEach((f) => { factorReport[f] = universe.reduce((s, u, i) => s + optimalWeights[i] * (u.factors[f] || 0), 0); });
    const tradeList = universe.map((u, i) => {
      const delta = optimalWeights[i] - currentWeights[i];
      return { security: u.id, name: u.name, currentWeight: currentWeights[i], targetWeight: Number(optimalWeights[i].toFixed(4)), delta: Number(delta.toFixed(4)), side: delta > 0.0005 ? 'BUY' : delta < -0.0005 ? 'SELL' : 'HOLD', estimatedCostBps: Math.abs(delta) * transactionCostBps * 100 };
    }).filter((t) => t.side !== 'HOLD');
    const turnover = tradeList.reduce((s, t) => s + Math.abs(t.delta), 0);
    const estimatedCost = tradeList.reduce((s, t) => s + Math.abs(t.delta) * (transactionCostBps / 10000), 0);
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
      universe: universe.map((u) => ({ id: u.id, name: u.name, sector: u.sector })),
      optimalWeights: universe.map((u, i) => ({ security: u.id, weight: Number(optimalWeights[i].toFixed(4)) })),
      efficientFrontier, currentPortfolio: { return: currentStats.ret, risk: currentStats.vol }, factorReport, tradeList,
      riskMetrics: { expectedReturn: ret, volatility: vol, sharpe, diversificationRatio, turnover, estimatedCost },
      feasibility, muUsed: useBlackLitterman ? 'black-litterman-blended' : 'house-view-prior',
    };
  }

  // ============================== UC4: Dynamic Rebalancing Engine ==============================
  function monthsBetween(dateStr, asOf) {
    const d = new Date(dateStr), now = asOf ? new Date(asOf) : new Date();
    return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  }
  function lotTaxRate(lot, asOf) {
    const held = monthsBetween(lot.purchaseDate, asOf);
    const isLongTerm = held >= TAX_RULES.equity.shortTermMonths;
    return { isLongTerm, rate: isLongTerm ? TAX_RULES.equity.ltcgRate : TAX_RULES.equity.stcgRate };
  }
  function aggregateBySecurity(lots) {
    const bySecurity = {};
    for (const lot of lots) { if (!bySecurity[lot.security]) bySecurity[lot.security] = []; bySecurity[lot.security].push(lot); }
    return bySecurity;
  }
  function currentValueAndWeights(lots) {
    const bySecurity = aggregateBySecurity(lots);
    const values = {}; let total = 0;
    for (const [sec, secLots] of Object.entries(bySecurity)) { const val = secLots.reduce((s, l) => s + l.qty * l.currentPrice, 0); values[sec] = val; total += val; }
    const weights = {};
    for (const sec of Object.keys(values)) weights[sec] = total ? values[sec] / total : 0;
    return { values, weights, total, bySecurity };
  }
  function runRebalancing(input) {
    const {
      lots = [], targetWeights = {}, driftBandAbs = 0.03, driftBandRel = 0.20, policy = 'threshold',
      cashflow = 0, transactionCostBps = 10, minTradeValue = 5000, asOfDate = null,
    } = input;
    const { values, weights, total, bySecurity } = currentValueAndWeights(lots);
    const allSecurities = new Set([...Object.keys(weights), ...Object.keys(targetWeights)]);
    const driftAlerts = [];
    for (const sec of allSecurities) {
      const actual = weights[sec] || 0, target = targetWeights[sec] || 0, drift = actual - target;
      const relDrift = target > 0 ? Math.abs(drift) / target : (actual > 0 ? 1 : 0);
      const breach = Math.abs(drift) > driftBandAbs || relDrift > driftBandRel;
      driftAlerts.push({ security: sec, currentWeight: Number(actual.toFixed(4)), targetWeight: Number(target.toFixed(4)), drift: Number(drift.toFixed(4)), band: driftBandAbs, breach });
    }
    const anyBreach = driftAlerts.some((d) => d.breach);
    const rebalanceTriggered = policy === 'calendar' ? true : anyBreach;
    const tradeList = []; let cashRemaining = cashflow; const newTotal = total + cashflow;
    let taxImpact = { totalTax: 0, bucket: 'n/a' };
    if (rebalanceTriggered) {
      const underweights = driftAlerts.filter((d) => d.drift < 0).sort((a, b) => a.drift - b.drift);
      for (const u of underweights) {
        if (cashRemaining <= 0) break;
        const targetValue = u.targetWeight * newTotal, currentValue = values[u.security] || 0;
        const gap = Math.max(0, targetValue - currentValue);
        const buyAmount = Math.min(gap, cashRemaining);
        if (buyAmount >= minTradeValue) { tradeList.push({ security: u.security, side: 'BUY', amount: Math.round(buyAmount), source: 'cashflow', taxImpact: 0, estimatedCost: Math.round(buyAmount * transactionCostBps / 10000) }); cashRemaining -= buyAmount; }
      }
      let taxImpactTotal = 0;
      for (const d of driftAlerts) {
        if (!d.breach) continue;
        const targetValue = d.targetWeight * newTotal, currentValue = values[d.security] || 0, gapValue = currentValue - targetValue;
        if (gapValue > minTradeValue) {
          const secLots = (bySecurity[d.security] || []).slice();
          secLots.sort((a, b) => {
            const glA = (a.currentPrice - a.costBasis), glB = (b.currentPrice - b.costBasis);
            const scoreA = glA < 0 ? -1000 + glA : (lotTaxRate(a, asOfDate).isLongTerm ? 0 : 1000) + glA;
            const scoreB = glB < 0 ? -1000 + glB : (lotTaxRate(b, asOfDate).isLongTerm ? 0 : 1000) + glB;
            return scoreA - scoreB;
          });
          let remainingToSell = gapValue;
          for (const lot of secLots) {
            if (remainingToSell <= 0) break;
            const lotValue = lot.qty * lot.currentPrice, sellValue = Math.min(lotValue, remainingToSell), sellQty = sellValue / lot.currentPrice;
            const { isLongTerm, rate } = lotTaxRate(lot, asOfDate);
            const gainPerUnit = lot.currentPrice - lot.costBasis, realizedGain = gainPerUnit * sellQty, tax = Math.max(0, realizedGain) * rate;
            taxImpactTotal += tax;
            tradeList.push({ security: d.security, side: 'SELL', amount: Math.round(sellValue), lotId: lot.id, holdingType: isLongTerm ? 'LTCG' : 'STCG', realizedGain: Math.round(realizedGain), taxImpact: Math.round(tax), estimatedCost: Math.round(sellValue * transactionCostBps / 10000) });
            remainingToSell -= sellValue;
          }
        } else if (gapValue < -minTradeValue && cashRemaining > 0) {
          const buyAmount = Math.min(-gapValue, cashRemaining);
          if (buyAmount >= minTradeValue) { tradeList.push({ security: d.security, side: 'BUY', amount: Math.round(buyAmount), source: 'residual-cash', taxImpact: 0, estimatedCost: Math.round(buyAmount * transactionCostBps / 10000) }); cashRemaining -= buyAmount; }
        }
      }
      taxImpact = { totalTax: Math.round(taxImpactTotal), bucket: 'STCG+LTCG blended' };
    }
    const postValues = { ...values };
    for (const t of tradeList) postValues[t.security] = (postValues[t.security] || 0) + (t.side === 'BUY' ? t.amount : -t.amount);
    const postTotal = Object.values(postValues).reduce((a, b) => a + b, 0) || 1;
    const postTradeWeights = {};
    for (const sec of allSecurities) postTradeWeights[sec] = Number(((postValues[sec] || 0) / postTotal).toFixed(4));
    const costEstimate = tradeList.reduce((s, t) => s + (t.estimatedCost || 0), 0);
    const alternativeTrades = tradeList.filter((t) => t.side === 'BUY');
    return {
      driftAlerts, rebalanceTriggered, tradeList, postTradeWeights, taxImpact, costEstimate,
      alternatives: [{ label: 'Tax-deferred (cash-flow only, tolerate residual drift)', tradeList: alternativeTrades, taxImpact: 0, note: 'Skips sell-side trades; relies on future cashflows and a wider drift tolerance to converge over time.' }],
      policy, currentTotal: total, postTotal,
    };
  }

  // ============================== UC5: Tax-Loss Harvesting ==============================
  function findSecurity(id) { return UNIVERSE.find((u) => u.id === id); }
  function factorSimilarity(a, b) {
    if (!a || !b) return 0;
    const keys = ['value', 'quality', 'momentum', 'size', 'lowvol'];
    let dist = 0; for (const k of keys) dist += Math.pow((a.factors[k] || 0) - (b.factors[k] || 0), 2);
    const maxDist = keys.length * 4;
    return Math.max(0, 1 - Math.sqrt(dist) / Math.sqrt(maxDist));
  }
  function trackingErrorEstimate(a, b) {
    if (!a || !b) return 1;
    const volDiff = Math.abs(a.vol - b.vol), sectorPenalty = a.sector === b.sector ? 0 : 0.06;
    return Number((volDiff * 0.5 + sectorPenalty).toFixed(4));
  }
  function runTaxLossHarvesting(input) {
    const {
      lots = [], realizedGainsYTD = { stcg: 0, ltcg: 0 }, washSaleWindowDays = TAX_RULES.washSaleWindowDays,
      minHarvestableLoss = 2000, recentlyPurchased = [], similarityWeight = 0.6, teWeight = 0.3, costWeight = 0.1,
      maxCarryForward = null, asOfDate = null,
    } = input;
    const now = asOfDate ? new Date(asOfDate) : new Date();
    const lossLots = [];
    for (const lot of lots) {
      const gainLoss = (lot.currentPrice - lot.costBasis) * lot.qty;
      if (gainLoss < -minHarvestableLoss) { const { isLongTerm, rate } = lotTaxRate(lot, asOfDate); lossLots.push({ ...lot, unrealizedLoss: gainLoss, isLongTerm, applicableRate: rate }); }
    }
    lossLots.forEach((l) => { l.taxBenefit = Math.abs(l.unrealizedLoss) * l.applicableRate; });
    lossLots.sort((a, b) => b.taxBenefit - a.taxBenefit);
    const complianceFlags = []; const sellBuyPairs = [];
    let harvestedSTCG = 0, harvestedLTCG = 0;
    let remainingSTCGOffset = realizedGainsYTD.stcg || 0, remainingLTCGOffset = realizedGainsYTD.ltcg || 0;
    for (const lot of lossLots) {
      const sold = findSecurity(lot.security);
      const recentBuy = recentlyPurchased.find((r) => r.security === lot.security);
      if (recentBuy) {
        const daysSince = Math.round((now - new Date(recentBuy.date)) / 86400000);
        if (daysSince < washSaleWindowDays) { complianceFlags.push({ security: lot.security, type: 'wash-sale-block', message: `Repurchase within ${washSaleWindowDays}d window (bought ${daysSince}d ago); harvesting blocked.` }); continue; }
      }
      let offsetBucket = lot.isLongTerm ? 'ltcg' : 'stcg';
      const available = offsetBucket === 'ltcg' ? remainingLTCGOffset : remainingSTCGOffset;
      const offsetAmount = Math.min(Math.abs(lot.unrealizedLoss), Math.max(available, 0));
      if (offsetBucket === 'ltcg') remainingLTCGOffset -= offsetAmount; else remainingSTCGOffset -= offsetAmount;
      if (lot.isLongTerm) harvestedLTCG += Math.abs(lot.unrealizedLoss); else harvestedSTCG += Math.abs(lot.unrealizedLoss);
      const candidates = UNIVERSE.filter((u) => u.id !== lot.security && u.assetClass === (sold ? sold.assetClass : u.assetClass));
      let best = null, bestScore = -Infinity;
      for (const c of candidates) {
        const sim = factorSimilarity(sold, c), te = trackingErrorEstimate(sold, c);
        const score = similarityWeight * sim - teWeight * te - costWeight * 0.001;
        if (score > bestScore) { bestScore = score; best = { ...c, similarity: Number(sim.toFixed(3)), trackingError: te }; }
      }
      sellBuyPairs.push({ sellLotId: lot.id, sellSecurity: lot.security, qty: lot.qty, unrealizedLoss: Math.round(lot.unrealizedLoss), holdingType: lot.isLongTerm ? 'LTCG' : 'STCG', taxBenefit: Math.round(lot.taxBenefit), replacement: best ? { security: best.id, name: best.name, similarity: best.similarity, trackingError: best.trackingError } : null });
    }
    const ytdTaxAlpha = Math.round(harvestedSTCG * TAX_RULES.equity.stcgRate + harvestedLTCG * TAX_RULES.equity.ltcgRate);
    const harvestReport = { lotsScanned: lots.length, lossLotsFound: lossLots.length, lossLotsHarvested: sellBuyPairs.length, totalRealizedLoss: Math.round(harvestedSTCG + harvestedLTCG), breakdown: { stcgLossHarvested: Math.round(harvestedSTCG), ltcgLossHarvested: Math.round(harvestedLTCG) } };
    const harvestCapacity = { remainingSTCGOffset: Math.round(Math.max(remainingSTCGOffset, 0)), remainingLTCGOffset: Math.round(Math.max(remainingLTCGOffset, 0)), carryForwardEligible: maxCarryForward != null ? Math.max(0, maxCarryForward - (harvestedSTCG + harvestedLTCG)) : null };
    const allocationDelta = {};
    for (const pair of sellBuyPairs) { const sold = findSecurity(pair.sellSecurity); if (sold) allocationDelta[sold.assetClass] = (allocationDelta[sold.assetClass] || 0); }
    return { harvestReport, sellBuyPairs, complianceFlags, ytdTaxAlpha, harvestCapacity, allocationDelta };
  }

  // ============================== UC6: ESG & Mandate-Constrained Optimization ==============================
  function runEsgOptimization(input) {
    const {
      universeIds = null, exclusions = EXCLUSION_LIST, esgMin = 65, carbonMax = 35, teMax = 0.06,
      boxMax = 0.30, shrinkageIntensity = 0.3, riskAversion = 3,
    } = input;
    const universe = buildUniverse(universeIds);
    const n = universe.length;
    const mu = universe.map((u) => u.expReturn);
    const sampleSigma = buildCovariance(universe);
    const Sigma = shrinkCovariance(sampleSigma, shrinkageIntensity);
    const esgScores = universe.map((u) => u.esg), carbonScores = universe.map((u) => u.carbon);
    const benchmarkWeights = universe.map((u) => BENCHMARK_WEIGHTS[u.id] || 0);
    const bmkSum = benchmarkWeights.reduce((a, b) => a + b, 0) || 1;
    const normBmk = benchmarkWeights.map((w) => w / bmkSum);
    const lb = new Array(n).fill(0), ub = universe.map((u) => (exclusions.includes(u.id) ? 0 : boxMax));
    const unconstrainedWeights = optimize(universe, mu, Sigma, { objective: 'maxSharpe', lb: new Array(n).fill(0), ub: new Array(n).fill(boxMax), riskAversion });
    const unconstrainedStats = portfolioStats(unconstrainedWeights, mu, Sigma);
    const esgWeights = optimize(universe, mu, Sigma, { objective: 'maxSharpe', lb, ub, riskAversion, esgScores, esgMin, carbonScores, carbonMax, benchmarkWeights: normBmk, teMax, iterations: 800 });
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
    const exclusionCompliance = { excludedNames: exclusions, allZeroWeight: exclusions.every((id) => { const idx = universe.findIndex((u) => u.id === id); return idx < 0 || esgWeights[idx] < 1e-6; }) };
    const esgReturnCost = Math.max(0, unconstrainedStats.ret - esgStats.ret);
    const sectorWeights = (weightsArr) => { const sw = {}; universe.forEach((u, i) => { sw[u.sector] = (sw[u.sector] || 0) + weightsArr[i]; }); return sw; };
    const esgSectors = sectorWeights(esgWeights), bmkSectors = sectorWeights(normBmk);
    const residualTilts = {};
    const allSectors = new Set([...Object.keys(esgSectors), ...Object.keys(bmkSectors)]);
    for (const s of allSectors) residualTilts[s] = Number(((esgSectors[s] || 0) - (bmkSectors[s] || 0)).toFixed(4));
    return {
      esgWeights: universe.map((u, i) => ({ security: u.id, weight: Number(esgWeights[i].toFixed(4)) })),
      esgCarbonReport: { portfolioEsg: Number(weightedEsg.toFixed(1)), portfolioCarbon: Number(weightedCarbon.toFixed(1)), benchmarkEsg: Number(bmkEsg.toFixed(1)), benchmarkCarbon: Number(bmkCarbon.toFixed(1)), unconstrainedEsg: Number(unconEsg.toFixed(1)), unconstrainedCarbon: Number(unconCarbon.toFixed(1)), esgMinConstraint: esgMin, carbonMaxConstraint: carbonMax, esgConstraintMet: weightedEsg >= esgMin - 0.5, carbonConstraintMet: weightedCarbon <= carbonMax + 0.5 },
      exclusionCompliance, trackingError: Number(trackingError.toFixed(4)), esgReturnCost: Number(esgReturnCost.toFixed(4)), residualTilts,
      comparison: { unconstrained: { return: unconstrainedStats.ret, risk: unconstrainedStats.vol }, esgConstrained: { return: esgStats.ret, risk: esgStats.vol } },
    };
  }

  // ============================== UC7: Robo-Advisory Engine ==============================
  function scoreQuestionnaire(responses) {
    const avg = (arr) => (arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 3);
    const toleranceScore = avg(responses.tolerance), capacityScore = avg(responses.capacity);
    const finalCategory = Math.max(1, Math.min(5, Math.round(Math.min(toleranceScore, capacityScore))));
    return { toleranceScore: Number(toleranceScore.toFixed(2)), capacityScore: Number(capacityScore.toFixed(2)), finalCategory };
  }
  function runRoboAdvisory(input) {
    const {
      riskQuestionnaire = { tolerance: [4, 3, 4], capacity: [3, 3, 4] }, goals = [], lots = [], cashflow = 0,
      targetSuccessProbability = 0.80, driftBandAbs = 0.03, rmOverride = null, seed = 11,
    } = input;
    const auditTrail = []; const now = new Date().toISOString();
    const riskScore = scoreQuestionnaire(riskQuestionnaire);
    let finalCategory = riskScore.finalCategory;
    auditTrail.push({ timestamp: now, action: 'risk-scored', detail: riskScore });
    if (rmOverride && rmOverride.category) { auditTrail.push({ timestamp: now, action: 'rm-override', detail: { from: finalCategory, to: rmOverride.category, rationale: rmOverride.rationale || 'not provided' } }); finalCategory = rmOverride.category; }
    const model = MODEL_PORTFOLIO_LIBRARY[finalCategory] || MODEL_PORTFOLIO_LIBRARY[3];
    auditTrail.push({ timestamp: now, action: 'model-assigned', detail: { category: finalCategory, model: model.name } });
    const goalAllocationResult = runGoalAllocation({ goals, riskCategory: finalCategory, targetSuccessProbability, driftBandAbs, seed });
    auditTrail.push({ timestamp: now, action: 'funding-plan-built', detail: { goalCount: goals.length } });
    const fundingPlan = goalAllocationResult.goalAllocations.map((g) => ({ goalName: g.goalName, requiredMonthlySip: g.requiredMonthlySip, stepUpSuggested: Math.round(g.requiredMonthlySip * 0.10), horizonBucket: g.horizonBucket, requiredCorpus: g.requiredCorpus }));
    let rebalancingAlerts = [];
    if (lots.length) {
      const holdingsBySecurity = {};
      for (const lot of lots) holdingsBySecurity[lot.security] = (holdingsBySecurity[lot.security] || 0) + lot.qty * lot.currentPrice;
      const totalValue = Object.values(holdingsBySecurity).reduce((a, b) => a + b, 0) || 1;
      const bySecurityTarget = {};
      for (const sec of Object.keys(holdingsBySecurity)) bySecurityTarget[sec] = holdingsBySecurity[sec] / totalValue;
      const rebalanceResult = runRebalancing({ lots, targetWeights: bySecurityTarget, driftBandAbs, cashflow });
      rebalancingAlerts = rebalanceResult.driftAlerts.filter((d) => d.breach).map((d) => ({ ...d, recommendedAction: d.drift > 0 ? 'Trim overweight position' : 'Top up underweight position' }));
      auditTrail.push({ timestamp: now, action: 'rebalancing-checked', detail: { breaches: rebalancingAlerts.length } });
    }
    const goalDashboard = {
      goals: goalAllocationResult.goalAllocations.map((g) => {
        const fundedRatio = g.requiredCorpus > 0 ? Math.min(1, g.currentValue / g.requiredCorpus) : 1;
        const offTrack = g.probability < targetSuccessProbability;
        return { goalName: g.goalName, fundedRatio: Number(fundedRatio.toFixed(3)), probability: g.probability, healthScore: g.goalAttainmentScore, status: offTrack ? 'OFF-TRACK' : 'ON-TRACK', recommendedAction: offTrack ? `Increase SIP to ₹${g.requiredMonthlySip}/month` : 'No action needed' };
      }),
      householdAllocation: goalAllocationResult.householdAllocation,
    };
    auditTrail.push({ timestamp: now, action: 'goal-dashboard-computed', detail: { offTrackCount: goalDashboard.goals.filter((g) => g.status === 'OFF-TRACK').length } });
    return {
      riskProfile: { tolerance: riskScore.toleranceScore, capacity: riskScore.capacityScore, finalCategory, overridden: !!rmOverride },
      modelRecommendation: { category: finalCategory, modelName: model.name, personalisedWeights: model.weights },
      fundingPlan, rebalancingAlerts, goalDashboard, auditTrail,
      suitabilityNote: 'Recommendation subject to Module 9 suitability checks; disclosures and RM override are logged in auditTrail per SEBI RA requirements.',
    };
  }

  // ============================== Sample requests (mirrors src/routes/*.js) ==============================
  const SAMPLES = {
    uc1: {
      riskCategory: 3, targetSuccessProbability: 0.80,
      goals: [
        { name: 'Child Education', targetAmount: 3000000, horizonYears: 12, inflation: 0.08, currentValue: 400000, lumpSum: 0, monthlySip: 8000 },
        { name: 'Retirement', targetAmount: 20000000, horizonYears: 25, inflation: 0.06, currentValue: 1500000, lumpSum: 0, monthlySip: 15000 },
        { name: 'Home Down-payment', targetAmount: 2000000, horizonYears: 4, inflation: 0.06, currentValue: 300000, lumpSum: 100000, monthlySip: 20000 },
      ],
    },
    uc2: {
      currentCorpus: 5000000, accumulationYears: 15, decumulationYears: 25, monthlyContribution: 25000,
      annualWithdrawal: 420000, inflationMean: 0.06, inflationVol: 0.015,
      accumulationWeights: { Equity: 0.65, Debt: 0.25, Gold: 0.05, Cash: 0.05, International: 0.0 },
      decumulationWeights: { Equity: 0.35, Debt: 0.50, Gold: 0.10, Cash: 0.05, International: 0.0 },
      shockProbability: 0.03, shockSize: 300000, pathCount: 3000, targetSuccessProbability: 0.85,
    },
    uc3: {
      objective: 'maxSharpe', riskFreeRate: 0.065, shrinkageIntensity: 0.3, useBlackLitterman: true,
      views: [{ assetId: 'TCS', viewReturn: 0.16, confidence: 0.6 }],
      sectorCaps: { IT: 0.30, Financials: 0.30 }, boxMax: 0.25, riskAversion: 3, turnoverCap: null,
      currentHoldings: { RELIANCE: 0.12, TCS: 0.08, HDFCBANK: 0.15, NIFTYBEES: 0.20, GOLDBEES: 0.05, LIQUIDBEES: 0.10 },
      transactionCostBps: 15,
    },
    uc4: {
      lots: SAMPLE_LOTS,
      targetWeights: { RELIANCE: 0.12, TCS: 0.10, HDFCBANK: 0.15, INFY: 0.08, ITC: 0.05, LT: 0.08, NIFTYBEES: 0.25, GOLDBEES: 0.07, LIQUIDBEES: 0.10 },
      driftBandAbs: 0.03, driftBandRel: 0.20, policy: 'threshold', cashflow: 50000, transactionCostBps: 10, minTradeValue: 5000,
    },
    uc5: {
      lots: SAMPLE_LOTS, realizedGainsYTD: { stcg: 15000, ltcg: 40000 }, washSaleWindowDays: 30,
      minHarvestableLoss: 1000, recentlyPurchased: [],
    },
    uc6: { exclusions: EXCLUSION_LIST, esgMin: 65, carbonMax: 35, teMax: 0.06, boxMax: 0.30 },
    uc7: {
      riskQuestionnaire: { tolerance: [4, 4, 3, 5], capacity: [3, 4, 3] },
      goals: [
        { name: 'Child Education', targetAmount: 3000000, horizonYears: 12, inflation: 0.08, currentValue: 400000, monthlySip: 8000 },
        { name: 'Retirement', targetAmount: 20000000, horizonYears: 25, inflation: 0.06, currentValue: 1500000, monthlySip: 15000 },
      ],
      lots: SAMPLE_LOTS, cashflow: 20000, targetSuccessProbability: 0.80,
    },
  };

  global.WISModels = {
    uc1: { run: runGoalAllocation, sample: SAMPLES.uc1 },
    uc2: { run: runMonteCarlo, sample: SAMPLES.uc2 },
    uc3: { run: runOptimization, sample: SAMPLES.uc3 },
    uc4: { run: runRebalancing, sample: SAMPLES.uc4 },
    uc5: { run: runTaxLossHarvesting, sample: SAMPLES.uc5 },
    uc6: { run: runEsgOptimization, sample: SAMPLES.uc6 },
    uc7: { run: runRoboAdvisory, sample: SAMPLES.uc7 },
  };
})(window);
