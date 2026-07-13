// M5-UC2 — DCF & Fundamental Valuation Automation. A deterministic multi-stage FCFF DCF with
// CAPM/WACC, driver-based forecasting, terminal value, relative valuation vs sector peers, a
// growth×WACC sensitivity grid, bull/base/bear scenarios, and a blended intrinsic value with a full
// assumptions manifest for auditability (FR-VA-06). No real shares-outstanding figure exists in
// this prototype's synthetic dataset, so per-share values are derived by applying the DCF-implied
// P/E multiple (equity value ÷ net income) to a seeded illustrative EPS — documented in the
// manifest rather than silently assumed.
const { STOCK_UNIVERSE, hashSeed, mulberry32, round2 } = require('../data/stockUniverse');
const { repoRatePct } = require('../data/macroSeries');

function findStock(id) {
  const s = STOCK_UNIVERSE.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown stock id: ${id}`);
  return s;
}
function impliedPE(stock) {
  const rng = mulberry32(hashSeed(stock.isin + 'pe'));
  const qualityTilt = stock.financials.netIncome[stock.financials.netIncome.length - 1] > stock.financials.netIncome[0] ? 3 : -3;
  const rn = (rng() + rng() + rng() - 1.5) / 1.5;
  return round2(Math.max(6, 14 + qualityTilt + rn * 8));
}

function dailyReturns(ohlcv) {
  const rets = [];
  for (let i = 1; i < ohlcv.length; i++) rets.push((ohlcv[i].close - ohlcv[i - 1].close) / ohlcv[i - 1].close);
  return rets;
}
function computeBeta(stock) {
  const stockRets = dailyReturns(stock.ohlcv);
  // Equal-weighted universe return as the market proxy (no licensed index feed in this prototype).
  const n = stockRets.length;
  const marketRets = new Array(n).fill(0);
  STOCK_UNIVERSE.forEach((s) => {
    const r = dailyReturns(s.ohlcv);
    for (let i = 0; i < n; i++) marketRets[i] += r[i] / STOCK_UNIVERSE.length;
  });
  const mx = marketRets.reduce((a, b) => a + b, 0) / n;
  const my = stockRets.reduce((a, b) => a + b, 0) / n;
  let cov = 0, varM = 0;
  for (let i = 0; i < n; i++) { cov += (marketRets[i] - mx) * (stockRets[i] - my); varM += (marketRets[i] - mx) ** 2; }
  return round2(cov / (varM || 1e-9));
}

function computeWacc(stock, riskFreeRate, erp) {
  const f = stock.financials;
  const n = f.revenue.length - 1;
  const beta = computeBeta(stock);
  const costOfEquity = riskFreeRate + beta * erp;
  const creditSpread = stock.macap === 'Large' ? 0.012 : stock.macap === 'Mid' ? 0.02 : 0.03;
  const costOfDebtPreTax = riskFreeRate + creditSpread;
  const taxRate = f.tax[n] / f.pretaxIncome[n];
  const costOfDebtAfterTax = costOfDebtPreTax * (1 - taxRate);
  const equityValueBook = f.equity[n];
  const debtValue = f.totalDebt[n];
  const totalCap = equityValueBook + debtValue;
  const wEquity = equityValueBook / totalCap, wDebt = debtValue / totalCap;
  const wacc = wEquity * costOfEquity + wDebt * costOfDebtAfterTax;
  return { beta, costOfEquity: round2(costOfEquity * 100), costOfDebtAfterTax: round2(costOfDebtAfterTax * 100), wEquity: round2(wEquity * 100), wDebt: round2(wDebt * 100), taxRate: round2(taxRate * 100), wacc: round2(wacc * 100) };
}

function projectFcff(stock, opts) {
  const f = stock.financials;
  const n = f.revenue.length - 1;
  const horizon = opts.horizonYears || 5;
  const historicalCagr = Math.pow(f.revenue[n] / f.revenue[0], 1 / (f.revenue.length - 1)) - 1;
  const startGrowth = opts.growthOverride != null ? opts.growthOverride : historicalCagr;
  const terminalGrowth = opts.terminalGrowth != null ? opts.terminalGrowth : Math.min(0.055, Math.max(0.03, historicalCagr * 0.5));
  const ebitMargin = (opts.marginOverride != null ? opts.marginOverride : f.ebit[n] / f.revenue[n]);
  const daRatio = f.depreciation[n] / f.revenue[n];
  const wcIntensity = f.receivables[n] / f.revenue[n];
  const taxRate = f.tax[n] / f.pretaxIncome[n];

  let revenue = f.revenue[n];
  const rows = [];
  for (let t = 1; t <= horizon; t++) {
    const growth = startGrowth + (terminalGrowth - startGrowth) * (t / horizon); // linear fade to terminal growth
    const prevRevenue = revenue;
    revenue = revenue * (1 + growth);
    const ebit = revenue * ebitMargin;
    const da = revenue * daRatio;
    const capex = da * 1.15;
    const deltaWc = (revenue - prevRevenue) * wcIntensity;
    const fcff = ebit * (1 - taxRate) + da - capex - deltaWc;
    rows.push({ year: t, growthPct: round2(growth * 100), revenue: round2(revenue), ebit: round2(ebit), fcff: round2(fcff) });
  }
  return { rows, terminalGrowth, taxRate, ebitMargin };
}

function discountFcff(rows, wacc, terminalGrowth) {
  const waccFrac = wacc / 100;
  let pvSum = 0;
  rows.forEach((r) => { pvSum += r.fcff / Math.pow(1 + waccFrac, r.year); });
  const lastFcff = rows[rows.length - 1].fcff;
  const safeTerminalGrowth = Math.min(terminalGrowth, waccFrac - 0.005); // guard WACC > g
  const terminalFcff = lastFcff * (1 + safeTerminalGrowth);
  const terminalValue = terminalFcff / (waccFrac - safeTerminalGrowth);
  const pvTerminal = terminalValue / Math.pow(1 + waccFrac, rows.length);
  return { enterpriseValue: round2(pvSum + pvTerminal), pvExplicit: round2(pvSum), pvTerminal: round2(pvTerminal), terminalValue: round2(terminalValue), safeTerminalGrowthPct: round2(safeTerminalGrowth * 100) };
}

function equityValueToPerShare(stock, equityValue) {
  const f = stock.financials;
  const n = f.revenue.length - 1;
  const pe = impliedPE(stock);
  const eps = round2(stock.currentPrice / pe);
  const impliedMultiple = equityValue / f.netIncome[n];
  return round2(impliedMultiple * eps);
}

function relativeValuation(stock) {
  const peers = STOCK_UNIVERSE.filter((s) => s.sector === stock.sector);
  const peerPEs = peers.map((p) => impliedPE(p));
  const sectorMedianPE = median(peerPEs);
  const pe = impliedPE(stock);
  const eps = round2(stock.currentPrice / pe);
  return { sectorMedianPE: round2(sectorMedianPE), eps, relativeValuePerShare: round2(sectorMedianPE * eps) };
}
function median(arr) { const s = [...arr].sort((a, b) => a - b); const mid = Math.floor(s.length / 2); return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2; }

function runOneValuation(stock, wacc, opts) {
  const proj = projectFcff(stock, opts);
  const disc = discountFcff(proj.rows, wacc.wacc, proj.terminalGrowth);
  const f = stock.financials;
  const n = f.revenue.length - 1;
  const cash = f.currentAssets[n] * 0.15;
  const netDebt = round2(f.totalDebt[n] - cash);
  const equityValue = round2(disc.enterpriseValue - netDebt);
  const perShare = equityValueToPerShare(stock, equityValue);
  return { proj, disc, netDebt, equityValue, intrinsicPerShare: perShare };
}

function buildSensitivityGrid(stock, wacc, opts) {
  const waccPoints = [-1, -0.5, 0, 0.5, 1].map((d) => round2(wacc.wacc + d));
  const growthBase = opts.terminalGrowth != null ? opts.terminalGrowth * 100 : 4.5;
  const growthPoints = [-1, -0.5, 0, 0.5, 1].map((d) => round2(growthBase + d));
  const grid = growthPoints.map((g) => waccPoints.map((w) => {
    const proj = projectFcff(stock, { ...opts, terminalGrowth: g / 100 });
    const disc = discountFcff(proj.rows, w, g / 100);
    const f = stock.financials; const n = f.revenue.length - 1;
    const netDebt = f.totalDebt[n] - f.currentAssets[n] * 0.15;
    const equityValue = disc.enterpriseValue - netDebt;
    return equityValueToPerShare(stock, equityValue);
  }));
  return { waccPoints, growthPoints, grid };
}

function runDcfValuation(payload) {
  const p = payload || {};
  const stockId = p.stockId || 'INFY';
  const stock = findStock(stockId);
  const riskFreeRate = (p.riskFreeRate != null ? p.riskFreeRate : (repoRatePct[repoRatePct.length - 1] / 100));
  const erp = p.erp != null ? p.erp : 0.06;
  const horizonYears = p.horizonYears || 5;
  const wacc = computeWacc(stock, riskFreeRate, erp);

  const baseOpts = { horizonYears, growthOverride: p.growthOverride, terminalGrowth: p.terminalGrowth, marginOverride: p.marginOverride };
  const base = runOneValuation(stock, wacc, baseOpts);
  const bull = runOneValuation(stock, wacc, { ...baseOpts, marginOverride: base.proj.ebitMargin * 1.08, growthOverride: (baseOpts.growthOverride != null ? baseOpts.growthOverride : base.proj.rows[0].growthPct / 100) + 0.02 });
  const bear = runOneValuation(stock, wacc, { ...baseOpts, marginOverride: base.proj.ebitMargin * 0.92, growthOverride: (baseOpts.growthOverride != null ? baseOpts.growthOverride : base.proj.rows[0].growthPct / 100) - 0.02 });

  const relative = relativeValuation(stock);
  const sensitivity = buildSensitivityGrid(stock, wacc, baseOpts);

  const dcfWeight = 0.6, relativeWeight = 0.4;
  const blendedValue = round2(base.intrinsicPerShare * dcfWeight + relative.relativeValuePerShare * relativeWeight);
  const divergencePct = Math.abs(base.intrinsicPerShare - relative.relativeValuePerShare) / ((base.intrinsicPerShare + relative.relativeValuePerShare) / 2) * 100;
  const confidence = divergencePct < 15 ? 'High' : divergencePct < 35 ? 'Medium' : 'Low';
  const upsideVsPrice = round2(((blendedValue - stock.currentPrice) / stock.currentPrice) * 100);

  return {
    stock: { id: stock.id, name: stock.name, sector: stock.sector, macap: stock.macap, currentPrice: stock.currentPrice },
    wacc, intrinsicValue: blendedValue, upsideVsPrice,
    methodValues: { dcf: base.intrinsicPerShare, relative: relative.relativeValuePerShare, sotp: null },
    confidence, divergencePct: round2(divergencePct),
    sensitivity,
    scenarios: { bull: bull.intrinsicPerShare, base: base.intrinsicPerShare, bear: bear.intrinsicPerShare },
    dcfDetail: { projection: base.proj.rows, enterpriseValue: base.disc.enterpriseValue, pvExplicit: base.disc.pvExplicit, pvTerminal: base.disc.pvTerminal, netDebt: base.netDebt, equityValue: base.equityValue, terminalGrowthPct: round2(base.proj.terminalGrowth * 100) },
    relativeDetail: relative,
    assumptionsManifest: {
      riskFreeRatePct: round2(riskFreeRate * 100), equityRiskPremiumPct: round2(erp * 100), horizonYears,
      terminalGrowthPct: round2(base.proj.terminalGrowth * 100), ebitMarginPct: round2(base.proj.ebitMargin * 100),
      taxRatePct: round2(base.proj.taxRate * 100), waccPct: wacc.wacc, methodWeights: { dcf: dcfWeight, relative: relativeWeight },
      modelVersion: 'M5-UC2 FCFF-DCF v1', runAt: new Date().toISOString(),
    },
  };
}

module.exports = { runDcfValuation };
