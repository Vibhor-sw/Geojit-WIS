// M5-UC4 — Analyst Estimate Aggregation & De-Biasing. A synthetic sell-side panel per stock (no
// licensed I/B/E/S/Capital IQ feed in this prototype) aggregated into consensus statistics, with a
// genuine accuracy-weighted, staleness-decayed, optimism-corrected de-biasing layer computed from
// each analyst's own (synthetic) track record — not a canned "adjusted number".
const { STOCK_UNIVERSE, hashSeed, mulberry32, round2 } = require('../data/stockUniverse');

function findStock(id) {
  const s = STOCK_UNIVERSE.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown stock id: ${id}`);
  return s;
}

const BROKERS = [
  'Geojit Research', 'ICICI Securities', 'Motilal Oswal', 'Kotak Institutional', 'HDFC Securities',
  'Nomura', 'CLSA', 'Jefferies', 'Morgan Stanley', 'Antique Stock Broking', 'Emkay Global', 'JM Financial',
  'Nuvama', 'Prabhudas Lilladher',
];

function impliedEps(stock) {
  const rng = mulberry32(hashSeed(stock.isin + 'pe'));
  const qualityTilt = stock.financials.netIncome[stock.financials.netIncome.length - 1] > stock.financials.netIncome[0] ? 3 : -3;
  const rn = (rng() + rng() + rng() - 1.5) / 1.5;
  const pe = Math.max(6, 14 + qualityTilt + rn * 8);
  return round2(stock.currentPrice / pe);
}

function buildAnalystPanel(stock) {
  const rng = mulberry32(hashSeed(stock.isin + 'analysts'));
  const count = 6 + Math.floor(rng() * 8); // 6-13 analysts
  const eps0 = impliedEps(stock);
  const revenue0 = stock.financials.revenue[stock.financials.revenue.length - 1];
  const shuffled = [...BROKERS].sort(() => rng() - 0.5).slice(0, count);
  return shuffled.map((broker, i) => {
    const brokerRng = mulberry32(hashSeed(stock.isin + broker));
    const epsBias = (brokerRng() - 0.35) * 0.14; // slight systematic optimism skew across the panel
    const epsEstimate = round2(eps0 * (1 + epsBias));
    const revenueEstimate = round2(revenue0 * (1 + (brokerRng() - 0.4) * 0.1));
    const targetUpside = 0.02 + brokerRng() * 0.28;
    const targetPrice = round2(stock.currentPrice * (1 + targetUpside));
    const historicalMAEPct = round2(2 + brokerRng() * 10); // mean absolute EPS forecast error, % — lower is more accurate
    const ageInDays = Math.round(brokerRng() * 120);
    const revisionsLast90d = Math.round((brokerRng() - 0.5) * 4); // net +ve = upgrades, -ve = downgrades
    return { broker, epsEstimate, revenueEstimate, targetPrice, historicalMAEPct, ageInDays, revisionsLast90d, active: ageInDays <= 90 };
  });
}

function median(arr) { const s = [...arr].sort((a, b) => a - b); const mid = Math.floor(s.length / 2); return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2; }
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function stdev(arr) { const m = mean(arr); return Math.sqrt(arr.reduce((a, v) => a + (v - m) ** 2, 0) / arr.length); }

function runAnalystEstimates(payload) {
  const p = payload || {};
  const stockId = p.stockId || 'INFY';
  const staleLambda = p.staleLambda != null ? p.staleLambda : 0.02;
  const stock = findStock(stockId);
  const panel = buildAnalystPanel(stock);
  const active = panel.filter((a) => a.active);
  const pool = active.length ? active : panel;

  const epsValues = pool.map((a) => a.epsEstimate);
  const targetValues = pool.map((a) => a.targetPrice);
  const revenueValues = pool.map((a) => a.revenueEstimate);
  const consensus = {
    eps: { mean: round2(mean(epsValues)), median: round2(median(epsValues)), high: round2(Math.max(...epsValues)), low: round2(Math.min(...epsValues)) },
    target: { mean: round2(mean(targetValues)), median: round2(median(targetValues)), high: round2(Math.max(...targetValues)), low: round2(Math.min(...targetValues)) },
    revenue: { mean: round2(mean(revenueValues)), median: round2(median(revenueValues)), high: round2(Math.max(...revenueValues)), low: round2(Math.min(...revenueValues)) },
    analystCount: pool.length,
  };
  const dispersion = { epsCoV: round2((stdev(epsValues) / Math.abs(mean(epsValues))) * 100), targetCoV: round2((stdev(targetValues) / Math.abs(mean(targetValues))) * 100) };

  const upgrades = panel.filter((a) => a.revisionsLast90d > 0).length;
  const downgrades = panel.filter((a) => a.revisionsLast90d < 0).length;
  const revisionMomentum = { upgrades, downgrades, netRevisions: upgrades - downgrades, diffusionIndex: round2(((upgrades - downgrades) / panel.length) * 100) };

  // Accuracy weight inversely proportional to historical MAE, staleness-decayed, renormalised.
  const rawWeights = pool.map((a) => (1 / Math.max(0.5, a.historicalMAEPct)) * Math.exp(-staleLambda * a.ageInDays));
  const weightSum = rawWeights.reduce((a, b) => a + b, 0);
  const analystAccuracy = pool.map((a, i) => ({ broker: a.broker, historicalMAEPct: a.historicalMAEPct, ageInDays: a.ageInDays, accuracyWeight: round2(rawWeights[i] / weightSum) }));

  const weightedEps = pool.reduce((acc, a, i) => acc + a.epsEstimate * (rawWeights[i] / weightSum), 0);
  const weightedTarget = pool.reduce((acc, a, i) => acc + a.targetPrice * (rawWeights[i] / weightSum), 0);
  // Optimism correction: sell-side EPS estimates are seeded with a systematic +optimism skew (see
  // buildAnalystPanel); measure it as the average of each estimate's deviation from the panel's
  // most-accurate quartile and net it out, rather than applying an arbitrary fixed haircut.
  const sortedByAccuracy = [...pool].sort((a, b) => a.historicalMAEPct - b.historicalMAEPct);
  const topQuartileCount = Math.max(1, Math.round(pool.length * 0.25));
  const topQuartileEpsAvg = mean(sortedByAccuracy.slice(0, topQuartileCount).map((a) => a.epsEstimate));
  const optimismCorrectionPct = round2(((mean(epsValues) - topQuartileEpsAvg) / mean(epsValues)) * 100);
  const adjustedEps = round2(weightedEps - (weightedEps * optimismCorrectionPct / 100));
  const adjustedTarget = round2(weightedTarget);

  const adjustedConsensus = {
    eps: adjustedEps, target: adjustedTarget,
    realisticRange: { low: round2(adjustedEps * 0.94), high: round2(adjustedEps * 1.06) },
    optimismCorrectionPct,
  };

  return {
    stock: { id: stock.id, name: stock.name, sector: stock.sector, currentPrice: stock.currentPrice },
    panel, consensus, dispersion, revisionMomentum, adjustedConsensus, analystAccuracy,
  };
}

module.exports = { runAnalystEstimates };
