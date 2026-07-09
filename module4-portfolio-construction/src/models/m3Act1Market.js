// M3-UC1 — Market Intelligence (Act 1). Presentational/aggregation layer: breadth, volatility
// regime, index attribution, sector rotation, delivery/liquidity, earnings hub. No independent
// buy/sell calls are issued here (FR-MI constraint).
const { STOCK_UNIVERSE, INDEX_WEIGHTS, hashSeed, mulberry32, round2 } = require('../data/stockUniverse');

function sma(values, window) {
  if (values.length < window) return null;
  let sum = 0;
  for (let i = values.length - window; i < values.length; i++) sum += values[i];
  return sum / window;
}
function ema(values, window) {
  const k = 2 / (window + 1);
  let e = values[0];
  for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}
function pctChange(a, b) { return b === 0 ? 0 : (a - b) / b; }

function computeBreadth() {
  let advancers = 0, decliners = 0, above200 = 0;
  STOCK_UNIVERSE.forEach((s) => {
    const closes = s.ohlcv.map((b) => b.close);
    const today = closes[closes.length - 1], yest = closes[closes.length - 2];
    if (today > yest) advancers++; else if (today < yest) decliners++;
    const ema200 = ema(closes.slice(-Math.min(200, closes.length)), Math.min(200, closes.length));
    if (today > ema200) above200++;
  });
  return {
    advancers, decliners,
    adRatio: decliners === 0 ? advancers : round2(advancers / decliners),
    pctAbove200Ema: round2((above200 / STOCK_UNIVERSE.length) * 100),
  };
}

function buildSyntheticVix() {
  // No licensed India VIX feed; derive an illustrative vol-regime series from the universe's
  // realised return dispersion (cross-sectional stdev of daily returns), scaled to a VIX-like level.
  const days = STOCK_UNIVERSE[0].ohlcv.length;
  const series = [];
  for (let i = 1; i < days; i++) {
    const rets = STOCK_UNIVERSE.map((s) => pctChange(s.ohlcv[i].close, s.ohlcv[i - 1].close));
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length;
    const stdev = Math.sqrt(variance);
    series.push(round2(12 + stdev * 900));
  }
  return series;
}

function computeVolatilityRegime() {
  const series = buildSyntheticVix();
  const level = series[series.length - 1];
  const ma50 = sma(series, Math.min(50, series.length));
  const sorted = [...series].sort((a, b) => a - b);
  const p80 = sorted[Math.floor(sorted.length * 0.8)];
  const high52w = Math.max(...series.slice(-252));
  const low52w = Math.min(...series.slice(-252));
  return {
    level, ma50: round2(ma50), high52w: round2(high52w), low52w: round2(low52w),
    highVolRegime: level > ma50 && level > p80,
    percentileThreshold: round2(p80),
    series: series.slice(-90),
  };
}

function computeIndexAttribution() {
  const contributions = STOCK_UNIVERSE.map((s) => {
    const closes = s.ohlcv.map((b) => b.close);
    const ret = pctChange(closes[closes.length - 1], closes[closes.length - 2]);
    const weight = INDEX_WEIGHTS[s.id];
    return { id: s.id, name: s.name, weight: round2(weight * 1000) / 10, return: round2(ret * 10000) / 100, contributionBps: round2(weight * ret * 10000) };
  });
  const indexMove = contributions.reduce((a, c) => a + c.contributionBps, 0) / 100;
  const sorted = [...contributions].sort((a, b) => b.contributionBps - a.contributionBps);
  return { indexMovePct: round2(indexMove * 100) / 100, topUp: sorted.slice(0, 5), topDown: sorted.slice(-5).reverse(), all: contributions };
}

function computeSectorRotation() {
  const bySector = {};
  STOCK_UNIVERSE.forEach((s) => {
    if (!bySector[s.sector]) bySector[s.sector] = [];
    bySector[s.sector].push(s);
  });
  const rows = Object.keys(bySector).map((sector) => {
    const stocks = bySector[sector];
    const rets = stocks.map((s) => {
      const closes = s.ohlcv.map((b) => b.close);
      return pctChange(closes[closes.length - 1], closes[closes.length - 21] || closes[0]);
    });
    const meanRet = rets.reduce((a, b) => a + b, 0) / rets.length;
    return { sector, cyclicality: stocks[0].cyclicality, trailing1mReturn: round2(meanRet * 10000) / 100, count: stocks.length };
  });
  const rets = rows.map((r) => r.trailing1mReturn);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const stdev = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length) || 1;
  rows.forEach((r) => { r.momentumZ = round2(((r.trailing1mReturn - mean) / stdev) * 100) / 100; });
  rows.sort((a, b) => b.momentumZ - a.momentumZ);
  return rows;
}

function computeLiquidityScores() {
  return STOCK_UNIVERSE.map((s) => {
    const recent = s.ohlcv.slice(-5);
    const avgDelivery = recent.reduce((a, b) => a + b.deliveryPct, 0) / recent.length;
    const avgVolume = recent.reduce((a, b) => a + b.volume, 0) / recent.length;
    const executableSize = Math.round(avgVolume * (avgDelivery / 100) * 0.02);
    const liquidityScore = Math.min(100, Math.round((avgDelivery / 100) * 50 + Math.min(50, avgVolume / 20000)));
    return { id: s.id, name: s.name, avgDeliveryPct: round2(avgDelivery), avgVolume: Math.round(avgVolume), executableSize, liquidityScore };
  }).sort((a, b) => b.liquidityScore - a.liquidityScore);
}

function computeEarningsHub() {
  const results = STOCK_UNIVERSE.map((s) => {
    const rng = mulberry32(hashSeed(s.isin + 'earnings'));
    const daysAgoOrAhead = Math.round(-45 + rng() * 90); // negative = already announced, positive = upcoming
    const estimate = s.financials.netIncome[s.financials.netIncome.length - 1] * (0.95 + rng() * 0.1);
    const actual = daysAgoOrAhead <= 0 ? s.financials.netIncome[s.financials.netIncome.length - 1] : null;
    const surprisePct = actual !== null ? round2(((actual - estimate) / estimate) * 10000) / 100 : null;
    const date = new Date(new Date('2026-07-08').getTime() + daysAgoOrAhead * 86400000).toISOString().slice(0, 10);
    return { id: s.id, name: s.name, sector: s.sector, date, announced: daysAgoOrAhead <= 0, estimate: round2(estimate), actual: actual !== null ? round2(actual) : null, surprisePct };
  });
  const announced = results.filter((r) => r.announced).sort((a, b) => (b.date < a.date ? -1 : 1));
  const forward30d = results.filter((r) => !r.announced && r.date <= new Date(new Date('2026-07-08').getTime() + 30 * 86400000).toISOString().slice(0, 10)).sort((a, b) => (a.date < b.date ? -1 : 1));
  return { announced, forward30d, bySector: groupSurpriseBySector(announced) };
}
function groupSurpriseBySector(announced) {
  const bySector = {};
  announced.forEach((r) => {
    if (!bySector[r.sector]) bySector[r.sector] = [];
    bySector[r.sector].push(r.surprisePct);
  });
  return Object.keys(bySector).map((sector) => ({
    sector, avgSurprisePct: round2((bySector[sector].reduce((a, b) => a + b, 0) / bySector[sector].length) * 100) / 100, count: bySector[sector].length,
  }));
}

function runMarketIntelligence() {
  const breadth = computeBreadth();
  const volatility = computeVolatilityRegime();
  const indexAttribution = computeIndexAttribution();
  const sectorRotation = computeSectorRotation();
  const liquidityScores = computeLiquidityScores();
  const earningsHub = computeEarningsHub();
  const gainers = [...indexAttribution.all].sort((a, b) => b.return - a.return).slice(0, 5);
  const losers = [...indexAttribution.all].sort((a, b) => a.return - b.return).slice(0, 5);
  return {
    marketOverview: {
      indexMovePct: indexAttribution.indexMovePct, topGainers: gainers, topLosers: losers,
      sectorHeatmap: sectorRotation.map((r) => ({ sector: r.sector, trailing1mReturn: r.trailing1mReturn })),
      breadth, vix: { level: volatility.level, trend: volatility.highVolRegime ? 'Rising / High-Vol Regime' : 'Stable' },
    },
    breadth, volatility, indexAttribution, sectorRotation, liquidityScores, earningsHub,
  };
}

module.exports = { runMarketIntelligence };
