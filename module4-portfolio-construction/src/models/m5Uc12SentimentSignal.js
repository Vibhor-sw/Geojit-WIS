// M5-UC12 — Sentiment & News Signal Extraction. The spec calls this out as the same NLP core used
// by Module 3's Sentiment pillar (FR-SA), reused/aggregated up to security, sector and market level
// with source-reliability and recency weighting, plus momentum/anomaly detection and a
// provenance-tagged signal feed. Implemented as its own decoupled copy of the weighted-CSS approach
// (rather than a literal cross-module import) so the Node and static-bundle builds stay collision-
// free — see the earlier Module 3/4 static-bundle naming-collision lesson.
const { STOCK_UNIVERSE, hashSeed, mulberry32, round2 } = require('../data/stockUniverse');

const CHANNELS = ['News', 'Social', 'Analyst Notes', 'Filings', 'Earnings Call Tone', 'Search Trends'];
const CHANNEL_RELIABILITY = { News: 0.85, Social: 0.5, 'Analyst Notes': 0.95, Filings: 0.9, 'Earnings Call Tone': 0.75, 'Search Trends': 0.4 };
const CHANNEL_WEIGHT = { News: 0.25, Social: 0.1, 'Analyst Notes': 0.2, Filings: 0.15, 'Earnings Call Tone': 0.15, 'Search Trends': 0.15 };

const EVENT_BANK = [
  { text: 'brokerage upgrades rating and raises target price', weight: 2, eventClass: 'Analyst Upgrade' },
  { text: 'management commentary signals stronger order pipeline', weight: 1.5, eventClass: 'Order Win' },
  { text: 'quarterly results beat street estimates', weight: 2, eventClass: 'Earnings Beat' },
  { text: 'regulatory notice issued over compliance lapse', weight: -2.2, eventClass: 'Litigation/Regulatory' },
  { text: 'senior management exit announced', weight: -1.6, eventClass: 'Management Change' },
  { text: 'promoter stake sale disclosed to exchanges', weight: -1.8, eventClass: 'Ownership Change' },
  { text: 'brokerage downgrades on margin concerns', weight: -1.7, eventClass: 'Analyst Downgrade' },
  { text: 'new capacity expansion announced', weight: 1.3, eventClass: 'Capex/Expansion' },
  { text: 'credit rating agency affirms stable outlook', weight: 0.6, eventClass: 'Rating Action' },
  { text: 'litigation risk flagged in exchange filing', weight: -1.4, eventClass: 'Litigation/Regulatory' },
];

function documentSentimentForStock(stock, docCount) {
  const rng = mulberry32(hashSeed(stock.isin + 'nlp-docs'));
  const docs = [];
  for (let i = 0; i < docCount; i++) {
    const item = EVENT_BANK[Math.floor(rng() * EVENT_BANK.length)];
    const channel = CHANNELS[Math.floor(rng() * CHANNELS.length)];
    const recencyDays = Math.round(rng() * 14);
    const score = round2(item.weight + (rng() - 0.5));
    docs.push({ headline: `${stock.name}: ${item.text}`, channel, eventClass: item.eventClass, score, recencyDays, sourceReliability: CHANNEL_RELIABILITY[channel] });
  }
  return docs;
}

function aggregateSentiment(docs) {
  const decayLambda = 0.05;
  let weightedSum = 0, weightSum = 0;
  docs.forEach((d) => {
    const w = d.sourceReliability * Math.exp(-decayLambda * d.recencyDays) * CHANNEL_WEIGHT[d.channel];
    weightedSum += d.score * w;
    weightSum += w;
  });
  return round2(weightedSum / (weightSum || 1));
}

function buildSentimentHistory(stock, periods) {
  const rng = mulberry32(hashSeed(stock.isin + 'sentiment-history'));
  const vals = [];
  let level = 0;
  for (let i = 0; i < periods; i++) { level = level * 0.6 + (rng() - 0.5) * 1.8; vals.push(round2(level)); }
  return vals;
}
function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function stdev(a) { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); }

function securitySignal(stock) {
  const docs = documentSentimentForStock(stock, 10);
  const currentSentiment = aggregateSentiment(docs);
  const history = buildSentimentHistory(stock, 20);
  const fullHistory = [...history, currentSentiment];
  const momentum = round2(currentSentiment - history[history.length - 1]);
  const histMean = mean(history), histStdev = stdev(history) || 1;
  const anomalyZ = round2((currentSentiment - histMean) / histStdev);
  const isAnomaly = Math.abs(anomalyZ) > 1.8;
  const events = docs.filter((d) => Math.abs(d.score) > 1.3).map((d) => ({ headline: d.headline, eventClass: d.eventClass, confidence: round2(Math.min(1, Math.abs(d.score) / 2.5) * d.sourceReliability * 100) }));
  return { id: stock.id, name: stock.name, sector: stock.sector, sentiment: currentSentiment, momentum, anomalyZ, isAnomaly, docs, events, history: fullHistory };
}

function runSentimentSignal(payload) {
  const p = payload || {};
  const focusStockId = p.stockId || 'INFY';
  const focusStock = STOCK_UNIVERSE.find((s) => s.id === focusStockId);
  if (!focusStock) throw new Error(`Unknown stock id: ${focusStockId}`);

  const securityLevel = securitySignal(focusStock);

  const sectorPeers = STOCK_UNIVERSE.filter((s) => s.sector === focusStock.sector);
  const sectorSignals = sectorPeers.map((s) => securitySignal(s));
  const sectorSentiment = round2(mean(sectorSignals.map((s) => s.sentiment)));

  const marketSignals = STOCK_UNIVERSE.map((s) => (s.id === focusStock.id ? securityLevel : securitySignal(s)));
  const marketSentiment = round2(mean(marketSignals.map((s) => s.sentiment)));

  const anomalies = marketSignals.filter((s) => s.isAnomaly).map((s) => ({ id: s.id, name: s.name, anomalyZ: s.anomalyZ, sentiment: s.sentiment }));
  const events = securityLevel.events;

  return {
    sentimentScores: {
      security: { id: securityLevel.id, name: securityLevel.name, score: securityLevel.sentiment, momentum: securityLevel.momentum, history: securityLevel.history },
      sector: { name: focusStock.sector, score: sectorSentiment, constituentCount: sectorPeers.length },
      market: { score: marketSentiment, constituentCount: STOCK_UNIVERSE.length },
    },
    events,
    sentimentMomentum: { securityMomentum: securityLevel.momentum, anomalies: anomalies.slice(0, 8) },
    signalFeed: {
      provenance: securityLevel.docs.map((d) => ({ headline: d.headline, channel: d.channel, sourceReliability: d.sourceReliability, recencyDays: d.recencyDays, score: d.score })),
      confidence: round2(mean(securityLevel.docs.map((d) => d.sourceReliability)) * 100),
      note: 'This is the same weighted-CSS approach as Module 3\'s Sentiment pillar (FR-SA), aggregated here to security/sector/market level and reused as a signal feed — mirroring the spec\'s "shared NLP core" build note.',
    },
  };
}

module.exports = { runSentimentSignal };
