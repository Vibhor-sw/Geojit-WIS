// Module 6 shared risk core: portfolio positions, return matrix, covariance and portfolio-return
// series reused across VaR (UC1), factor decomposition (UC2) and stress testing (UC3), per the
// spec's "single covariance/factor-model core" build note. Built on the real 21-stock equity book
// (Module 4's REAL_HOLDINGS filtered to type STOCK) and the same synthetic 260-day price history
// used across Modules 3/4/5, so risk numbers are computed from genuine historical returns, not
// fabricated volatility inputs.
const { STOCK_UNIVERSE, INDEX_WEIGHTS, round2 } = require('../data/stockUniverse');
const { REAL_HOLDINGS } = require('../data/realPortfolioData');
const { sampleCovariance, shrinkCovariance, mean, std } = require('./mathUtils');

function findStock(id) {
  const s = STOCK_UNIVERSE.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown stock id: ${id}`);
  return s;
}

// The equity sleeve of the real portfolio: 21 real stock holdings, each matched to its full
// 260-day OHLCV history in STOCK_UNIVERSE.
function equityPositions() {
  const stocks = REAL_HOLDINGS.filter((h) => h.type === 'STOCK');
  const marketValues = stocks.map((h) => h.qty * h.currentPrice);
  const totalMv = marketValues.reduce((a, b) => a + b, 0);
  return stocks.map((h, i) => {
    const stock = findStock(h.id);
    return {
      id: h.id, name: h.name, sector: h.sector, macap: h.macap,
      qty: h.qty, currentPrice: h.currentPrice, marketValue: round2(marketValues[i]),
      weight: marketValues[i] / totalMv, closes: stock.ohlcv.map((b) => b.close),
      dates: stock.ohlcv.map((b) => b.date),
    };
  });
}

function dailyReturnsFromCloses(closes) {
  const r = [];
  for (let i = 1; i < closes.length; i++) r.push(closes[i] / closes[i - 1] - 1);
  return r;
}

// Return matrix: rows = trading days, columns = positions (aligned; all stocks share the same
// 260-day date grid in this synthetic dataset).
function buildReturnMatrix(positions) {
  const seriesByPos = positions.map((p) => dailyReturnsFromCloses(p.closes));
  const nDays = seriesByPos[0].length;
  const rows = [];
  for (let t = 0; t < nDays; t++) rows.push(seriesByPos.map((s) => s[t]));
  return { rows, dates: positions[0].dates.slice(1) };
}

function portfolioReturnSeries(returnRows, weights) {
  return returnRows.map((row) => row.reduce((s, r, i) => s + r * weights[i], 0));
}

// Equal-weighted-by-index-weight benchmark return series over the same universe/date grid, as a
// stand-in for "the market" (used by UC2's active-risk/tracking-error decomposition).
function benchmarkReturnSeries() {
  const positions = STOCK_UNIVERSE.map((s) => ({ id: s.id, closes: s.ohlcv.map((b) => b.close), dates: s.ohlcv.map((b) => b.date) }));
  const { rows } = buildReturnMatrix(positions);
  const weights = positions.map((p) => INDEX_WEIGHTS[p.id] || 1 / positions.length);
  const wSum = weights.reduce((a, b) => a + b, 0);
  const wNorm = weights.map((w) => w / wSum);
  return portfolioReturnSeries(rows, wNorm);
}

function riskCoreForPortfolio(shrinkage) {
  const positions = equityPositions();
  const { rows, dates } = buildReturnMatrix(positions);
  const weights = positions.map((p) => p.weight);
  const rawSigma = sampleCovariance(rows);
  const sigma = shrinkage > 0 ? shrinkCovariance(rawSigma, shrinkage) : rawSigma;
  const portReturns = portfolioReturnSeries(rows, weights);
  return { positions, rows, dates, weights, sigma, portReturns };
}

module.exports = { equityPositions, dailyReturnsFromCloses, buildReturnMatrix, portfolioReturnSeries, benchmarkReturnSeries, riskCoreForPortfolio, mean, std };
