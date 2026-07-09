// M3-UC7 — Personalised Recommendation Layer. Re-ranks/contextualises Module 3 analytics against
// the client's actual portfolio (Module 4's REAL_HOLDINGS — same 21 stocks so the two modules stay
// consistent): holding-aware analysis, SwitchER replacements, surfaced portfolio alerts, model-
// portfolio gap analysis, and a compatibility-ranked screener. Module 2 doesn't exist in this
// prototype, so its alerts are illustrative and labelled as such (FR-PR-03 constraint: never
// re-generate or contradict Module 2 — this prototype cannot honour that without Module 2 existing).
const { STOCK_UNIVERSE, round2 } = require('../data/stockUniverse');
const { runConvictionSynthesis } = require('./m3Act5Conviction');
const { REAL_HOLDINGS } = require('../data/realPortfolioData');

function correlationMatrix(ids) {
  const rets = {};
  ids.forEach((id) => {
    const s = STOCK_UNIVERSE.find((x) => x.id === id);
    if (!s) return;
    rets[id] = s.ohlcv.slice(-120).map((b, i, arr) => (i === 0 ? 0 : (b.close - arr[i - 1].close) / arr[i - 1].close)).slice(1);
  });
  return rets;
}
function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  const meanA = a.reduce((s, v) => s + v, 0) / n, meanB = b.reduce((s, v) => s + v, 0) / n;
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) { cov += (a[i] - meanA) * (b[i] - meanB); varA += (a[i] - meanA) ** 2; varB += (b[i] - meanB) ** 2; }
  return cov / Math.sqrt(varA * varB || 1);
}

function holdingContext(stockId) {
  const holding = REAL_HOLDINGS.find((h) => h.id === stockId && h.type === 'STOCK');
  const stock = STOCK_UNIVERSE.find((s) => s.id === stockId);
  if (!holding || !stock) return { held: false };
  const marketValue = holding.qty * stock.currentPrice;
  const pnlPct = round2(((stock.currentPrice - holding.costBasis) / holding.costBasis) * 100);
  const totalPortfolioValue = REAL_HOLDINGS.reduce((a, h) => a + h.qty * (STOCK_UNIVERSE.find((s) => s.id === h.id) ? STOCK_UNIVERSE.find((s) => s.id === h.id).currentPrice : h.currentPrice), 0);
  const weight = round2((marketValue / totalPortfolioValue) * 100);
  const conviction = runConvictionSynthesis({ stockId });
  const healthImpactSell = round2(-weight * 0.3 + (conviction.convictionScore < 45 ? 2 : -2));
  const healthImpactBuyMore = round2(weight * -0.2 + (conviction.convictionScore > 65 ? 2 : -2));
  return { held: true, weight, qty: holding.qty, costBasis: holding.costBasis, currentPrice: stock.currentPrice, marketValue: round2(marketValue), pnlPct, conviction: conviction.convictionScore, rating: conviction.rating, healthImpactSell, healthImpactBuyMore };
}

function runSwitchER(stockId) {
  const holding = REAL_HOLDINGS.find((h) => h.id === stockId && h.type === 'STOCK');
  const stock = STOCK_UNIVERSE.find((s) => s.id === stockId);
  if (!holding || !stock) return { eligible: false, reason: 'Not a held stock' };
  const conviction = runConvictionSynthesis({ stockId });
  if (conviction.rating !== 'Sell' && conviction.rating !== 'Strong Sell' && conviction.rating !== 'Hold') {
    return { eligible: false, reason: `Rating is ${conviction.rating} — SwitchER only triggers for Hold-Weak/Sell holdings` };
  }
  const candidates = STOCK_UNIVERSE.filter((s) => s.sector === stock.sector && s.id !== stock.id && s.macap === stock.macap);
  const heldIds = REAL_HOLDINGS.filter((h) => h.type === 'STOCK').map((h) => h.id);
  const rets = correlationMatrix([stockId, ...candidates.map((c) => c.id)]);
  const suggestions = candidates.map((c) => {
    const candConviction = runConvictionSynthesis({ stockId: c.id });
    const corr = rets[c.id] && rets[stockId] ? round2(correlation(rets[stockId], rets[c.id])) : 0;
    const convictionDelta = round2(candConviction.convictionScore - conviction.convictionScore);
    const replacementScore = round2(0.6 * convictionDelta - 0.3 * corr * 10 - 0.1 * 0);
    return { id: c.id, name: c.name, sector: c.sector, macap: c.macap, convictionScore: candConviction.convictionScore, rating: candConviction.rating, correlationToHeld: corr, convictionDelta, replacementScore, alreadyHeld: heldIds.includes(c.id) };
  }).filter((c) => !c.alreadyHeld && c.convictionDelta > 0).sort((a, b) => b.replacementScore - a.replacementScore).slice(0, 3);
  return { eligible: true, from: { id: stock.id, name: stock.name, rating: conviction.rating, convictionScore: conviction.convictionScore }, suggestions };
}

// Module 2 doesn't exist in this prototype — these are illustrative placeholders labelled as such,
// standing in for the portfolio-analytics alerts (drift/underperformance/concentration/drawdown)
// FR-PR-03 expects to be surfaced (not re-generated) from Module 2.
function surfaceModule2Alerts() {
  const totalValue = REAL_HOLDINGS.reduce((a, h) => a + h.qty * (STOCK_UNIVERSE.find((s) => s.id === h.id) ? STOCK_UNIVERSE.find((s) => s.id === h.id).currentPrice : h.currentPrice), 0);
  const bySector = {};
  REAL_HOLDINGS.filter((h) => h.type === 'STOCK').forEach((h) => {
    const s = STOCK_UNIVERSE.find((x) => x.id === h.id);
    const mv = h.qty * (s ? s.currentPrice : h.currentPrice);
    bySector[h.sector] = (bySector[h.sector] || 0) + mv;
  });
  const alerts = [];
  Object.keys(bySector).forEach((sector) => {
    const pct = (bySector[sector] / totalValue) * 100;
    if (pct > 15) alerts.push({ type: 'Concentration', severity: pct > 25 ? 'High' : 'Medium', message: `${sector} is ${round2(pct)}% of portfolio value`, actionLink: 'rebalance' });
  });
  REAL_HOLDINGS.filter((h) => h.type === 'STOCK').forEach((h) => {
    const s = STOCK_UNIVERSE.find((x) => x.id === h.id);
    if (!s) return;
    const pnlPct = ((s.currentPrice - h.costBasis) / h.costBasis) * 100;
    if (pnlPct < -15) alerts.push({ type: 'Underperformance', severity: pnlPct < -25 ? 'High' : 'Medium', message: `${h.name} is down ${round2(Math.abs(pnlPct))}% from cost`, actionLink: 'analyse', stockId: h.id });
  });
  return { source: 'Illustrative placeholder (Module 2 not built in this prototype)', alerts };
}

const MODEL_TEMPLATES = {
  Conservative: { Large: 0.6, Mid: 0.3, Small: 0.1 },
  Balanced: { Large: 0.45, Mid: 0.35, Small: 0.2 },
  Aggressive: { Large: 0.3, Mid: 0.35, Small: 0.35 },
};
function templateGapAnalysis(templateName) {
  const template = MODEL_TEMPLATES[templateName] || MODEL_TEMPLATES.Balanced;
  const totalValue = REAL_HOLDINGS.reduce((a, h) => a + h.qty * (STOCK_UNIVERSE.find((s) => s.id === h.id) ? STOCK_UNIVERSE.find((s) => s.id === h.id).currentPrice : h.currentPrice), 0);
  const byCap = { Large: 0, Mid: 0, Small: 0 };
  REAL_HOLDINGS.forEach((h) => {
    const s = STOCK_UNIVERSE.find((x) => x.id === h.id);
    const cap = s ? s.macap : h.macap;
    const mv = h.qty * (s ? s.currentPrice : h.currentPrice);
    if (byCap[cap] != null) byCap[cap] += mv;
  });
  const current = {}; Object.keys(byCap).forEach((k) => { current[k] = round2((byCap[k] / totalValue) * 100); });
  const gaps = Object.keys(template).map((k) => ({ bucket: k, current: current[k] || 0, target: round2(template[k] * 100), gap: round2((current[k] || 0) - template[k] * 100) }));
  return { templateName, current, target: template, gaps };
}

function personalisedScreen() {
  const heldSectors = new Set(REAL_HOLDINGS.filter((h) => h.type === 'STOCK').map((h) => h.sector));
  const heldIds = new Set(REAL_HOLDINGS.filter((h) => h.type === 'STOCK').map((h) => h.id));
  return STOCK_UNIVERSE.filter((s) => !heldIds.has(s.id)).map((s) => {
    const conviction = runConvictionSynthesis({ stockId: s.id });
    const diversificationBenefit = heldSectors.has(s.sector) ? 0.3 : 1;
    const compatibility = round2(conviction.convictionScore * 0.6 + diversificationBenefit * 40);
    return { id: s.id, name: s.name, sector: s.sector, macap: s.macap, convictionScore: conviction.convictionScore, rating: conviction.rating, diversificationBenefit, compatibility };
  }).sort((a, b) => b.compatibility - a.compatibility).slice(0, 10);
}

function runPersonalization(payload) {
  const p = payload || {};
  const stockId = p.stockId || 'INFY';
  return {
    holdingContext: holdingContext(stockId),
    switchSuggestions: runSwitchER(stockId),
    surfacedAlerts: surfaceModule2Alerts(),
    templateGap: templateGapAnalysis(p.templateName),
    personalisedScreen: personalisedScreen(),
  };
}

module.exports = { runPersonalization, MODEL_TEMPLATES };
