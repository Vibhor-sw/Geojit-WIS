// M3-UC2 — Six-Pillar Stock Analysis (Act 2). Composes Fundamental, Technical, Sentiment, Macro,
// Governance and Valuation pillars for one stock and normalises each to a 0-100 sub-score for
// downstream synthesis (M3-UC5). Fundamental valuation/forensic content is meant to be *sourced*
// from Module 1 in production; since Module 1 isn't built in this prototype, forensic scores are
// computed here directly from the synthetic financials using the spec's own formulas (labelled as
// such in the coachmark tour) rather than left blank.
const { STOCK_UNIVERSE, hashSeed, mulberry32, round2 } = require('../data/stockUniverse');

function findStock(id) {
  const s = STOCK_UNIVERSE.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown stock id: ${id}`);
  return s;
}

// ---- Fundamental pillar ----
function dupont5Factor(f) {
  const n = f.revenue.length - 1;
  const taxBurden = f.netIncome[n] / f.pretaxIncome[n];
  const interestBurden = f.pretaxIncome[n] / f.ebit[n];
  const operatingMargin = f.ebit[n] / f.revenue[n];
  const assetTurnover = f.revenue[n] / f.totalAssets[n];
  const leverage = f.totalAssets[n] / f.equity[n];
  const roe = taxBurden * interestBurden * operatingMargin * assetTurnover * leverage;
  return {
    taxBurden: round2(taxBurden), interestBurden: round2(interestBurden), operatingMargin: round2(operatingMargin * 100),
    assetTurnover: round2(assetTurnover), leverage: round2(leverage), roe: round2(roe * 100),
  };
}
function beneishMScore(f) {
  const n = f.revenue.length - 1;
  const dsri = (f.receivables[n] / f.revenue[n]) / (f.receivables[n - 1] / f.revenue[n - 1]);
  const gmi = ((f.revenue[n - 1] - f.cogs[n - 1]) / f.revenue[n - 1]) / ((f.revenue[n] - f.cogs[n]) / f.revenue[n]);
  const aqi = (1 - (f.currentAssets[n] + f.ppeGross[n]) / f.totalAssets[n]) / (1 - (f.currentAssets[n - 1] + f.ppeGross[n - 1]) / f.totalAssets[n - 1]);
  const sgi = f.revenue[n] / f.revenue[n - 1];
  const depi = (f.depreciation[n - 1] / (f.depreciation[n - 1] + f.ppeGross[n - 1])) / (f.depreciation[n] / (f.depreciation[n] + f.ppeGross[n]));
  const sgai = (f.sga[n] / f.revenue[n]) / (f.sga[n - 1] / f.revenue[n - 1]);
  const lvgi = ((f.totalDebt[n] + f.currentLiabilities[n]) / f.totalAssets[n]) / ((f.totalDebt[n - 1] + f.currentLiabilities[n - 1]) / f.totalAssets[n - 1]);
  const tata = (f.netIncome[n] - f.cfo[n]) / f.totalAssets[n];
  const m = -4.84 + 0.92 * dsri + 0.528 * gmi + 0.404 * aqi + 0.892 * sgi + 0.115 * depi - 0.172 * sgai + 4.679 * tata - 0.327 * lvgi;
  return { score: round2(m), flag: m > -1.78 ? 'Possible manipulation risk' : 'No flag' };
}
function sloanRatio(f) {
  const n = f.revenue.length - 1;
  const ratio = (f.netIncome[n] - f.cfo[n]) / f.totalAssets[n];
  return { score: round2(ratio * 100), flag: Math.abs(ratio) > 0.1 ? 'High accrual — earnings quality watch' : 'Normal accrual range' };
}
function altmanZ(f) {
  const n = f.revenue.length - 1;
  const wc = f.currentAssets[n] - f.currentLiabilities[n];
  const re = f.equity[n] * 0.4; // retained earnings proxy (no separate line item in this synthetic set)
  const mve = f.equity[n] * 1.3; // market value of equity proxy
  const z = 1.2 * (wc / f.totalAssets[n]) + 1.4 * (re / f.totalAssets[n]) + 3.3 * (f.ebit[n] / f.totalAssets[n])
    + 0.6 * (mve / (f.totalDebt[n] + f.currentLiabilities[n])) + 1.0 * (f.revenue[n] / f.totalAssets[n]);
  return { score: round2(z), zone: z > 2.99 ? 'Safe' : z > 1.81 ? 'Grey' : 'Distress' };
}
function piotroskiF(f) {
  const n = f.revenue.length - 1;
  const roa = f.netIncome[n] / f.totalAssets[n];
  const roaPrev = f.netIncome[n - 1] / f.totalAssets[n - 1];
  const tests = [
    f.netIncome[n] > 0,
    f.cfo[n] > 0,
    roa > roaPrev,
    f.cfo[n] > f.netIncome[n],
    (f.totalDebt[n] / f.totalAssets[n]) < (f.totalDebt[n - 1] / f.totalAssets[n - 1]),
    (f.currentAssets[n] / f.currentLiabilities[n]) > (f.currentAssets[n - 1] / f.currentLiabilities[n - 1]),
    true, // no new-share-issuance data in this synthetic set — assumed neutral/pass
    (f.revenue[n] / f.totalAssets[n]) > (f.revenue[n - 1] / f.totalAssets[n - 1]),
    ((f.revenue[n] - f.cogs[n]) / f.revenue[n]) > ((f.revenue[n - 1] - f.cogs[n - 1]) / f.revenue[n - 1]),
  ];
  return { score: tests.filter(Boolean).length, max: 9 };
}
function computeFundamental(stock) {
  const f = stock.financials;
  const dupont = dupont5Factor(f);
  const forensic = { beneish: beneishMScore(f), sloan: sloanRatio(f), altman: altmanZ(f), piotroski: piotroskiF(f) };
  const peers = STOCK_UNIVERSE.filter((s) => s.sector === stock.sector && s.id !== stock.id).slice(0, 5).map((p) => {
    const pn = p.financials.revenue.length - 1;
    return { id: p.id, name: p.name, roe: round2((p.financials.netIncome[pn] / p.financials.equity[pn]) * 100), revenueGrowth: round2(((p.financials.revenue[pn] / p.financials.revenue[pn - 1]) - 1) * 100) };
  });
  let subscore = 50;
  subscore += Math.max(-15, Math.min(15, (dupont.roe - 14) * 1.2));
  subscore += forensic.beneish.score < -1.78 ? 8 : -10;
  subscore += forensic.altman.zone === 'Safe' ? 10 : forensic.altman.zone === 'Grey' ? 0 : -15;
  subscore += (forensic.piotroski.score - 5) * 2.5;
  return { dupont, forensic, peers, sectorKPIs: sectorKPIs(stock), subscore: clamp0100(subscore) };
}
function sectorKPIs(stock) {
  const f = stock.financials;
  const n = f.revenue.length - 1;
  return [
    { label: 'Revenue CAGR (2yr)', value: round2((Math.pow(f.revenue[n] / f.revenue[0], 0.5) - 1) * 100) + '%' },
    { label: 'EBIT Margin', value: round2((f.ebit[n] / f.revenue[n]) * 100) + '%' },
    { label: 'Net Debt / EBIT', value: round2((f.totalDebt[n] - f.currentAssets[n] * 0.3) / f.ebit[n]) + 'x' },
    { label: 'Working Capital Days', value: Math.round((f.receivables[n] / f.revenue[n]) * 365) + ' days' },
  ];
}

// ---- Technical pillar ----
function smaAt(arr, w, end) { let s = 0; for (let i = end - w + 1; i <= end; i++) s += arr[i]; return s / w; }
function computeRSI(closes, period) {
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period, avgLoss = losses / period;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
function emaSeries(closes, window) {
  const k = 2 / (window + 1);
  const out = [closes[0]];
  for (let i = 1; i < closes.length; i++) out.push(closes[i] * k + out[i - 1] * (1 - k));
  return out;
}
function computeMACD(closes) {
  const ema12 = emaSeries(closes, 12), ema26 = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
  const signal = emaSeries(macdLine, 9);
  const hist = macdLine.map((v, i) => v - signal[i]);
  return { macd: round2(macdLine[macdLine.length - 1]), signal: round2(signal[signal.length - 1]), histogram: round2(hist[hist.length - 1]), bullishCross: hist[hist.length - 2] < 0 && hist[hist.length - 1] > 0 };
}
function computeBollinger(closes) {
  const window = 20;
  const slice = closes.slice(-window);
  const mean = slice.reduce((a, b) => a + b, 0) / window;
  const stdev = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / window);
  const upper = mean + 2 * stdev, lower = mean - 2 * stdev;
  const bandwidth = (upper - lower) / mean;
  return { upper: round2(upper), mid: round2(mean), lower: round2(lower), bandwidthPct: round2(bandwidth * 100), squeeze: bandwidth < 0.08 };
}
const STRATEGIES = [
  'MA Crossover + RSI Confirm', 'MACD + Volume Breakout', 'Bollinger Squeeze + RSI', 'EMA200 Filter + MACD',
  'RSI Divergence + Support', 'Golden Cross + OBV', 'BB Band-Touch + Fibonacci', 'MACD Divergence + Volume',
  'Death Cross Avoidance + RSI', 'KST Multi-Oscillator', 'Dow Theory Trend + MA', 'Delivery-Volume Confirmation',
];
function computeCombinationStrategies(isin) {
  const rng = mulberry32(hashSeed(isin + 'strategies'));
  return STRATEGIES.map((name) => ({ name, winRatePct: round2(72 + rng() * 18), signal: rng() > 0.5 ? 'Bullish' : 'Neutral' }));
}
function computeTechnical(stock) {
  const closes = stock.ohlcv.map((b) => b.close);
  const n = closes.length - 1;
  const ma50 = smaAt(closes, 50, n), ma200 = smaAt(closes, 200, n);
  const rsi14 = computeRSI(closes, 14);
  const macd = computeMACD(closes);
  const bb = computeBollinger(closes);
  const goldenCross = ma50 > ma200;
  const obv = stock.ohlcv.reduce((acc, b, i) => i === 0 ? b.volume : acc + (b.close > stock.ohlcv[i - 1].close ? b.volume : -b.volume), 0);
  const patterns = [];
  if (goldenCross && closes[n - 20] < smaAt(closes, 50, n - 20)) patterns.push('Golden Cross (50/200 EMA)');
  if (rsi14 < 30) patterns.push('RSI Oversold Reversal Setup');
  if (rsi14 > 70) patterns.push('RSI Overbought — Momentum Extended');
  if (bb.squeeze) patterns.push('Bollinger Squeeze — Breakout Watch');
  if (macd.bullishCross) patterns.push('MACD Bullish Crossover');
  const strategies = computeCombinationStrategies(stock.isin);
  let subscore = 50;
  subscore += goldenCross ? 12 : -12;
  subscore += (rsi14 - 50) * 0.4;
  subscore += macd.histogram > 0 ? 8 : -8;
  subscore += (strategies.filter((s) => s.signal === 'Bullish').length - 6) * 2;
  return {
    indicators: { ma50: round2(ma50), ma200: round2(ma200), goldenCross, rsi14: round2(rsi14), macd, bollinger: bb, obvTrend: obv > 0 ? 'Accumulation' : 'Distribution' },
    patterns, strategies, subscore: clamp0100(subscore),
  };
}

// ---- Sentiment pillar ----
const HEADLINE_BANK = [
  { text: 'strong quarterly results beat estimates', weight: 2 }, { text: 'management raises guidance', weight: 2 },
  { text: 'new order win announced', weight: 1.5 }, { text: 'analyst upgrades target price', weight: 1.5 },
  { text: 'regulatory concerns flagged by watchdog', weight: -2 }, { text: 'margin pressure from input costs', weight: -1.5 },
  { text: 'promoter stake sale reported', weight: -1.8 }, { text: 'stable outlook maintained by rating agency', weight: 0.5 },
  { text: 'expansion into new market segment', weight: 1.2 }, { text: 'litigation risk disclosed in filing', weight: -1.3 },
];
function computeSentiment(stock) {
  const rng = mulberry32(hashSeed(stock.isin + 'sentiment'));
  const channels = ['News', 'Social', 'Analyst Notes', 'Filings', 'Earnings Call Tone', 'Search Trends'];
  const items = [];
  for (let i = 0; i < 8; i++) {
    const h = HEADLINE_BANK[Math.floor(rng() * HEADLINE_BANK.length)];
    items.push({ headline: `${stock.name}: ${h.text}`, channel: channels[Math.floor(rng() * channels.length)], score: round2(h.weight + (rng() - 0.5)) });
  }
  const channelScores = channels.map((c) => {
    const relevant = items.filter((i) => i.channel === c);
    const avg = relevant.length ? relevant.reduce((a, b) => a + b.score, 0) / relevant.length : 0;
    return { channel: c, score: round2(avg), factorCount: relevant.length || 1 };
  });
  const weights = { News: 0.25, Social: 0.1, 'Analyst Notes': 0.2, Filings: 0.15, 'Earnings Call Tone': 0.15, 'Search Trends': 0.15 };
  const css = channelScores.reduce((a, c) => a + c.score * weights[c.channel], 0);
  const vocalTension = round2(30 + rng() * 40); // Should-Have, advisory only
  const cssMultiplier = css > 1 ? 1.08 : css < -1 ? 0.92 : 1.0;
  const subscore = clamp0100(50 + css * 15);
  return { css: round2(css), channelScores, catalysts: items.slice(0, 5), vocalTension, cssMultiplier, subscore };
}

// ---- Macro pillar ----
const MACRO_SERIES = { gdpGrowthPct: 6.8, cpiPct: 4.9, repoRatePct: 6.25, crrPct: 4.5, fdiFlowUsdBn: 3.2, usdInr: 84.2 };
const SECTOR_MACRO_SENSITIVITY = {
  'Financial Services': { repo: -1.2, cpi: -0.3 }, 'Information Technology': { usdinr: 0.9, gdp: 0.2 },
  'Automobile and Auto Components': { repo: -0.8, gdp: 0.9 }, 'Metals & Mining': { gdp: 1.1, usdinr: -0.4 },
  'Oil Gas & Consumable Fuels': { usdinr: -0.9, gdp: 0.5 },
};
function computeMacro(stock) {
  const sens = SECTOR_MACRO_SENSITIVITY[stock.sector] || { gdp: 0.4, repo: -0.3 };
  const impact = (sens.repo || 0) * (MACRO_SERIES.repoRatePct - 6) + (sens.gdp || 0) * (MACRO_SERIES.gdpGrowthPct - 6.5) + (sens.usdinr || 0) * ((MACRO_SERIES.usdInr - 83) / 10);
  const subscore = clamp0100(50 + impact * 15);
  return { series: MACRO_SERIES, sectorSensitivity: sens, quantifiedImpact: round2(impact), subscore };
}

// ---- Governance pillar ----
function computeGovernance(stock) {
  const g = stock.governance;
  let subscore = 70;
  subscore -= g.promoterPledgePct > 0 ? Math.min(30, g.promoterPledgePct * 1.5) : 0;
  subscore += g.rptFlag ? -15 : 5;
  subscore += (g.boardIndependencePct - 50) * 0.3;
  return { ...g, flags: [g.promoterPledgePct > 5 ? 'Elevated promoter pledge' : null, g.rptFlag ? 'Related-party transaction on record' : null].filter(Boolean), subscore: clamp0100(subscore) };
}

// ---- Valuation meter ----
function impliedPE(stock) {
  // No real shares-outstanding figure in this synthetic set; derive a plausible P/E directly
  // (seeded per ISIN so it's stable across runs) rather than dividing price by an arbitrarily
  // scaled EPS, which produced meaningless multiples.
  const rng = mulberry32(hashSeed(stock.isin + 'pe'));
  const qualityTilt = stock.financials.netIncome[stock.financials.netIncome.length - 1] > stock.financials.netIncome[0] ? 3 : -3;
  return round2(Math.max(6, 14 + qualityTilt + rngNormalLike(rng) * 8));
}
function rngNormalLike(rng) { return (rng() + rng() + rng() - 1.5) / 1.5; }
function computeValuationMeter(stock) {
  const f = stock.financials;
  const n = f.revenue.length - 1;
  const pe = impliedPE(stock);
  const eps = round2(stock.currentPrice / pe);
  const peers = STOCK_UNIVERSE.filter((s) => s.sector === stock.sector);
  const peerPEs = peers.map((p) => impliedPE(p));
  const sectorMedianPE = median(peerPEs);
  const relative = pe / sectorMedianPE;
  let band;
  if (relative < 0.7) band = 'Very Attractive'; else if (relative < 0.9) band = 'Attractive';
  else if (relative < 1.15) band = 'Fair'; else if (relative < 1.4) band = 'Expensive'; else band = 'Very Expensive';
  const subscore = clamp0100(100 - (relative - 0.5) * 60);
  return { pe: round2(pe), eps, sectorMedianPE: round2(sectorMedianPE), relativeToSector: round2(relative), band, subscore };
}
function median(arr) { const s = [...arr].sort((a, b) => a - b); const mid = Math.floor(s.length / 2); return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2; }
function clamp0100(v) { return Math.max(0, Math.min(100, round2(v))); }

function runSixPillarAnalysis(payload) {
  const stockId = (payload && payload.stockId) || 'INFY';
  const stock = findStock(stockId);
  const fundamentalPillar = computeFundamental(stock);
  const technicalPillar = computeTechnical(stock);
  const sentimentPillar = computeSentiment(stock);
  const macroPillar = computeMacro(stock);
  const governancePillar = computeGovernance(stock);
  const valuationMeter = computeValuationMeter(stock);
  return {
    stock: { id: stock.id, name: stock.name, sector: stock.sector, macap: stock.macap, currentPrice: stock.currentPrice },
    fundamentalPillar, technicalPillar, sentimentPillar, macroPillar, governancePillar, valuationMeter,
    pillarScores: {
      fundamental: fundamentalPillar.subscore, technical: technicalPillar.subscore, sentiment: sentimentPillar.subscore,
      macro: macroPillar.subscore, governance: governancePillar.subscore, valuation: valuationMeter.subscore,
    },
  };
}

module.exports = { runSixPillarAnalysis, findStock };
