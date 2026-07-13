// M5-UC6 — Mutual Fund & ETF Selection. Risk-adjusted performance, consistency, cost/style analysis
// and a category-relative selection score for the Module 5 fund universe (your 12 real MF holdings
// plus a few illustrative extras), benchmarked against a synthetic category index since no licensed
// AMFI/Morningstar/Value Research feed is wired into this prototype. Portfolio-fit reuses your
// actual Module 4 holdings to flag category concentration.
const { FUND_UNIVERSE, CATEGORY_PROFILE } = require('../data/fundUniverse');
const { hashSeed, mulberry32, round2, rngNormal } = require('../data/stockUniverse');
const { REAL_HOLDINGS } = require('../data/realPortfolioData');

function findFund(id) { const f = FUND_UNIVERSE.find((x) => x.id === id); if (!f) throw new Error(`Unknown fund id: ${id}`); return f; }

const BENCHMARK_CACHE = {};
function benchmarkSeries(category, days) {
  if (BENCHMARK_CACHE[category]) return BENCHMARK_CACHE[category];
  const profile = CATEGORY_PROFILE[category] || CATEGORY_PROFILE['Large Cap Fund'];
  const rng = mulberry32(hashSeed(category + 'benchmark'));
  const dt = 1 / 252;
  const levels = [1000];
  for (let i = 1; i < days; i++) {
    const z = rngNormal(rng);
    levels.push(levels[i - 1] * Math.exp((profile.drift - 0.5 * profile.vol * profile.vol) * dt + profile.vol * Math.sqrt(dt) * z));
  }
  BENCHMARK_CACHE[category] = levels;
  return levels;
}

function returnsFromLevels(levels) {
  const r = [];
  for (let i = 1; i < levels.length; i++) r.push(levels[i] / levels[i - 1] - 1);
  return r;
}
function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function stdev(a) { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); }

function riskAdjustedMetrics(fundRets, benchRets, riskFreeRate) {
  const annFundReturn = mean(fundRets) * 252, annFundVol = stdev(fundRets) * Math.sqrt(252);
  const annBenchReturn = mean(benchRets) * 252;
  const activeRets = fundRets.map((r, i) => r - benchRets[i]);
  const trackingError = stdev(activeRets) * Math.sqrt(252);
  const downside = fundRets.filter((r) => r < 0);
  const downsideDev = Math.sqrt(downside.reduce((a, r) => a + r * r, 0) / (downside.length || 1)) * Math.sqrt(252);

  const meanB = mean(benchRets);
  let cov = 0, varB = 0;
  for (let i = 0; i < fundRets.length; i++) { cov += (fundRets[i] - mean(fundRets)) * (benchRets[i] - meanB); varB += (benchRets[i] - meanB) ** 2; }
  const beta = cov / (varB || 1e-9);
  const alphaDaily = mean(fundRets) - beta * meanB;
  const alphaAnnualPct = round2(alphaDaily * 252 * 100);

  const residuals = fundRets.map((r, i) => r - (beta * benchRets[i] + alphaDaily));
  const seAlpha = stdev(residuals) / Math.sqrt(fundRets.length);
  const skillTStat = round2((alphaDaily / (seAlpha || 1e-9)));

  const upPeriods = benchRets.map((r, i) => ({ r, i })).filter((x) => x.r > 0);
  const downPeriods = benchRets.map((r, i) => ({ r, i })).filter((x) => x.r < 0);
  const upCapture = upPeriods.length ? round2((mean(upPeriods.map((x) => fundRets[x.i])) / mean(upPeriods.map((x) => x.r))) * 100) : null;
  const downCapture = downPeriods.length ? round2((mean(downPeriods.map((x) => fundRets[x.i])) / mean(downPeriods.map((x) => x.r))) * 100) : null;

  const sharpe = round2((annFundReturn - riskFreeRate) / annFundVol);
  const sortino = round2((annFundReturn - riskFreeRate) / (downsideDev || 0.0001));
  const informationRatio = round2((annFundReturn - annBenchReturn) / (trackingError || 0.0001));

  return {
    annReturnPct: round2(annFundReturn * 100), annVolPct: round2(annFundVol * 100), annBenchReturnPct: round2(annBenchReturn * 100),
    alpha: alphaAnnualPct, beta: round2(beta), sharpe, sortino, informationRatio, trackingErrorPct: round2(trackingError * 100),
    upCapture, downCapture, skillTStat,
  };
}

function consistencyMetrics(fundLevels, benchLevels) {
  const windowDays = 63; // ~3 months
  let hits = 0, windows = 0;
  for (let i = windowDays; i < fundLevels.length; i += windowDays) {
    const fundRet = fundLevels[i] / fundLevels[i - windowDays] - 1;
    const benchRet = benchLevels[i] / benchLevels[i - windowDays] - 1;
    windows++; if (fundRet > benchRet) hits++;
  }
  let peak = fundLevels[0], maxDD = 0;
  fundLevels.forEach((v) => { peak = Math.max(peak, v); maxDD = Math.min(maxDD, (v - peak) / peak); });
  return { rollingHitRatePct: round2((hits / (windows || 1)) * 100), windowsEvaluated: windows, maxDrawdownPct: round2(maxDD * 100) };
}

function portfolioFit(fund) {
  const heldMFs = REAL_HOLDINGS.filter((h) => h.type === 'MF');
  const totalMFValue = heldMFs.reduce((a, h) => a + h.qty * h.currentPrice, 0);
  const sameCategoryValue = heldMFs.filter((h) => h.sector === fund.category).reduce((a, h) => a + h.qty * h.currentPrice, 0);
  const alreadyHeld = heldMFs.some((h) => h.id === fund.id);
  const categoryConcentrationPct = round2((sameCategoryValue / (totalMFValue || 1)) * 100);
  const diversificationBenefit = alreadyHeld ? 0 : round2(Math.max(0, 100 - categoryConcentrationPct));
  return { alreadyHeld, categoryConcentrationPct, diversificationBenefit };
}

function runFundAnalysis(fund, riskFreeRate) {
  const days = fund.navHistory.length;
  const fundLevels = fund.navHistory.map((n) => n.nav);
  const benchLevels = benchmarkSeries(fund.category, days);
  const fundRets = returnsFromLevels(fundLevels);
  const benchRets = returnsFromLevels(benchLevels);
  const riskAdjusted = riskAdjustedMetrics(fundRets, benchRets, riskFreeRate);
  const consistency = consistencyMetrics(fundLevels, benchLevels);
  const styleAnalysis = { styleDriftScore: fund.styleDriftScore, driftFlag: fund.styleDriftScore > 18 ? 'Notable drift from stated category' : 'Consistent with stated category', skillTStat: riskAdjusted.skillTStat, skillAssessment: Math.abs(riskAdjusted.skillTStat) > 2 ? 'Statistically meaningful skill (|t| > 2)' : 'Not statistically distinguishable from noise' };
  const costProfile = { expenseRatioPct: fund.expenseRatioPct, exitLoadPct: fund.exitLoadPct, aumCr: fund.aumCr, turnoverPct: fund.turnoverPct, top10ConcentrationPct: fund.top10ConcentrationPct };
  return { riskAdjusted, consistency, styleAnalysis, costProfile };
}

function runFundSelection(payload) {
  const p = payload || {};
  const riskFreeRate = p.riskFreeRate != null ? p.riskFreeRate : 0.068;
  const categoryFilter = p.category || null;

  const universe = categoryFilter ? FUND_UNIVERSE.filter((f) => f.category === categoryFilter) : FUND_UNIVERSE;
  const analysed = universe.map((f) => {
    const analysis = runFundAnalysis(f, riskFreeRate);
    return { id: f.id, name: f.name, category: f.category, benchmark: f.benchmark, currentNav: f.currentNav, ...analysis };
  });

  // Category-relative selection score: z-scored blend of Sharpe, Information Ratio, consistency
  // hit-rate, and (negatively) expense ratio and style drift, computed within each category so
  // funds are only ever compared to true peers.
  const byCategory = {};
  analysed.forEach((f) => { (byCategory[f.category] = byCategory[f.category] || []).push(f); });
  Object.values(byCategory).forEach((list) => {
    const z = (arr) => { const m = mean(arr); const sd = stdev(arr) || 1; return arr.map((v) => (v - m) / sd); };
    const sharpeZ = z(list.map((f) => f.riskAdjusted.sharpe));
    const irZ = z(list.map((f) => f.riskAdjusted.informationRatio));
    const hitZ = z(list.map((f) => f.consistency.rollingHitRatePct));
    const costZ = z(list.map((f) => f.costProfile.expenseRatioPct));
    const driftZ = z(list.map((f) => f.styleAnalysis.styleDriftScore));
    list.forEach((f, i) => { f.selectionScore = round2(Math.max(0, Math.min(100, 12 * sharpeZ[i] + 10 * irZ[i] + 8 * hitZ[i] - 6 * costZ[i] - 4 * driftZ[i] + 50))); });
    list.sort((a, b) => b.selectionScore - a.selectionScore);
    list.forEach((f, i) => { f.categoryRank = i + 1; f.categorySize = list.length; });
  });

  const withFit = analysed.map((f) => ({ ...f, portfolioFit: portfolioFit(FUND_UNIVERSE.find((x) => x.id === f.id)) }));
  withFit.sort((a, b) => b.selectionScore - a.selectionScore);

  return { funds: withFit, riskFreeRate, categoryFilter };
}

module.exports = { runFundSelection };
