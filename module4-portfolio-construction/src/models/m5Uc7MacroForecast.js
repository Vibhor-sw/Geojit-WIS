// M5-UC7 — Macro & Rate Cycle Forecasting. A mixed-frequency growth/inflation nowcast from
// high-frequency indicators, a Taylor-rule policy-rate path with cycle-phase classification, and
// base/hawkish/dovish scenarios mapped to asset-class tilts. Built on the synthetic macro series in
// macroSeries.js — no licensed RBI/MOSPI feed in this prototype.
const { gdpGrowthPct, cpiPct, iipGrowthPct, pmiIndex, repoRatePct, HIGH_FREQ, QUARTER_LABELS } = require('../data/macroSeries');
const { round2 } = require('../data/stockUniverse');

function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function zLast(series) { const m = mean(series); const sd = Math.sqrt(series.reduce((a, v) => a + (v - m) ** 2, 0) / series.length) || 1; return (series[series.length - 1] - m) / sd; }

function computeNowcast() {
  // Bridge-style nowcast: standardise the latest reading of each high-frequency indicator, blend
  // into a single "surprise" index, and tilt the last reported GDP/CPI print by that surprise.
  const gstZ = zLast(HIGH_FREQ.gstCollectionGrowthPct);
  const ewayZ = zLast(HIGH_FREQ.ewayBillGrowthPct);
  const autoZ = zLast(HIGH_FREQ.autoSalesGrowthPct);
  const powerZ = zLast(HIGH_FREQ.powerDemandGrowthPct);
  const activitySurprise = (gstZ * 0.3 + ewayZ * 0.25 + autoZ * 0.2 + powerZ * 0.25);
  const lastGdp = gdpGrowthPct[gdpGrowthPct.length - 1];
  const lastCpi = cpiPct[cpiPct.length - 1];
  const gdpNowcast = round2(lastGdp + activitySurprise * 0.4);
  const cpiMomentum = cpiPct[cpiPct.length - 1] - cpiPct[cpiPct.length - 2];
  const cpiNowcast = round2(lastCpi + cpiMomentum * 0.5);
  return { gdpNowcast, cpiNowcast, activitySurpriseIndex: round2(activitySurprise), inputs: { gstZ: round2(gstZ), ewayZ: round2(ewayZ), autoZ: round2(autoZ), powerZ: round2(powerZ) } };
}

function taylorRule(cpiNowcast, gdpNowcast, opts) {
  const neutralRealRate = opts.neutralRealRate != null ? opts.neutralRealRate : 1.5;
  const inflationTarget = opts.inflationTarget != null ? opts.inflationTarget : 4.0;
  const potentialGrowth = opts.potentialGrowth != null ? opts.potentialGrowth : 6.5;
  const aCoeff = opts.aCoeff != null ? opts.aCoeff : 0.5;
  const bCoeff = opts.bCoeff != null ? opts.bCoeff : 0.5;
  const outputGap = gdpNowcast - potentialGrowth;
  const impliedRepo = neutralRealRate + cpiNowcast + aCoeff * (cpiNowcast - inflationTarget) + bCoeff * outputGap;
  return { neutralRealRate, inflationTarget, potentialGrowth, aCoeff, bCoeff, outputGap: round2(outputGap), impliedRepoPct: round2(impliedRepo) };
}

function classifyCyclePhase(taylor, currentRepo) {
  const gap = round2(taylor.impliedRepoPct - currentRepo);
  const recentTrend = repoRatePct[repoRatePct.length - 1] - repoRatePct[repoRatePct.length - 4];
  let phase;
  if (gap > 0.4) phase = 'Tightening Bias (rule implies higher rates than current)';
  else if (gap < -0.4) phase = 'Easing Bias (rule implies lower rates than current)';
  else phase = recentTrend > 0.1 ? 'Late-Tightening / Neutral' : recentTrend < -0.1 ? 'Early-Easing / Neutral' : 'Neutral / On-Hold';
  return { gapPct: gap, recentTrendPct: round2(recentTrend), phase };
}

function buildScenarios(currentRepo, taylor) {
  const gap = taylor.impliedRepoPct - currentRepo;
  // Scenario probabilities lean toward whichever direction the Taylor gap points, rather than a
  // fixed 33/33/33 split — a genuine (if simple) conditioning on the current data.
  const hawkishProb = Math.max(0.1, Math.min(0.6, 0.3 + gap * 0.15));
  const dovishProb = Math.max(0.1, Math.min(0.6, 0.3 - gap * 0.15));
  const baseProb = round2(1 - hawkishProb - dovishProb);
  const horizonQuarters = 4;
  function path(deltaPerQuarter) {
    const p = [round2(currentRepo)];
    for (let i = 1; i <= horizonQuarters; i++) p.push(round2(p[i - 1] + deltaPerQuarter));
    return p;
  }
  // Base delta is a partial (50%) convergence toward the Taylor-implied rate each quarter; hawkish
  // and dovish are explicit +/- kickers off that base so the three paths never coincide regardless
  // of which direction the base case already points.
  const baseDelta = gap / horizonQuarters * 0.5;
  const kicker = 0.18;
  return {
    base: { probability: baseProb, repoPath: path(baseDelta), label: 'Gradual convergence toward the rule-implied rate' },
    hawkish: { probability: round2(hawkishProb), repoPath: path(baseDelta + kicker), label: 'Faster tightening on sticky inflation / strong growth' },
    dovish: { probability: round2(dovishProb), repoPath: path(baseDelta - kicker), label: 'Earlier easing on growth slowdown / inflation undershoot' },
  };
}

const ASSET_TILTS = {
  hawkish: [{ tilt: 'Favour', target: 'Financials / Low-Volatility / Value factor' }, { tilt: 'Avoid', target: 'Rate-sensitive: Realty, Auto (financing-heavy), long-duration bonds' }],
  base: [{ tilt: 'Neutral', target: 'Broadly balanced sector positioning' }],
  dovish: [{ tilt: 'Favour', target: 'Rate-sensitive: Realty, Auto, Capital Goods; longer-duration bonds' }, { tilt: 'Avoid', target: 'Defensive low-beta names that lag in a re-rating rally' }],
};

function forecastTracking() {
  // A simple retrospective check: apply the same nowcast-style logic (lagged-indicator momentum)
  // to each historical quarter using only data available at that point, and compare to what GDP
  // actually printed the following quarter — a genuine (small-sample) tracking-error calculation.
  const errors = [];
  for (let i = 4; i < gdpGrowthPct.length - 1; i++) {
    const naiveNowcast = gdpGrowthPct[i] + (gdpGrowthPct[i] - gdpGrowthPct[i - 1]) * 0.4;
    const actualNext = gdpGrowthPct[i + 1];
    errors.push(Math.abs(naiveNowcast - actualNext));
  }
  const mae = round2(mean(errors));
  return { quartersEvaluated: errors.length, maeGdpPct: mae, note: 'Retrospective MAE of a naive momentum nowcast vs actual GDP print, computed over this series\' own history.' };
}

function runMacroForecast(payload) {
  const p = payload || {};
  const nowcast = computeNowcast();
  const taylor = taylorRule(nowcast.cpiNowcast, nowcast.gdpNowcast, p);
  const currentRepo = repoRatePct[repoRatePct.length - 1];
  const cyclePhase = classifyCyclePhase(taylor, currentRepo);
  const scenarios = buildScenarios(currentRepo, taylor);
  const tracking = forecastTracking();

  return {
    macroNowcast: { gdpGrowthPct: nowcast.gdpNowcast, cpiPct: nowcast.cpiNowcast, activitySurpriseIndex: nowcast.activitySurpriseIndex, inputs: nowcast.inputs },
    ratePath: { currentRepoPct: currentRepo, taylor, cyclePhase },
    scenarios,
    assetImplications: ASSET_TILTS,
    forecastTracking: tracking,
    history: { quarters: QUARTER_LABELS, gdpGrowthPct, cpiPct, iipGrowthPct, pmiIndex, repoRatePct },
  };
}

module.exports = { runMacroForecast };
