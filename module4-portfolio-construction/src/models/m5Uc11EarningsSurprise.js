// M5-UC11 — Earnings Surprise & Event Prediction. Reuses M5-UC4's consensus/dispersion/revision
// signals (the spec's "estimates feed surprise prediction" shared core), adds a synthetic
// options-implied-move and historical-surprise-pattern feature, and combines them through a
// calibrated logistic beat/miss probability. Expected reaction and PEAD are derived from a
// synthetic historical surprise→reaction relationship; an event calendar scores every upcoming
// result by |expected move| × confidence.
const { STOCK_UNIVERSE, hashSeed, mulberry32, round2 } = require('../data/stockUniverse');
const { runAnalystEstimates } = require('./m5Uc4AnalystEstimates');

function findStock(id) { const s = STOCK_UNIVERSE.find((x) => x.id === id); if (!s) throw new Error(`Unknown stock id: ${id}`); return s; }

function historicalSurprises(stock) {
  const rng = mulberry32(hashSeed(stock.isin + 'surprise-history'));
  const quarters = 6;
  const surprises = [];
  for (let i = 0; i < quarters; i++) surprises.push(round2((rng() - 0.42) * 12)); // mild positive skew, typical of sell-side beat bias
  return surprises;
}
function impliedMove(stock) {
  const rng = mulberry32(hashSeed(stock.isin + 'options-implied'));
  const base = stock.macap === 'Large' ? 3.5 : stock.macap === 'Mid' ? 5.5 : 8;
  return round2(base + rng() * 3);
}

function logistic(z) { return 1 / (1 + Math.exp(-z)); }

function computeBeatProbability(estimates, surpriseHistory, impliedMovePct) {
  const revisionSignal = estimates.revisionMomentum.diffusionIndex / 100; // -1..1
  const historicalBeatRate = surpriseHistory.filter((s) => s > 0).length / surpriseHistory.length;
  const dispersionPenalty = Math.min(1, estimates.dispersion.epsCoV / 15);
  const z = 1.1 * revisionSignal + 1.4 * (historicalBeatRate - 0.5) - 0.6 * dispersionPenalty - 0.15 * (impliedMovePct / 10 - 0.5);
  const pBeat = logistic(z);
  return { pBeat: round2(pBeat * 100), historicalBeatRatePct: round2(historicalBeatRate * 100), z: round2(z) };
}

function expectedReaction(estimates, pBeatPct, surpriseHistory) {
  const avgAbsSurprise = surpriseHistory.reduce((a, s) => a + Math.abs(s), 0) / surpriseHistory.length;
  const expectedSurprisePct = round2((pBeatPct / 100 - 0.5) * 2 * avgAbsSurprise); // signed, scales with directional conviction
  const reactionSensitivity = 0.45; // % price move per 1% earnings surprise, illustrative
  const initialReactionPct = round2(expectedSurprisePct * reactionSensitivity);
  const peadContinuationPct = round2(initialReactionPct * 0.35); // PEAD: partial continuation over the following weeks
  return { expectedSurprisePct, initialReactionPct, peadContinuationPct, peadWindow: '20 trading days' };
}

function runEventScore(stock) {
  const estimates = runAnalystEstimates({ stockId: stock.id });
  const surpriseHistory = historicalSurprises(stock);
  const impliedMovePct = impliedMove(stock);
  const beat = computeBeatProbability(estimates, surpriseHistory, impliedMovePct);
  const reaction = expectedReaction(estimates, beat.pBeat, surpriseHistory);
  const confidence = round2(Math.abs(beat.pBeat - 50) / 50 * 100); // how far from a coin-flip
  const eventScore = round2(Math.abs(reaction.initialReactionPct) * (confidence / 100));
  return { id: stock.id, name: stock.name, sector: stock.sector, beat, reaction, impliedMovePct, surpriseHistory, confidence, eventScore, consensusEps: estimates.consensus.eps, adjustedEps: estimates.adjustedConsensus.eps };
}

function backtestAccuracy(stock) {
  // Retrospective check: for each historical quarter (except the first), predict the sign of that
  // quarter's surprise using only the *prior* quarters' surprise history, and compare to what
  // actually happened — a genuine (very small-sample) accuracy check, not a canned percentage.
  const history = historicalSurprises(stock);
  let hits = 0, evaluated = 0;
  for (let i = 1; i < history.length; i++) {
    const priorBeatRate = history.slice(0, i).filter((s) => s > 0).length / i;
    const predictedSign = priorBeatRate >= 0.5 ? 1 : -1;
    const actualSign = history[i] >= 0 ? 1 : -1;
    if (predictedSign === actualSign) hits++;
    evaluated++;
  }
  return { evaluated, hits, accuracyPct: round2((hits / (evaluated || 1)) * 100) };
}

function runEarningsSurprise(payload) {
  const p = payload || {};
  const stockId = p.stockId || 'INFY';
  const stock = findStock(stockId);
  const focusEvent = runEventScore(stock);
  const accuracyTracking = backtestAccuracy(stock);

  // Event calendar: score every stock with an event in the next 30 days (deterministic synthetic
  // dates, consistent with the Module 3 earnings-hub approach) so this reads as a real calendar,
  // not just the single focus stock.
  const eventCalendar = STOCK_UNIVERSE.map((s) => {
    const rng = mulberry32(hashSeed(s.isin + 'eventdate'));
    const daysAhead = Math.round(rng() * 45);
    if (daysAhead > 30) return null;
    const date = new Date(new Date('2026-07-08').getTime() + daysAhead * 86400000).toISOString().slice(0, 10);
    const scored = runEventScore(s);
    return { id: s.id, name: s.name, date, pBeatPct: scored.beat.pBeat, expectedMovePct: scored.reaction.initialReactionPct, eventScore: scored.eventScore };
  }).filter(Boolean).sort((a, b) => b.eventScore - a.eventScore);

  return {
    surprisePrediction: { stockId: stock.id, name: stock.name, pBeatPct: focusEvent.beat.pBeat, historicalBeatRatePct: focusEvent.beat.historicalBeatRatePct, expectedSurprisePct: focusEvent.reaction.expectedSurprisePct, consensusEps: focusEvent.consensusEps, adjustedEps: focusEvent.adjustedEps, impliedMovePct: focusEvent.impliedMovePct },
    expectedReaction: focusEvent.reaction,
    eventScores: eventCalendar.slice(0, 15),
    eventCalendar: eventCalendar.slice(0, 15),
    accuracyTracking,
    surpriseHistory: focusEvent.surpriseHistory,
  };
}

module.exports = { runEarningsSurprise };
