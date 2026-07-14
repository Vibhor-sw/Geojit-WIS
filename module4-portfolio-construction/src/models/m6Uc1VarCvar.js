// M6-UC1 — VaR/CVaR & Tail Risk. Parametric (with Cornish-Fisher fat-tail adjustment), historical
// simulation, and Monte Carlo (multivariate Student-t) VaR/CVaR on the real 21-stock equity book;
// component/marginal/incremental VaR attribution; EVT (Peaks-Over-Threshold / GPD) tail metrics;
// Kupiec proportion-of-failures + Christoffersen independence backtesting; a what-if VaR delta for
// a hypothetical trade. Reuses the shared covariance core from m6RiskCore.js (spec's "single
// covariance/factor-model core" build note).
const { riskCoreForPortfolio, mean, std } = require('./m6RiskCore');
const { invert, matVec, normCdf, makeRng, randn, sampleCovariance, cholesky } = require('./mathUtils');
const { round2 } = require('../data/stockUniverse');

// Binary-search inverse standard normal CDF (probit), driven off the existing forward normCdf.
function invNormCdf(p) {
  let lo = -8, hi = 8;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (normCdf(mid) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function skewKurt(returns) {
  const m = mean(returns), sd = std(returns) || 1e-9;
  const n = returns.length;
  const skew = returns.reduce((a, r) => a + ((r - m) / sd) ** 3, 0) / n;
  const kurt = returns.reduce((a, r) => a + ((r - m) / sd) ** 4, 0) / n - 3; // excess kurtosis
  return { skew, kurt };
}

// Cornish-Fisher expansion: adjusts the normal z-quantile for sample skewness/kurtosis, a
// standard "modified VaR" technique for fat-tailed parametric VaR (satisfies FR-VR-03's
// "not normal-only" requirement without a full Student-t quantile function).
function cornishFisherZ(z, skew, kurt) {
  return z + (z ** 2 - 1) * skew / 6 + (z ** 3 - 3 * z) * kurt / 24 - (2 * z ** 3 - 5 * z) * skew ** 2 / 36;
}

function portfolioValue(positions) {
  return positions.reduce((a, p) => a + p.marketValue, 0);
}

function parametricVar(portReturns, confidence, horizonDays, portValue) {
  const sigma = std(portReturns);
  const mu = mean(portReturns);
  const z = invNormCdf(confidence);
  const { skew, kurt } = skewKurt(portReturns);
  const zCf = cornishFisherZ(z, skew, kurt);
  const scale = Math.sqrt(horizonDays);
  const varNormalPct = (z * sigma - mu) * scale;
  const varFatTailPct = (zCf * sigma - mu) * scale;
  // CVaR for the normal case has a closed form: mu + sigma * phi(z)/(1-confidence).
  const phiZ = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  const cvarNormalPct = (phiZ * sigma / (1 - confidence) - mu) * scale;
  return {
    varPct: round2(varFatTailPct * 100), varNormalOnlyPct: round2(varNormalPct * 100),
    cvarPct: round2(cvarNormalPct * 100 * (varFatTailPct / (varNormalPct || 1e-9))), // fat-tail-scaled CVaR proxy
    varAmount: round2(varFatTailPct * portValue), cvarAmount: round2(varFatTailPct * portValue * (cvarNormalPct / (varNormalPct || 1e-9))),
    skew: round2(skew), excessKurtosis: round2(kurt), z: round2(z), zCornishFisher: round2(zCf),
  };
}

function historicalVar(portReturns, confidence, horizonDays, portValue) {
  const losses = portReturns.map((r) => -r).sort((a, b) => a - b).reverse(); // largest loss first
  const idx = Math.floor((1 - confidence) * losses.length);
  const varDaily = losses[Math.min(idx, losses.length - 1)];
  const tailLosses = losses.slice(0, Math.max(1, idx));
  const cvarDaily = mean(tailLosses);
  // Horizon scaling via sqrt(h) is a documented simplification (naive for fat tails per the
  // spec's own caution) — flagged explicitly in the coachmark tour rather than silently applied.
  const scale = Math.sqrt(horizonDays);
  return { varPct: round2(varDaily * scale * 100), cvarPct: round2(cvarDaily * scale * 100), varAmount: round2(varDaily * scale * portValue), cvarAmount: round2(cvarDaily * scale * portValue) };
}

// Multivariate Student-t Monte Carlo via the normal-variance-mixture representation:
// t = mu + sqrt(df / chiSq_df) * N(0, Sigma), which reduces to correlated fat-tailed draws
// without needing a closed-form multivariate-t quantile function.
function monteCarloVar(rows, weights, confidence, horizonDays, portValue, paths, tDf, seed) {
  const rng = makeRng(seed);
  const n = weights.length;
  const means = new Array(n).fill(0).map((_, j) => mean(rows.map((r) => r[j])));
  const sigmaCov = sampleCovariance(rows);
  const L = cholesky(sigmaCov);
  const simReturns = [];
  for (let p = 0; p < paths; p++) {
    let chiSq = 0;
    for (let k = 0; k < tDf; k++) chiSq += randn(rng) ** 2;
    const tScale = Math.sqrt(tDf / chiSq);
    const z = new Array(n).fill(0).map(() => randn(rng));
    let portRet = 0;
    for (let i = 0; i < n; i++) {
      let s = means[i];
      for (let k = 0; k <= i; k++) s += tScale * L[i][k] * z[k];
      portRet += s * weights[i];
    }
    simReturns.push(portRet);
  }
  const losses = simReturns.map((r) => -r).sort((a, b) => a - b).reverse();
  const idx = Math.floor((1 - confidence) * losses.length);
  const varDaily = losses[Math.min(idx, losses.length - 1)];
  const cvarDaily = mean(losses.slice(0, Math.max(1, idx)));
  const scale = Math.sqrt(horizonDays);
  return { varPct: round2(varDaily * scale * 100), cvarPct: round2(cvarDaily * scale * 100), varAmount: round2(varDaily * scale * portValue), cvarAmount: round2(cvarDaily * scale * portValue), paths, tDegreesOfFreedom: tDf };
}

// EVT / Peaks-Over-Threshold: fit a Generalised Pareto Distribution to losses above a threshold
// via method-of-moments (mean and variance of the excesses), then derive VaR/CVaR/tail-index from
// the fitted GPD — the spec's FR-VR-03 fat-tail requirement.
function evtTail(portReturns, confidence, thresholdPercentile) {
  const losses = portReturns.map((r) => -r).sort((a, b) => a - b);
  const n = losses.length;
  const uIdx = Math.floor(thresholdPercentile * n);
  const u = losses[uIdx];
  const excesses = losses.slice(uIdx).map((l) => l - u).filter((e) => e > 0);
  const nu = excesses.length;
  const m = mean(excesses), v = std(excesses) ** 2;
  const xi = 0.5 * (1 - (m * m) / (v || 1e-9));
  const beta = 0.5 * m * ((m * m) / (v || 1e-9) + 1);
  const p = 1 - confidence;
  const varGpd = xi !== 0
    ? u + (beta / xi) * (((n / nu) * p) ** (-xi) - 1)
    : u + beta * Math.log(nu / (n * p));
  const cvarGpd = xi < 1 ? (varGpd + beta - xi * u) / (1 - xi) : varGpd * 1.5;
  return {
    thresholdPct: round2(thresholdPercentile * 100), threshold: round2(u * 100), exceedances: nu,
    tailIndex: round2(xi), scaleBeta: round2(beta), evtVarPct: round2(varGpd * 100), evtCvarPct: round2(cvarGpd * 100),
    regime: xi > 0.1 ? 'Heavy-tailed (fat tail, unbounded)' : xi > -0.1 ? 'Near-exponential tail' : 'Bounded/thin tail',
  };
}

function componentVar(sigma, weights, confidence, portReturns) {
  const z = invNormCdf(confidence);
  const sigmaW = matVec(sigma, weights); // (Sigma * w)
  const portVar = weights.reduce((a, w, i) => a + w * sigmaW[i], 0);
  const portVol = Math.sqrt(Math.max(portVar, 1e-12));
  const marginal = sigmaW.map((sw) => (z * sw) / portVol); // ∂VaR/∂w_i
  const component = marginal.map((mv, i) => mv * weights[i]);
  return { marginal, component, portVol };
}

// Incremental VaR: fully removing position i, renormalising remaining weights, and recomputing
// portfolio VaR from the covariance sub-matrix — the change vs total VaR from that position's
// presence in the book.
function incrementalVar(sigma, weights, confidence, totalVarPct) {
  const n = weights.length;
  const z = invNormCdf(confidence);
  return weights.map((_, dropIdx) => {
    const idxs = weights.map((_, i) => i).filter((i) => i !== dropIdx);
    const subSigma = idxs.map((i) => idxs.map((j) => sigma[i][j]));
    const subW = idxs.map((i) => weights[i]);
    const wSum = subW.reduce((a, b) => a + b, 0) || 1;
    const wNorm = subW.map((w) => w / wSum);
    const sigmaW = matVec(subSigma, wNorm);
    const portVar = wNorm.reduce((a, w, i) => a + w * sigmaW[i], 0);
    const varWithout = z * Math.sqrt(Math.max(portVar, 1e-12)) * 100;
    return round2(totalVarPct - varWithout);
  });
}

function kupiecTest(exceptions, obs, expectedRate) {
  const x = exceptions, n = obs, p = expectedRate;
  const xClamped = Math.max(1e-6, Math.min(n - 1e-6, x));
  const logL1 = (n - xClamped) * Math.log(1 - p) + xClamped * Math.log(p);
  const rHat = xClamped / n;
  const logL0 = (n - xClamped) * Math.log(1 - rHat) + xClamped * Math.log(rHat);
  const lr = -2 * (logL1 - logL0);
  return { statistic: round2(lr), criticalValue995: 3.84, pass: lr < 3.84, exceptionRate: round2((x / n) * 100), expectedRate: round2(p * 100) };
}

function christoffersenTest(exceedFlags) {
  let n00 = 0, n01 = 0, n10 = 0, n11 = 0;
  for (let i = 1; i < exceedFlags.length; i++) {
    const prev = exceedFlags[i - 1], cur = exceedFlags[i];
    if (prev === 0 && cur === 0) n00++;
    else if (prev === 0 && cur === 1) n01++;
    else if (prev === 1 && cur === 0) n10++;
    else n11++;
  }
  const pi01 = n01 / (n00 + n01 || 1), pi11 = n11 / (n10 + n11 || 1);
  const pi = (n01 + n11) / (n00 + n01 + n10 + n11 || 1);
  const safeLog = (x) => Math.log(Math.max(x, 1e-9));
  const logLc = (n00 + n10) * safeLog(1 - pi) + (n01 + n11) * safeLog(pi);
  const logLu = n00 * safeLog(1 - pi01) + n01 * safeLog(pi01) + n10 * safeLog(1 - pi11) + n11 * safeLog(pi11);
  const lr = -2 * (logLc - logLu);
  return { statistic: round2(lr), criticalValue: 3.84, pass: lr < 3.84, note: 'Tests whether VaR exceptions cluster in time rather than occurring independently.' };
}

function runVarCvar(payload) {
  const p = payload || {};
  const confidence = p.confidence || 0.95;
  const horizonDays = p.horizonDays || 1;
  const shrinkage = p.shrinkage != null ? p.shrinkage : 0.2;
  const mcPaths = p.mcPaths || 3000;
  const tDf = p.tDegreesOfFreedom || 5;
  const evtThresholdPct = p.evtThresholdPercentile != null ? p.evtThresholdPercentile : 0.90;

  const core = riskCoreForPortfolio(shrinkage);
  const portValue = portfolioValue(core.positions);

  const parametric = parametricVar(core.portReturns, confidence, horizonDays, portValue);
  const historical = historicalVar(core.portReturns, confidence, horizonDays, portValue);
  const montecarlo = monteCarloVar(core.rows, core.weights, confidence, horizonDays, portValue, mcPaths, tDf, 42);
  const evt = evtTail(core.portReturns, confidence, evtThresholdPct);

  const { marginal, component, portVol } = componentVar(core.sigma, core.weights, confidence, core.portReturns);
  const incremental = incrementalVar(core.sigma, core.weights, confidence, parametric.varPct);
  const attribution = core.positions.map((pos, i) => ({
    id: pos.id, name: pos.name, sector: pos.sector, weightPct: round2(pos.weight * 100),
    marginalVarPct: round2(marginal[i] * 100), componentVarPct: round2(component[i] * 100), incrementalVarPct: incremental[i],
  })).sort((a, b) => b.componentVarPct - a.componentVarPct);

  // Backtest: static parametric VaR (99% confidence, 1-day) evaluated against each day's actual
  // portfolio loss across the full 259-day sample. A genuine exception count, honestly a
  // single-window check rather than a rolling out-of-sample backtest (flagged in the tour).
  const btConfidence = 0.99;
  const btZ = invNormCdf(btConfidence);
  const btSigma = std(core.portReturns), btMu = mean(core.portReturns);
  const staticVarDaily = btZ * btSigma - btMu;
  const exceedFlags = core.portReturns.map((r) => (-r > staticVarDaily ? 1 : 0));
  const exceptions = exceedFlags.reduce((a, b) => a + b, 0);
  const kupiec = kupiecTest(exceptions, exceedFlags.length, 1 - btConfidence);
  const christoffersen = christoffersenTest(exceedFlags);

  // What-if VaR: apply a hypothetical trade (buy/sell on one position, expressed as a weight
  // delta) and recompute parametric portfolio VaR with the adjusted, renormalised weights.
  let whatIfVar = null;
  if (p.whatIf && p.whatIf.stockId) {
    const idx = core.positions.findIndex((pos) => pos.id === p.whatIf.stockId);
    if (idx >= 0) {
      const deltaWeight = (p.whatIf.tradeValue || 0) / portValue;
      const newWeights = core.weights.slice();
      newWeights[idx] += deltaWeight;
      const wSum = newWeights.reduce((a, b) => a + b, 0);
      const wNorm = newWeights.map((w) => w / wSum);
      const sigmaW = matVec(core.sigma, wNorm);
      const newPortVar = wNorm.reduce((a, w, i) => a + w * sigmaW[i], 0);
      const newVarPct = round2(invNormCdf(confidence) * Math.sqrt(Math.max(newPortVar, 1e-12)) * 100);
      whatIfVar = { stockId: p.whatIf.stockId, tradeValue: p.whatIf.tradeValue, varBeforePct: parametric.varNormalOnlyPct, varAfterPct: newVarPct, deltaVarPct: round2(newVarPct - parametric.varNormalOnlyPct) };
    }
  }

  return {
    portfolio: { positionCount: core.positions.length, portfolioValue: round2(portValue), confidence, horizonDays },
    var: { parametric: { pct: parametric.varPct, amount: parametric.varAmount, normalOnlyPct: parametric.varNormalOnlyPct }, historical: { pct: historical.varPct, amount: historical.varAmount }, montecarlo: { pct: montecarlo.varPct, amount: montecarlo.varAmount, paths: montecarlo.paths, tDegreesOfFreedom: montecarlo.tDegreesOfFreedom } },
    cvar: { parametric: { pct: parametric.cvarPct, amount: parametric.cvarAmount }, historical: { pct: historical.cvarPct, amount: historical.cvarAmount }, montecarlo: { pct: montecarlo.cvarPct, amount: montecarlo.cvarAmount } },
    riskAttribution: { table: attribution, portfolioVolDailyPct: round2(portVol * 100) },
    tailMetrics: evt,
    backtest: { observations: exceedFlags.length, exceptions, kupiec, christoffersen, confidence: btConfidence },
    whatIfVar,
    fatTailDiagnostics: { skew: parametric.skew, excessKurtosis: parametric.excessKurtosis, zNormal: parametric.z, zCornishFisher: parametric.zCornishFisher },
  };
}

module.exports = { runVarCvar, invNormCdf };
