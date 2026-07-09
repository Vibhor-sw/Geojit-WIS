// M3-UC5 — Synthesis & Conviction Score (Act 5). Deterministic weighted composition over the six
// pillar sub-scores into a 0-100 Conviction Score + rating, an append-only tamper-evident ledger
// (SHA-256 hash chain per FR-CS/SEBI RA Reg 16(2)), recommendation-vs-OHLC tracking, a non-published
// scenario sandbox, and auto-attached SEBI RA disclosures. The score aggregates upstream signals; it
// never originates new valuations (Act 5 constraint).
const crypto = require('crypto');
const { findStock } = require('./m3Act2SixPillar');
const { runSixPillarAnalysis } = require('./m3Act2SixPillar');
const { round2 } = require('../data/stockUniverse');

const DEFAULT_WEIGHTS = { fundamental: 0.25, technical: 0.15, sentiment: 0.1, macro: 0.1, governance: 0.15, valuation: 0.25 };

function computeConviction(pillarScores, weights) {
  const w = weights || DEFAULT_WEIGHTS;
  const weightSum = Object.values(w).reduce((a, b) => a + b, 0);
  const score = Object.keys(w).reduce((acc, k) => acc + (w[k] / weightSum) * (pillarScores[k] || 0), 0);
  return round2(score);
}
function bandToRating(score) {
  if (score >= 80) return 'Strong Buy';
  if (score >= 65) return 'Buy';
  if (score >= 45) return 'Hold';
  if (score >= 30) return 'Sell';
  return 'Strong Sell';
}
function buildNarrative(stock, pillars, score, rating) {
  const strongest = Object.entries(pillars).sort((a, b) => b[1] - a[1])[0];
  const weakest = Object.entries(pillars).sort((a, b) => a[1] - b[1])[0];
  return `${stock.name} scores ${score}/100 (${rating}). Strongest contributor: ${strongest[0]} (${strongest[1]}). ` +
    `Weakest contributor: ${weakest[0]} (${weakest[1]}). Composed from the six pillar sub-scores under governed weights; ` +
    `this narrative is templated from the underlying data in this prototype — production wires it to Module 1's research-engine narrative.`;
}

// In-memory append-only ledger (per Node process) — resets on server restart. A production build
// would persist this to a write-once store with the required >=5-year retention.
const LEDGER = [];
function ledgerHash(entry, prevHash) {
  return crypto.createHash('sha256').update(JSON.stringify(entry) + '|' + prevHash).digest('hex');
}
function appendLedgerEntry(stockId, score, rating, price) {
  const prevHash = LEDGER.length ? LEDGER[LEDGER.length - 1].hash : '0'.repeat(64);
  const entry = { stockId, score, rating, priceAtCall: price, timestamp: new Date().toISOString(), prevHash };
  entry.hash = ledgerHash(entry, prevHash);
  LEDGER.push(entry);
  return entry;
}
function verifyLedgerIntegrity() {
  for (let i = 0; i < LEDGER.length; i++) {
    const e = LEDGER[i];
    const expectedPrev = i === 0 ? '0'.repeat(64) : LEDGER[i - 1].hash;
    if (e.prevHash !== expectedPrev) return { intact: false, brokenAt: i };
    const { hash, ...rest } = e;
    if (ledgerHash(rest, e.prevHash) !== hash) return { intact: false, brokenAt: i };
  }
  return { intact: true, entries: LEDGER.length };
}

function buildRecommendationTimeline(stock, stockId) {
  const priorCalls = LEDGER.filter((e) => e.stockId === stockId);
  return priorCalls.map((e) => ({
    date: e.timestamp.slice(0, 10), rating: e.rating, score: e.score, priceAtCall: e.priceAtCall,
    currentPrice: stock.currentPrice, realisedPerformancePct: round2(((stock.currentPrice - e.priceAtCall) / e.priceAtCall) * 100),
  }));
}

function runScenarioSandbox(stock, pillarScores, weights, macroDeltas) {
  const d = macroDeltas || {};
  const adjusted = { ...pillarScores };
  adjusted.macro = Math.max(0, Math.min(100, pillarScores.macro + (d.gdpDelta || 0) * 3 - (d.repoDelta || 0) * 2 - (d.inrDelta || 0) * 1.5));
  const sandboxScore = computeConviction(adjusted, weights);
  const intrinsicShift = round2(((sandboxScore - computeConviction(pillarScores, weights)) / 100) * stock.currentPrice);
  return { adjustedPillars: adjusted, sandboxScore, sandboxRating: bandToRating(sandboxScore), impliedIntrinsicValue: round2(stock.currentPrice + intrinsicShift), exploratory: true, published: false };
}

const SEBI_DISCLOSURES = {
  analyst: 'WIS Research Desk (SEBI RA Reg. placeholder)', disclosure: 'This is a model-generated view for illustrative/prototype purposes and does not constitute investment advice. Past performance is not indicative of future results.',
  regulatoryRef: 'SEBI (Research Analysts) Regulations — Reg 16(2): recommendation records must be immutable, timestamped and retained for a minimum of 5 years.',
};

function runConvictionSynthesis(payload) {
  const p = payload || {};
  const stockId = p.stockId || 'INFY';
  const weights = p.weights || DEFAULT_WEIGHTS;
  const stock = findStock(stockId);
  const pillars = runSixPillarAnalysis({ stockId });
  const score = computeConviction(pillars.pillarScores, weights);
  const rating = bandToRating(score);
  const narrative = buildNarrative(stock, pillars.pillarScores, score, rating);
  const ledgerEntry = p.publish ? appendLedgerEntry(stockId, score, rating, stock.currentPrice) : null;
  const recommendationTimeline = buildRecommendationTimeline(stock, stockId);
  const sandboxResult = p.sandbox ? runScenarioSandbox(stock, pillars.pillarScores, weights, p.sandbox) : null;
  return {
    stock: pillars.stock, pillarScores: pillars.pillarScores, weightsUsed: weights,
    convictionScore: score, rating, narrative, ledgerEntry, recommendationTimeline, sandboxResult,
    ledgerIntegrity: verifyLedgerIntegrity(), disclosures: SEBI_DISCLOSURES,
  };
}

module.exports = { runConvictionSynthesis, computeConviction, bandToRating, DEFAULT_WEIGHTS, LEDGER, verifyLedgerIntegrity };
