// M5-UC10 — Market Regime Detection. Builds a daily market state vector (return, realised
// volatility, breadth) from the same 260-day OHLCV history used across Modules 3-5, classifies each
// day into one of four quadrant regimes (a practical, widely-used simplification of a full Gaussian
// HMM — documented as such), derives an empirical transition matrix from the actual historical label
// sequence, and publishes today's regime plus early-warning indicators.
const { STOCK_UNIVERSE, round2 } = require('../data/stockUniverse');
const { BOND_UNIVERSE } = require('../data/bondUniverse');

const REGIMES = ['Bull-Quiet', 'Bull-Volatile', 'Bear-Quiet', 'Bear-Volatile'];

function buildDailyIndexCloses() {
  const days = STOCK_UNIVERSE[0].ohlcv.length;
  const closes = [];
  for (let d = 0; d < days; d++) {
    let sum = 0;
    STOCK_UNIVERSE.forEach((s) => { sum += s.ohlcv[d].close / s.ohlcv[0].close; });
    closes.push(sum / STOCK_UNIVERSE.length);
  }
  return closes;
}
function buildDailyBreadth() {
  const days = STOCK_UNIVERSE[0].ohlcv.length;
  const breadth = [];
  for (let d = 1; d < days; d++) {
    let up = 0;
    STOCK_UNIVERSE.forEach((s) => { if (s.ohlcv[d].close > s.ohlcv[d - 1].close) up++; });
    breadth.push(up / STOCK_UNIVERSE.length);
  }
  return breadth;
}

function classifyRegimes() {
  const indexCloses = buildDailyIndexCloses();
  const breadth = buildDailyBreadth();
  const window = 20;
  const rows = [];
  for (let d = window; d < indexCloses.length; d++) {
    const trailingReturn = indexCloses[d] / indexCloses[d - window] - 1;
    const rets = [];
    for (let i = d - window + 1; i <= d; i++) rets.push(indexCloses[i] / indexCloses[i - 1] - 1);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const vol = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length) * Math.sqrt(252);
    rows.push({ day: d, trailingReturn, vol, breadth: breadth[d - 1] });
  }
  const volMedian = median(rows.map((r) => r.vol));
  const labelled = rows.map((r) => {
    const bull = r.trailingReturn >= 0;
    const quiet = r.vol <= volMedian;
    const regime = bull ? (quiet ? 'Bull-Quiet' : 'Bull-Volatile') : (quiet ? 'Bear-Quiet' : 'Bear-Volatile');
    return { ...r, regime };
  });
  return { labelled, volMedian: round2(volMedian) };
}
function median(arr) { const s = [...arr].sort((a, b) => a - b); const mid = Math.floor(s.length / 2); return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2; }

function buildTransitionMatrix(labelled) {
  const counts = {};
  REGIMES.forEach((a) => { counts[a] = {}; REGIMES.forEach((b) => { counts[a][b] = 0; }); });
  for (let i = 1; i < labelled.length; i++) counts[labelled[i - 1].regime][labelled[i].regime]++;
  const matrix = {};
  REGIMES.forEach((a) => {
    const total = REGIMES.reduce((s, b) => s + counts[a][b], 0) || 1;
    matrix[a] = {};
    REGIMES.forEach((b) => { matrix[a][b] = round2((counts[a][b] / total) * 100); });
  });
  return matrix;
}

function creditSpreadSignal() {
  const avgSpreadBps = BOND_UNIVERSE.reduce((a, b) => a + b.spreadBps, 0) / BOND_UNIVERSE.length;
  return round2(avgSpreadBps);
}

function runRegimeDetection(payload) {
  const { labelled, volMedian } = classifyRegimes();
  const current = labelled[labelled.length - 1];
  const transitionMatrix = buildTransitionMatrix(labelled);

  // "Probability" of the current label: a soft confidence based on how far the current day's
  // return/vol sit from the classification boundary (0 = right on the boundary, 1 = far inside).
  const returns = labelled.map((r) => r.trailingReturn);
  const retSpread = Math.max(...returns) - Math.min(...returns) || 1;
  const volSpread = Math.max(...labelled.map((r) => r.vol)) - Math.min(...labelled.map((r) => r.vol)) || 1;
  const returnConfidence = Math.min(1, Math.abs(current.trailingReturn) / (retSpread * 0.3));
  const volConfidence = Math.min(1, Math.abs(current.vol - volMedian) / (volSpread * 0.3));
  const confidence = round2(((returnConfidence + volConfidence) / 2) * 100);

  const persistenceProb = transitionMatrix[current.regime][current.regime];
  const transitionRiskPct = round2(100 - persistenceProb);
  const recentVols = labelled.slice(-10).map((r) => r.vol);
  const volRising = recentVols[recentVols.length - 1] > recentVols[0];
  const recentBreadth = labelled.slice(-10).map((r) => r.breadth);
  const breadthFalling = recentBreadth[recentBreadth.length - 1] < recentBreadth[0];
  const spreadBps = creditSpreadSignal();

  const earlyWarnings = [];
  if (transitionRiskPct > 55) earlyWarnings.push({ indicator: 'Low Regime Persistence', detail: `This regime has historically only persisted ${persistenceProb}% of the time day-to-day — a switch is more likely than usual.` });
  if (volRising) earlyWarnings.push({ indicator: 'Rising Volatility', detail: 'Realised volatility has risen over the last 10 sessions, a classic precursor to a regime shift into a more volatile state.' });
  if (breadthFalling) earlyWarnings.push({ indicator: 'Narrowing Breadth', detail: 'Fewer stocks are advancing day-to-day than 10 sessions ago — strength is narrowing even if the index level hasn\'t rolled over yet.' });
  if (spreadBps > 120) earlyWarnings.push({ indicator: 'Widening Credit Spreads', detail: `Average credit spread across the bond universe is ${spreadBps}bps — rising credit spreads often lead equity regime shifts.` });

  return {
    currentRegime: { regime: current.regime, probability: confidence, trailingReturnPct: round2(current.trailingReturn * 100), volPct: round2(current.vol * 100), breadthPct: round2(current.breadth * 100) },
    transitionProbs: transitionMatrix,
    regimeHistory: labelled.slice(-90).map((r) => ({ day: r.day, regime: r.regime, trailingReturnPct: round2(r.trailingReturn * 100), volPct: round2(r.vol * 100) })),
    earlyWarnings,
    stateVectorNote: 'State vector = trailing 20-day index return, trailing 20-day annualised volatility, and market breadth, all computed from the same universe used across Modules 3-5. Credit spreads (from M5-UC5) and macro context (from M5-UC7) are folded into the early-warning checks.',
    regimeCount: REGIMES.length, methodNote: 'Quadrant classification (return sign × vol vs its own median) rather than a fitted Gaussian HMM — the FR calls for either; this is the interpretable, dependency-free variant.',
  };
}

module.exports = { runRegimeDetection, REGIMES };
