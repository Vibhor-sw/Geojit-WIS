// Browser bundle of all Module 4 model logic + sample data.
// This is a direct, dependency-free port of the Node/Express version's
// src/data/sampleData.js, src/models/*.js and src/routes/*.js sample payloads
// into a single in-browser namespace (window.WISModels), so the whole app
// runs as static files with no backend -- deployable on Netlify Drop, etc.
(function (global) {
  'use strict';

  // ============================== mathUtils ==============================
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seed) { return mulberry32(seed == null ? Date.now() % 2147483647 : seed); }
  function randn(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
  function percentile(sortedArr, p) {
    const idx = (sortedArr.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sortedArr[lo];
    return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo);
  }
  function matVec(A, v) { return A.map((row) => row.reduce((s, a, j) => s + a * v[j], 0)); }
  function transpose(A) { return A[0].map((_, j) => A.map((row) => row[j])); }
  function addMat(A, B) { return A.map((row, i) => row.map((v, j) => v + B[i][j])); }
  function scaleMat(A, s) { return A.map((row) => row.map((v) => v * s)); }
  function matMul(A, B) {
    const n = A.length, m = B[0].length, k = B.length;
    const C = Array.from({ length: n }, () => new Array(m).fill(0));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++) {
        let s = 0;
        for (let p = 0; p < k; p++) s += A[i][p] * B[p][j];
        C[i][j] = s;
      }
    return C;
  }
  function invert(Ain) {
    const n = Ain.length;
    const A = Ain.map((row) => row.slice());
    const I = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
      if (Math.abs(A[pivot][col]) < 1e-10) A[pivot][col] += 1e-8;
      [A[col], A[pivot]] = [A[pivot], A[col]];
      [I[col], I[pivot]] = [I[pivot], I[col]];
      const pv = A[col][col];
      for (let j = 0; j < n; j++) { A[col][j] /= pv; I[col][j] /= pv; }
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = A[r][col];
        for (let j = 0; j < n; j++) { A[r][j] -= factor * A[col][j]; I[r][j] -= factor * I[col][j]; }
      }
    }
    return I;
  }
  function shrinkCovariance(Sigma, delta) {
    const n = Sigma.length;
    const avgVar = mean(Sigma.map((row, i) => row[i]));
    const F = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? avgVar : 0)));
    return addMat(scaleMat(F, delta), scaleMat(Sigma, 1 - delta));
  }
  function projectToSimplexBox(w, lb, ub) {
    let x = w.slice();
    for (let iter = 0; iter < 200; iter++) {
      x = x.map((v, i) => Math.min(ub[i], Math.max(lb[i], v)));
      const sum = x.reduce((a, b) => a + b, 0);
      const diff = (1 - sum) / x.length;
      x = x.map((v) => v + diff);
      const clipped = x.map((v, i) => Math.min(ub[i], Math.max(lb[i], v)));
      const err = Math.max(...clipped.map((v, i) => Math.abs(v - x[i])));
      x = clipped;
      if (err < 1e-9) break;
    }
    const sum = x.reduce((a, b) => a + b, 0) || 1;
    return x.map((v) => v / sum);
  }

  // ============================== sample data ==============================
  const ASSET_CLASSES = ['Equity', 'Debt', 'Gold', 'Cash', 'International'];
  const CAPITAL_MARKET_ASSUMPTIONS = {
    version: 'CMA-2026Q3-v1', effectiveDate: '2026-07-01', assetClasses: ASSET_CLASSES,
    expectedReturn: { Equity: 0.12, Debt: 0.07, Gold: 0.08, Cash: 0.045, International: 0.10 },
    volatility: { Equity: 0.19, Debt: 0.05, Gold: 0.15, Cash: 0.01, International: 0.17 },
    correlation: [
      [1.00, -0.10, 0.05, 0.00, 0.65],
      [-0.10, 1.00, 0.10, 0.20, -0.05],
      [0.05, 0.10, 1.00, 0.05, 0.20],
      [0.00, 0.20, 0.05, 1.00, 0.00],
      [0.65, -0.05, 0.20, 0.00, 1.00],
    ],
  };
  const GLIDE_PATH_MATRIX = {
    short: { Equity: 0.15, Debt: 0.45, Gold: 0.10, Cash: 0.30, International: 0.00 },
    medium: { Equity: 0.45, Debt: 0.35, Gold: 0.10, Cash: 0.05, International: 0.05 },
    long: { Equity: 0.60, Debt: 0.20, Gold: 0.08, Cash: 0.02, International: 0.10 },
  };
  const RISK_GUARDRAILS = {
    1: { Equity: [0, 0.25], Debt: [0.40, 0.80], Gold: [0, 0.15], Cash: [0.05, 0.40], International: [0, 0.05] },
    2: { Equity: [0.10, 0.40], Debt: [0.30, 0.65], Gold: [0, 0.15], Cash: [0.02, 0.25], International: [0, 0.10] },
    3: { Equity: [0.25, 0.55], Debt: [0.20, 0.55], Gold: [0, 0.15], Cash: [0.02, 0.15], International: [0, 0.15] },
    4: { Equity: [0.40, 0.70], Debt: [0.10, 0.40], Gold: [0, 0.12], Cash: [0, 0.10], International: [0, 0.20] },
    5: { Equity: [0.55, 0.85], Debt: [0, 0.25], Gold: [0, 0.10], Cash: [0, 0.08], International: [0, 0.25] },
  };
  const UNIVERSE = [
    { id: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', assetClass: 'Equity', expReturn: 0.14, vol: 0.24, esg: 62, carbon: 78, factors: { value: -0.2, quality: 0.8, momentum: 0.4, size: 1.2, lowvol: -0.3 } },
    { id: 'TCS', name: 'Tata Consultancy Services', sector: 'IT', assetClass: 'Equity', expReturn: 0.13, vol: 0.20, esg: 78, carbon: 12, factors: { value: -0.5, quality: 1.4, momentum: 0.2, size: 1.1, lowvol: 0.6 } },
    { id: 'HDFCBANK', name: 'HDFC Bank', sector: 'Financials', assetClass: 'Equity', expReturn: 0.135, vol: 0.22, esg: 70, carbon: 8, factors: { value: 0.3, quality: 1.0, momentum: -0.1, size: 1.0, lowvol: 0.2 } },
    { id: 'INFY', name: 'Infosys', sector: 'IT', assetClass: 'Equity', expReturn: 0.125, vol: 0.21, esg: 80, carbon: 10, factors: { value: -0.3, quality: 1.2, momentum: 0.3, size: 0.9, lowvol: 0.5 } },
    { id: 'ICICIBANK', name: 'ICICI Bank', sector: 'Financials', assetClass: 'Equity', expReturn: 0.14, vol: 0.23, esg: 65, carbon: 9, factors: { value: 0.4, quality: 0.9, momentum: 0.5, size: 0.8, lowvol: 0.0 } },
    { id: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'FMCG', assetClass: 'Equity', expReturn: 0.10, vol: 0.16, esg: 82, carbon: 20, factors: { value: -0.8, quality: 1.5, momentum: -0.2, size: 0.7, lowvol: 1.0 } },
    { id: 'ITC', name: 'ITC Ltd', sector: 'FMCG', assetClass: 'Equity', expReturn: 0.115, vol: 0.18, esg: 55, carbon: 35, factors: { value: 0.9, quality: 0.7, momentum: 0.1, size: 0.6, lowvol: 0.7 } },
    { id: 'LT', name: 'Larsen & Toubro', sector: 'Industrials', assetClass: 'Equity', expReturn: 0.135, vol: 0.24, esg: 60, carbon: 55, factors: { value: 0.2, quality: 0.6, momentum: 0.4, size: 0.9, lowvol: -0.4 } },
    { id: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom', assetClass: 'Equity', expReturn: 0.13, vol: 0.22, esg: 58, carbon: 40, factors: { value: 0.0, quality: 0.5, momentum: 0.6, size: 0.8, lowvol: -0.2 } },
    { id: 'SUNPHARMA', name: 'Sun Pharma', sector: 'Healthcare', assetClass: 'Equity', expReturn: 0.12, vol: 0.20, esg: 68, carbon: 25, factors: { value: -0.1, quality: 0.9, momentum: 0.0, size: 0.5, lowvol: 0.3 } },
    { id: 'NIFTYBEES', name: 'Nifty 50 ETF', sector: 'Diversified', assetClass: 'Equity', expReturn: 0.12, vol: 0.17, esg: 68, carbon: 30, factors: { value: 0.0, quality: 0.8, momentum: 0.1, size: 1.0, lowvol: 0.2 } },
    { id: 'GOLDBEES', name: 'Gold ETF', sector: 'Commodity', assetClass: 'Gold', expReturn: 0.08, vol: 0.15, esg: 50, carbon: 5, factors: { value: 0, quality: 0, momentum: 0, size: 0, lowvol: 1.5 } },
    { id: 'LIQUIDBEES', name: 'Liquid / Debt Fund', sector: 'Debt', assetClass: 'Debt', expReturn: 0.07, vol: 0.05, esg: 50, carbon: 2, factors: { value: 0, quality: 0, momentum: 0, size: 0, lowvol: 2.0 } },
  ];
  const BENCHMARK_WEIGHTS = {
    RELIANCE: 0.10, TCS: 0.08, HDFCBANK: 0.11, INFY: 0.07, ICICIBANK: 0.08,
    HINDUNILVR: 0.06, ITC: 0.05, LT: 0.06, BHARTIARTL: 0.05, SUNPHARMA: 0.04,
    NIFTYBEES: 0.20, GOLDBEES: 0.05, LIQUIDBEES: 0.05,
  };
  const SAMPLE_LOTS = [
    { id: 'L1', security: 'RELIANCE', qty: 40, costBasis: 2450, purchaseDate: '2024-02-10', currentPrice: 2870 },
    { id: 'L2', security: 'TCS', qty: 25, costBasis: 4100, purchaseDate: '2023-11-05', currentPrice: 3820 },
    { id: 'L3', security: 'HDFCBANK', qty: 60, costBasis: 1620, purchaseDate: '2025-01-20', currentPrice: 1590 },
    { id: 'L4', security: 'INFY', qty: 50, costBasis: 1550, purchaseDate: '2024-08-14', currentPrice: 1690 },
    { id: 'L5', security: 'ITC', qty: 200, costBasis: 460, purchaseDate: '2025-05-02', currentPrice: 430 },
    { id: 'L6', security: 'LT', qty: 20, costBasis: 3600, purchaseDate: '2024-12-18', currentPrice: 3420 },
    { id: 'L7', security: 'NIFTYBEES', qty: 300, costBasis: 240, purchaseDate: '2023-06-01', currentPrice: 268 },
    { id: 'L8', security: 'GOLDBEES', qty: 500, costBasis: 55, purchaseDate: '2024-04-22', currentPrice: 63 },
    { id: 'L9', security: 'LIQUIDBEES', qty: 1000, costBasis: 100, purchaseDate: '2025-03-11', currentPrice: 101.8 },
  ];
  const EXCLUSION_LIST = ['ITC'];
  const TAX_RULES = {
    equity: { shortTermMonths: 12, stcgRate: 0.20, ltcgRate: 0.125, ltcgExemption: 125000 },
    debt: { shortTermMonths: 24, stcgRate: 0.30, ltcgRate: 0.20 },
    washSaleWindowDays: 30,
  };
  const MODEL_PORTFOLIO_LIBRARY = {
    1: { name: 'Capital Preservation', weights: { Equity: 0.15, Debt: 0.55, Gold: 0.10, Cash: 0.20, International: 0.00 } },
    2: { name: 'Conservative Growth', weights: { Equity: 0.30, Debt: 0.45, Gold: 0.10, Cash: 0.10, International: 0.05 } },
    3: { name: 'Balanced Growth', weights: { Equity: 0.45, Debt: 0.32, Gold: 0.10, Cash: 0.05, International: 0.08 } },
    4: { name: 'Growth', weights: { Equity: 0.58, Debt: 0.20, Gold: 0.08, Cash: 0.02, International: 0.12 } },
    5: { name: 'Aggressive Growth', weights: { Equity: 0.72, Debt: 0.08, Gold: 0.05, Cash: 0.00, International: 0.15 } },
  };

  // ============================== Real client-supplied portfolio (stocks + MFs) ==============================
  // See src/data/realPortfolioData.js in the Node build for full provenance notes: "atp" (average
  // trade price) from the source export is treated as cost basis; current price and purchase date
  // are not in the source, so both are derived deterministically per ISIN (reproducible, not random).
  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return Math.abs(h) || 1;
  }
  const RAW_HOLDINGS = [
    { isin: 'INE009A01021', id: 'INFY', name: 'Infosys Ltd', sector: 'Information Technology', macap: 'Mid', type: 'STOCK', reco: 'Sell', atp: 1520.2, qty: 7 },
    { isin: 'INE010B01027', id: 'ZYDUSLIFE', name: 'Zydus Life Sciences Ltd', sector: 'Healthcare', macap: 'Mid', type: 'STOCK', reco: 'Hold', atp: 905, qty: 10 },
    { isin: 'INE019A01038', id: 'JSWSTEEL', name: 'JSW Steel Ltd', sector: 'Metals & Mining', macap: 'Mid', type: 'STOCK', reco: 'Sell', atp: 1239.8, qty: 8 },
    { isin: 'INE020B01018', id: 'RECLTD', name: 'Rural Electrification Corporation Ltd', sector: 'Financial Services', macap: 'Mid', type: 'STOCK', reco: 'Hold', atp: 382.1, qty: 12 },
    { isin: 'INE021A01026', id: 'ASIANPAINT', name: 'Asian Paints Ltd', sector: 'Consumer Durables', macap: 'Mid', type: 'STOCK', reco: 'Hold', atp: 2432.1, qty: 12 },
    { isin: 'INE030A01027', id: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', sector: 'Fast Moving Consumer Goods', macap: 'Mid', type: 'STOCK', reco: 'Buy', atp: 2354.4, qty: 7 },
    { isin: 'INE038A01020', id: 'HINDALCO', name: 'Hindalco Industries Ltd', sector: 'Metals & Mining', macap: 'Mid', type: 'STOCK', reco: 'Buy', atp: 935.45, qty: 15 },
    { isin: 'INE040A01034', id: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Financial Services', macap: 'Mid', type: 'STOCK', reco: 'Buy', atp: 949.7, qty: 10 },
    { isin: 'INE044A01036', id: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd', sector: 'Healthcare', macap: 'Mid', type: 'STOCK', reco: 'Buy', atp: 1702.6, qty: 8 },
    { isin: 'INE066A01021', id: 'EICHERMOT', name: 'Eicher Motors Ltd', sector: 'Automobile and Auto Components', macap: 'Mid', type: 'STOCK', reco: 'Sell', atp: 7209.5, qty: 6 },
    { isin: 'INE075A01022', id: 'WIPRO', name: 'Wipro Ltd', sector: 'Information Technology', macap: 'Mid', type: 'STOCK', reco: 'Sell', atp: 233.39, qty: 9 },
    { isin: 'INE154A01025', id: 'ITC', name: 'ITC Ltd', sector: 'Fast Moving Consumer Goods', macap: 'Mid', type: 'STOCK', reco: 'Buy', atp: 310.2, qty: 5 },
    { isin: 'INE158A01026', id: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd', sector: 'Automobile and Auto Components', macap: 'Mid', type: 'STOCK', reco: 'Buy', atp: 5766, qty: 10 },
    { isin: 'INE235A01022', id: 'FINCABLES', name: 'Finolex Cables Ltd', sector: 'Capital Goods', macap: 'Small', type: 'STOCK', reco: 'Hold', atp: 745.5, qty: 8 },
    { isin: 'INE481G01011', id: 'ULTRACEMCO', name: 'UltraTech Cement Ltd', sector: 'Construction Materials', macap: 'Mid', type: 'STOCK', reco: 'Buy', atp: 12773, qty: 3 },
    { isin: 'INE585B01010', id: 'MARUTI', name: 'Maruti Suzuki India Ltd', sector: 'Automobile and Auto Components', macap: 'Mid', type: 'STOCK', reco: 'Buy', atp: 15059, qty: 10 },
    { isin: 'INE732A01036', id: 'KIRLOSBROS', name: 'Kirloskar Brothers Ltd', sector: 'Capital Goods', macap: 'Small', type: 'STOCK', reco: 'Hold', atp: 1545.2, qty: 6 },
    { isin: 'INE742F01042', id: 'ADANIPORTS', name: 'Adani Ports & SEZ Ltd', sector: 'Services', macap: 'Mid', type: 'STOCK', reco: 'Buy', atp: 1570.2, qty: 20 },
    { isin: 'INE787D01026', id: 'BALKRISIND', name: 'Balkrishna Industries Ltd', sector: 'Automobile and Auto Components', macap: 'Small', type: 'STOCK', reco: 'Hold', atp: 2687.8, qty: 5 },
    { isin: 'INE795G01014', id: 'HDFCLIFE', name: 'HDFC Life Insurance Company Ltd', sector: 'Financial Services', macap: 'Mid', type: 'STOCK', reco: 'Buy', atp: 720.7, qty: 18 },
    { isin: 'INE917I01010', id: 'BAJAJ-AUTO', name: 'Bajaj Auto Ltd', sector: 'Automobile and Auto Components', macap: 'Mid', type: 'STOCK', reco: 'Buy', atp: 9647, qty: 6 },
    { isin: 'INF109K01AN2', id: 'ICICI_MIDCAP', name: 'ICICI Pru Midcap Fund(G)', sector: 'Mid Cap Fund', macap: 'Mid', type: 'MF', reco: 'Buy', atp: 316.97, qty: 400 },
    { isin: 'INF174K01211', id: 'KOTAK_SMALLCAP', name: 'Kotak Small Cap Fund(G)', sector: 'Small Cap Fund', macap: 'Small', type: 'MF', reco: 'Sell', atp: 240.097, qty: 200 },
    { isin: 'INF179K01BE2', id: 'HDFC_LARGECAP', name: 'HDFC Large Cap Fund(G)', sector: 'Large Cap Fund', macap: 'Large', type: 'MF', reco: 'Buy', atp: 1439.42762, qty: 500 },
    { isin: 'INF179K01CR2', id: 'HDFC_MIDCAP', name: 'HDFC Mid-Cap Opportunities Fund(G)', sector: 'Mid Cap Fund', macap: 'Mid', type: 'MF', reco: 'Buy', atp: 203.231, qty: 200 },
    { isin: 'INF204K01562', id: 'NIPPON_LARGECAP', name: 'Nippon India Large Cap Fund(G)', sector: 'Large Cap Fund', macap: 'Large', type: 'MF', reco: 'Buy', atp: 92.7289, qty: 400 },
    { isin: 'INF247L01411', id: 'MOTILAL_MIDCAP', name: 'Motilal Oswal Midcap Fund-Reg(G)', sector: 'Mid Cap Fund', macap: 'Mid', type: 'MF', reco: 'Sell', atp: 93.9058, qty: 400 },
    { isin: 'INF582M01BY1', id: 'UNION_SMALLCAP', name: 'Union Small Cap Fund-Reg(G)', sector: 'Small Cap Fund', macap: 'Small', type: 'MF', reco: 'Buy', atp: 48.15, qty: 300 },
    { isin: 'INF663L01DZ4', id: 'PGIM_MIDCAP', name: 'PGIM India Midcap Opp Fund-Reg(G)', sector: 'Mid Cap Fund', macap: 'Mid', type: 'MF', reco: 'Buy', atp: 62.76, qty: 200 },
    { isin: 'INF740K01797', id: 'DSP_SMALLCAP', name: 'DSP Small Cap Fund-Reg(G)', sector: 'Small Cap Fund', macap: 'Small', type: 'MF', reco: 'Buy', atp: 191.368, qty: 400 },
    { isin: 'INF769K01010', id: 'MIRAE_LARGECAP', name: 'Mirae Asset Large Cap Fund(G)', sector: 'Large Cap Fund', macap: 'Large', type: 'MF', reco: 'Buy', atp: 115.33, qty: 300 },
    { isin: 'INF917K01QC7', id: 'HSBC_SMALLCAP', name: 'HSBC Small Cap Fund-Reg(G)', sector: 'Small Cap Fund', macap: 'Small', type: 'MF', reco: 'Buy', atp: 75.3994, qty: 300 },
    { isin: 'INF966L01AW4', id: 'QUANT_LARGECAP', name: 'Quant Large Cap Fund-Reg(G)', sector: 'Large Cap Fund', macap: 'Large', type: 'MF', reco: 'Sell', atp: 14.9294, qty: 300 },
  ];
  const PORTFOLIO_AS_OF = new Date('2026-07-08');
  function buildHolding(raw) {
    const priceRng = mulberry32(hashSeed(raw.isin));
    const movement = -0.35 + priceRng() * 0.80;
    const currentPrice = Math.max(0.5, raw.atp * (1 + movement));
    const daysAgo = Math.round(30 + priceRng() * 1070);
    const purchaseDate = new Date(PORTFOLIO_AS_OF.getTime() - daysAgo * 86400000);
    const capProfile = raw.macap === 'Large' ? { expReturn: 0.11, vol: 0.16 } : raw.macap === 'Mid' ? { expReturn: 0.135, vol: 0.22 } : { expReturn: 0.16, vol: 0.28 };
    const factorRng = mulberry32(hashSeed(raw.isin + 'factors'));
    return {
      id: raw.id, isin: raw.isin, name: raw.name, sector: raw.sector, macap: raw.macap, type: raw.type, reco: raw.reco,
      qty: raw.qty, costBasis: raw.atp, currentPrice: Math.round(currentPrice * 100) / 100,
      purchaseDate: purchaseDate.toISOString().slice(0, 10),
      assetClass: 'Equity', expReturn: capProfile.expReturn, vol: capProfile.vol,
      factors: {
        value: Number((factorRng() * 4 - 2).toFixed(2)), quality: Number((factorRng() * 4 - 2).toFixed(2)), momentum: Number((factorRng() * 4 - 2).toFixed(2)),
        size: raw.macap === 'Large' ? 1.3 : raw.macap === 'Mid' ? 0.5 : -0.6,
        lowvol: raw.macap === 'Large' ? 0.8 : raw.macap === 'Mid' ? 0.1 : -0.7,
      },
    };
  }
  const REAL_HOLDINGS = RAW_HOLDINGS.map(buildHolding);

  // ============================== UC1: Goal-Based Asset Allocation ==============================
  function horizonBucket(years) { if (years < 3) return 'short'; if (years <= 7) return 'medium'; return 'long'; }
  function applyGuardrails(baseWeights, riskCategory) {
    const guard = RISK_GUARDRAILS[riskCategory] || RISK_GUARDRAILS[3];
    const clipped = {};
    for (const ac of ASSET_CLASSES) { const [lo, hi] = guard[ac] || [0, 1]; clipped[ac] = Math.min(hi, Math.max(lo, baseWeights[ac] || 0)); }
    const sum = Object.values(clipped).reduce((a, b) => a + b, 0) || 1;
    const out = {};
    for (const ac of ASSET_CLASSES) out[ac] = clipped[ac] / sum;
    return out;
  }
  function portfolioMuSigma(weights) {
    const cma = CAPITAL_MARKET_ASSUMPTIONS;
    const w = ASSET_CLASSES.map((ac) => weights[ac] || 0);
    const mu = ASSET_CLASSES.reduce((s, ac, i) => s + w[i] * cma.expectedReturn[ac], 0);
    let variance = 0;
    for (let i = 0; i < ASSET_CLASSES.length; i++)
      for (let j = 0; j < ASSET_CLASSES.length; j++) {
        const covIJ = cma.correlation[i][j] * cma.volatility[ASSET_CLASSES[i]] * cma.volatility[ASSET_CLASSES[j]];
        variance += w[i] * w[j] * covIJ;
      }
    return { mu, sigma: Math.sqrt(Math.max(variance, 0)) };
  }
  function probabilityOfSuccess(currentWealth, monthlySip, lumpSumToday, years, mu, sigma, requiredCorpus, rng, nSims) {
    nSims = nSims || 4000;
    const months = Math.round(years * 12);
    const monthlyMu = mu / 12, monthlySigma = sigma / Math.sqrt(12);
    let successes = 0; const terminals = [];
    for (let s = 0; s < nSims; s++) {
      let wealth = currentWealth + lumpSumToday;
      for (let m = 0; m < months; m++) { const r = monthlyMu + monthlySigma * randn(rng); wealth = (wealth + monthlySip) * (1 + r); }
      terminals.push(wealth);
      if (wealth >= requiredCorpus) successes++;
    }
    terminals.sort((a, b) => a - b);
    return { probability: successes / nSims, terminals };
  }
  function requiredCorpusFor(goal) {
    const inflation = goal.inflation != null ? goal.inflation : 0.06;
    return goal.targetAmount * Math.pow(1 + inflation, goal.horizonYears);
  }
  function solveSipForTarget(currentWealth, lumpSum, years, mu, sigma, requiredCorpus, targetProbability, rng) {
    let lo = 0, hi = requiredCorpus / Math.max(years * 12, 1);
    let bestSip = hi;
    for (let iter = 0; iter < 20; iter++) {
      const mid = (lo + hi) / 2;
      const { probability } = probabilityOfSuccess(currentWealth, mid, lumpSum, years, mu, sigma, requiredCorpus, rng, 800);
      if (probability >= targetProbability) { bestSip = mid; hi = mid; } else { lo = mid; }
    }
    return Math.round(bestSip);
  }
  function runGoalAllocation(input) {
    const { goals = [], riskCategory = 3, targetSuccessProbability = 0.80, driftBandAbs = 0.05, seed = 42 } = input;
    const rng = makeRng(seed);
    const goalAllocations = []; const scenarioPaths = [];
    const aggregatedWeights = ASSET_CLASSES.reduce((o, ac) => ({ ...o, [ac]: 0 }), {});
    let totalWeight = 0;
    for (const goal of goals) {
      const bucket = horizonBucket(goal.horizonYears);
      const weights = applyGuardrails(GLIDE_PATH_MATRIX[bucket], riskCategory);
      const { mu, sigma } = portfolioMuSigma(weights);
      const requiredCorpus = requiredCorpusFor(goal);
      const currentWealth = goal.currentValue || 0, lumpSum = goal.lumpSum || 0;
      let monthlySip = goal.monthlySip || 0;
      let { probability } = probabilityOfSuccess(currentWealth, monthlySip, lumpSum, goal.horizonYears, mu, sigma, requiredCorpus, rng);
      let recommendedSip = monthlySip;
      if (probability < targetSuccessProbability) {
        recommendedSip = solveSipForTarget(currentWealth, lumpSum, goal.horizonYears, mu, sigma, requiredCorpus, targetSuccessProbability, rng);
        probability = probabilityOfSuccess(currentWealth, recommendedSip, lumpSum, goal.horizonYears, mu, sigma, requiredCorpus, rng).probability;
      }
      const goalAttainmentScore = Math.min(100, Math.round((probability / targetSuccessProbability) * 100));
      const years = Math.max(1, Math.round(goal.horizonYears));
      const pathRng = makeRng(seed + goals.indexOf(goal) + 1);
      const nPaths = 500;
      const annualPaths = Array.from({ length: nPaths }, () => {
        let w = currentWealth + lumpSum; const path = [w];
        for (let y = 0; y < years; y++) {
          let yearWealth = w;
          for (let m = 0; m < 12; m++) { const r = mu / 12 + (sigma / Math.sqrt(12)) * randn(pathRng); yearWealth = (yearWealth + monthlySip) * (1 + r); }
          w = yearWealth; path.push(w);
        }
        return path;
      });
      const percentileSeries = { p5: [], p25: [], p50: [], p75: [], p95: [] };
      for (let y = 0; y <= years; y++) {
        const vals = annualPaths.map((p) => p[y]).sort((a, b) => a - b);
        percentileSeries.p5.push(Math.round(percentile(vals, 0.05)));
        percentileSeries.p25.push(Math.round(percentile(vals, 0.25)));
        percentileSeries.p50.push(Math.round(percentile(vals, 0.50)));
        percentileSeries.p75.push(Math.round(percentile(vals, 0.75)));
        percentileSeries.p95.push(Math.round(percentile(vals, 0.95)));
      }
      scenarioPaths.push({ goalName: goal.name, years, series: percentileSeries });
      goalAllocations.push({
        goalName: goal.name, horizonBucket: bucket, recommendedWeights: weights,
        requiredCorpus: Math.round(requiredCorpus), currentValue: currentWealth,
        requiredMonthlySip: recommendedSip, inputMonthlySip: monthlySip, goalAttainmentScore, probability,
      });
      const goalWeight = requiredCorpus; totalWeight += goalWeight;
      for (const ac of ASSET_CLASSES) aggregatedWeights[ac] += weights[ac] * goalWeight;
    }
    const householdAllocation = {};
    for (const ac of ASSET_CLASSES) householdAllocation[ac] = totalWeight ? aggregatedWeights[ac] / totalWeight : 0;
    const rebalancingTriggers = [];
    for (const g of goalAllocations) {
      if (g.probability < targetSuccessProbability) rebalancingTriggers.push({ type: 'probability', goal: g.goalName, threshold: targetSuccessProbability, currentValue: Number(g.probability.toFixed(3)) });
    }
    for (const ac of ASSET_CLASSES) {
      const guard = RISK_GUARDRAILS[riskCategory][ac];
      if (householdAllocation[ac] >= guard[1] - 0.001 || householdAllocation[ac] <= guard[0] + 0.001) {
        rebalancingTriggers.push({ type: 'drift', assetClass: ac, band: driftBandAbs, currentValue: Number(householdAllocation[ac].toFixed(3)) });
      }
    }
    return { goalAllocations, householdAllocation, rebalancingTriggers, scenarioPaths, assumptionSet: CAPITAL_MARKET_ASSUMPTIONS };
  }

  // ============================== UC2: Monte Carlo Retirement Simulation ==============================
  function blendedMuSigma(weights) {
    const cma = CAPITAL_MARKET_ASSUMPTIONS;
    const w = ASSET_CLASSES.map((ac) => weights[ac] || 0);
    const mu = ASSET_CLASSES.reduce((s, ac, i) => s + w[i] * cma.expectedReturn[ac], 0);
    let variance = 0;
    for (let i = 0; i < ASSET_CLASSES.length; i++)
      for (let j = 0; j < ASSET_CLASSES.length; j++) {
        const covIJ = cma.correlation[i][j] * cma.volatility[ASSET_CLASSES[i]] * cma.volatility[ASSET_CLASSES[j]];
        variance += w[i] * w[j] * covIJ;
      }
    return { mu, sigma: Math.sqrt(Math.max(variance, 0)) };
  }
  function simulateOnce(params, rng, withdrawalOverride, shockOrderBias) {
    const { currentCorpus, accumulationYears, decumulationYears, monthlyContribution, annualWithdrawal,
      inflationMean, inflationVol, accumulationWeights, decumulationWeights, taxRateOnGains, shockProbability, shockSize } = params;
    const { mu: muAcc, sigma: sigAcc } = blendedMuSigma(accumulationWeights);
    const { mu: muDec, sigma: sigDec } = blendedMuSigma(decumulationWeights);
    let wealth = currentCorpus;
    const totalYears = accumulationYears + decumulationYears;
    const yearlyWealth = [wealth]; let depleted = false, depletionYear = null, inflationIndex = 1;
    const yearReturns = [];
    for (let y = 0; y < totalYears; y++) {
      const inAccumulation = y < accumulationYears;
      const { mu, sigma } = inAccumulation ? { mu: muAcc, sigma: sigAcc } : { mu: muDec, sigma: sigDec };
      yearReturns.push(mu + sigma * randn(rng));
    }
    if (shockOrderBias === 'front') yearReturns.sort((a, b) => a - b);
    else if (shockOrderBias === 'back') yearReturns.sort((a, b) => b - a);
    for (let y = 0; y < totalYears; y++) {
      const inAccumulation = y < accumulationYears;
      const inflation = inflationMean + inflationVol * randn(rng);
      inflationIndex *= (1 + inflation);
      const r = yearReturns[y];
      if (inAccumulation) { wealth = (wealth + monthlyContribution * 12) * (1 + r); }
      else {
        const realWithdrawal = (withdrawalOverride != null ? withdrawalOverride : annualWithdrawal) * inflationIndex;
        let shock = 0; if (rng() < shockProbability) shock = shockSize;
        wealth = (wealth - realWithdrawal - shock) * (1 + r);
        wealth -= Math.max(0, wealth) * taxRateOnGains * 0.15;
      }
      if (wealth <= 0) { wealth = 0; if (!depleted) { depleted = true; depletionYear = y; } }
      yearlyWealth.push(wealth);
    }
    return { yearlyWealth, depleted, depletionYear, terminalWealth: wealth };
  }
  function runMonteCarlo(input) {
    const {
      currentCorpus = 5000000, accumulationYears = 15, decumulationYears = 25, monthlyContribution = 25000,
      annualWithdrawal = 420000, inflationMean = 0.06, inflationVol = 0.015,
      accumulationWeights = { Equity: 0.65, Debt: 0.25, Gold: 0.05, Cash: 0.05, International: 0.0 },
      decumulationWeights = { Equity: 0.35, Debt: 0.50, Gold: 0.10, Cash: 0.05, International: 0.0 },
      taxRateOnGains = 0.125, shockProbability = 0.03, shockSize = 300000, pathCount = 3000,
      targetSuccessProbability = 0.85, seed = 7,
    } = input;
    const rng = makeRng(seed);
    const params = { currentCorpus, accumulationYears, decumulationYears, monthlyContribution, annualWithdrawal, inflationMean, inflationVol, accumulationWeights, decumulationWeights, taxRateOnGains, shockProbability, shockSize };
    const totalYears = accumulationYears + decumulationYears;
    const allPaths = []; let successes = 0; const depletionAges = [];
    for (let s = 0; s < pathCount; s++) {
      const { yearlyWealth, depleted, depletionYear } = simulateOnce(params, rng);
      allPaths.push(yearlyWealth);
      if (!depleted) successes++; else depletionAges.push(accumulationYears + depletionYear);
    }
    const successProbability = successes / pathCount;
    const percentileWealthPaths = { p5: [], p25: [], p50: [], p75: [], p95: [] };
    for (let y = 0; y <= totalYears; y++) {
      const vals = allPaths.map((p) => p[y]).sort((a, b) => a - b);
      percentileWealthPaths.p5.push(Math.round(percentile(vals, 0.05)));
      percentileWealthPaths.p25.push(Math.round(percentile(vals, 0.25)));
      percentileWealthPaths.p50.push(Math.round(percentile(vals, 0.50)));
      percentileWealthPaths.p75.push(Math.round(percentile(vals, 0.75)));
      percentileWealthPaths.p95.push(Math.round(percentile(vals, 0.95)));
    }
    const swrRng = makeRng(seed + 1);
    let lo = 0, hi = currentCorpus * 0.15, bestWithdrawal = 0;
    for (let iter = 0; iter < 16; iter++) {
      const mid = (lo + hi) / 2; let succ = 0; const trials = 400;
      for (let s = 0; s < trials; s++) if (!simulateOnce(params, swrRng, mid).depleted) succ++;
      const p = succ / trials;
      if (p >= targetSuccessProbability) { bestWithdrawal = mid; lo = mid; } else { hi = mid; }
    }
    const safeWithdrawalRate = currentCorpus > 0 ? bestWithdrawal / currentCorpus : 0;
    const seqRng1 = makeRng(seed + 2), seqRng2 = makeRng(seed + 3);
    const trialsSeq = 500; let frontSucc = 0, backSucc = 0;
    for (let s = 0; s < trialsSeq; s++) {
      if (!simulateOnce(params, seqRng1, null, 'front').depleted) frontSucc++;
      if (!simulateOnce(params, seqRng2, null, 'back').depleted) backSucc++;
    }
    const sequenceRiskDelta = (backSucc - frontSucc) / trialsSeq;
    const depletionAgeDist = depletionAges.length
      ? { count: depletionAges.length, min: Math.min(...depletionAges), median: percentile([...depletionAges].sort((a, b) => a - b), 0.5), max: Math.max(...depletionAges) }
      : { count: 0, min: null, median: null, max: null };
    return {
      successProbability, percentileWealthPaths, safeWithdrawalRate, depletionAgeDist, sequenceRiskDelta,
      runManifest: { assumptions: CAPITAL_MARKET_ASSUMPTIONS.version, pathCount, seed, model: 'iid-normal-per-asset-class', timestamp: new Date().toISOString() },
    };
  }

  // ============================== UC3: Mean-Variance & Factor Optimization ==============================
  function buildUniverse(ids) { return ids && ids.length ? REAL_HOLDINGS.filter((u) => ids.includes(u.id)) : REAL_HOLDINGS; }
  function buildCovariance(universe) {
    const n = universe.length;
    const Sigma = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) { Sigma[i][j] = universe[i].vol * universe[i].vol; continue; }
      let corr = 0.15;
      if (universe[i].sector === universe[j].sector) corr += 0.35;
      if (universe[i].assetClass === universe[j].assetClass) corr += 0.15;
      corr = Math.min(corr, 0.9);
      if (universe[i].assetClass !== universe[j].assetClass) corr *= 0.4;
      Sigma[i][j] = corr * universe[i].vol * universe[j].vol;
    }
    return Sigma;
  }
  function blackLitterman(priorReturns, Sigma, views, tau) {
    tau = tau || 0.05;
    if (!views || !views.length) return priorReturns.slice();
    const n = priorReturns.length;
    const P = views.map((v) => { const row = new Array(n).fill(0); row[v.assetIndex] = 1; return row; });
    const Q = views.map((v) => [v.viewReturn]);
    const Omega = views.map((v, i) => {
      const row = new Array(views.length).fill(0);
      const varP = P[i].reduce((s, p, k) => s + p * p * Sigma[k][k], 0) * tau;
      row[i] = varP / Math.max(v.confidence, 0.05);
      return row;
    });
    const tauSigma = Sigma.map((row) => row.map((v) => v * tau));
    const tauSigmaInv = invert(tauSigma);
    const Pt = transpose(P);
    const OmegaInv = invert(Omega);
    const PtOmegaInv = matMul(Pt, OmegaInv);
    const PtOmegaInvP = matMul(PtOmegaInv, P);
    const A = tauSigmaInv.map((row, i) => row.map((v, j) => v + PtOmegaInvP[i][j]));
    const AInv = invert(A);
    const piVec = priorReturns.map((v) => [v]);
    const term1 = matMul(tauSigmaInv, piVec);
    const term2 = matMul(PtOmegaInv, Q);
    const B = term1.map((row, i) => [row[0] + term2[i][0]]);
    const muBL = matMul(AInv, B);
    return muBL.map((r) => r[0]);
  }
  function portfolioStats(w, mu, Sigma) {
    const ret = w.reduce((s, wi, i) => s + wi * mu[i], 0);
    let variance = 0;
    for (let i = 0; i < w.length; i++) for (let j = 0; j < w.length; j++) variance += w[i] * w[j] * Sigma[i][j];
    return { ret, vol: Math.sqrt(Math.max(variance, 0)) };
  }
  function optimize(universe, mu, Sigma, opts) {
    const n = universe.length;
    const {
      objective = 'maxSharpe', targetReturn = null, lb = new Array(n).fill(0), ub = new Array(n).fill(0.35),
      sectorCaps = {}, riskAversion = 3, iterations = 600, lr = 0.05, factorTargets = null,
      turnoverCap = null, currentWeights = null, esgScores = null, esgMin = null, carbonScores = null,
      carbonMax = null, benchmarkWeights = null, teMax = null,
    } = opts;
    let w = projectToSimplexBox(new Array(n).fill(1 / n), lb, ub);
    function sectorPenaltyGrad(w) {
      const grad = new Array(n).fill(0); const sectorSums = {};
      universe.forEach((u, i) => { sectorSums[u.sector] = (sectorSums[u.sector] || 0) + w[i]; });
      for (const [sector, cap] of Object.entries(sectorCaps)) {
        const sum = sectorSums[sector] || 0;
        if (sum > cap) universe.forEach((u, i) => { if (u.sector === sector) grad[i] += 2 * (sum - cap); });
      }
      return grad;
    }
    function factorPenaltyGrad(w) {
      const grad = new Array(n).fill(0); if (!factorTargets) return grad;
      for (const [factor, range] of Object.entries(factorTargets)) {
        let exposure = 0; universe.forEach((u, i) => { exposure += w[i] * (u.factors[factor] || 0); });
        if (range.min != null && exposure < range.min) universe.forEach((u, i) => { grad[i] += 2 * (exposure - range.min) * (u.factors[factor] || 0); });
        if (range.max != null && exposure > range.max) universe.forEach((u, i) => { grad[i] += 2 * (exposure - range.max) * (u.factors[factor] || 0); });
      }
      return grad;
    }
    function turnoverPenaltyGrad(w) {
      const grad = new Array(n).fill(0); if (!turnoverCap || !currentWeights) return grad;
      const turnover = w.reduce((s, wi, i) => s + Math.abs(wi - currentWeights[i]), 0);
      if (turnover > turnoverCap) w.forEach((wi, i) => { grad[i] += 2 * Math.sign(wi - currentWeights[i]) * (turnover - turnoverCap); });
      return grad;
    }
    function esgPenaltyGrad(w) {
      const grad = new Array(n).fill(0); if (!esgScores || esgMin == null) return grad;
      const weightedEsg = w.reduce((s, wi, i) => s + wi * esgScores[i], 0);
      if (weightedEsg < esgMin) w.forEach((wi, i) => { grad[i] += 2 * (weightedEsg - esgMin) * esgScores[i]; });
      return grad;
    }
    function carbonPenaltyGrad(w) {
      const grad = new Array(n).fill(0); if (!carbonScores || carbonMax == null) return grad;
      const weightedCarbon = w.reduce((s, wi, i) => s + wi * carbonScores[i], 0);
      if (weightedCarbon > carbonMax) w.forEach((wi, i) => { grad[i] += 2 * (weightedCarbon - carbonMax) * carbonScores[i]; });
      return grad;
    }
    function trackingErrorPenaltyGrad(w) {
      const grad = new Array(n).fill(0); if (!benchmarkWeights || teMax == null) return grad;
      const active = w.map((wi, i) => wi - benchmarkWeights[i]);
      const Sa = matVec(Sigma, active);
      const teVar = active.reduce((s, a, i) => s + a * Sa[i], 0);
      const te = Math.sqrt(Math.max(teVar, 0));
      if (te > teMax) Sa.forEach((v, i) => { grad[i] += 2 * (te - teMax) * v; });
      return grad;
    }
    for (let iter = 0; iter < iterations; iter++) {
      const Sw = matVec(Sigma, w); let grad;
      if (objective === 'minVariance') grad = Sw.map((v) => -2 * v);
      else if (objective === 'targetReturn') {
        const { ret } = portfolioStats(w, mu, Sigma);
        const retPenalty = 50 * (ret - (targetReturn != null ? targetReturn : ret));
        grad = Sw.map((v, i) => -2 * v + retPenalty * mu[i]);
      } else grad = mu.map((m, i) => m - riskAversion * Sw[i]);
      const secGrad = sectorPenaltyGrad(w), facGrad = factorPenaltyGrad(w), turnGrad = turnoverPenaltyGrad(w);
      const esgGrad = esgPenaltyGrad(w), carbonGrad = carbonPenaltyGrad(w), teGrad = trackingErrorPenaltyGrad(w);
      const step = grad.map((g, i) => g - secGrad[i] - facGrad[i] - turnGrad[i] - esgGrad[i] - carbonGrad[i] - teGrad[i]);
      w = w.map((wi, i) => wi + lr * step[i]);
      w = projectToSimplexBox(w, lb, ub);
    }
    return w;
  }
  function computeFrontier(universe, mu, Sigma, opts, points) {
    points = points || 12;
    const minRet = Math.min(...mu), maxRet = Math.max(...mu);
    const frontier = [];
    for (let k = 0; k <= points; k++) {
      const target = minRet + ((maxRet - minRet) * k) / points;
      const w = optimize(universe, mu, Sigma, { ...opts, objective: 'targetReturn', targetReturn: target, iterations: 250 });
      const { ret, vol } = portfolioStats(w, mu, Sigma);
      frontier.push({ targetReturn: target, return: ret, risk: vol });
    }
    return frontier;
  }
  function runOptimization(input) {
    const {
      universeIds = null, objective = 'maxSharpe', riskFreeRate = 0.065, shrinkageIntensity = 0.3,
      useBlackLitterman = false, views = [], sectorCaps = {}, boxMax = 0.35, riskAversion = 3,
      turnoverCap = null, currentHoldings = {}, transactionCostBps = 15,
    } = input;
    const universe = buildUniverse(universeIds);
    const n = universe.length;
    const priorReturns = universe.map((u) => u.expReturn);
    const sampleSigma = buildCovariance(universe);
    const Sigma = shrinkCovariance(sampleSigma, shrinkageIntensity);
    const viewsIdx = views.map((v) => ({ assetIndex: universe.findIndex((u) => u.id === v.assetId), viewReturn: v.viewReturn, confidence: v.confidence })).filter((v) => v.assetIndex >= 0);
    const mu = useBlackLitterman ? blackLitterman(priorReturns, Sigma, viewsIdx) : priorReturns;
    const currentWeights = universe.map((u) => currentHoldings[u.id] || 0);
    const lb = new Array(n).fill(0), ub = new Array(n).fill(boxMax);
    const optOpts = { objective, riskFreeRate, lb, ub, sectorCaps, riskAversion, turnoverCap, currentWeights };
    const optimalWeights = optimize(universe, mu, Sigma, optOpts);
    const { ret, vol } = portfolioStats(optimalWeights, mu, Sigma);
    const sharpe = vol > 0 ? (ret - riskFreeRate) / vol : 0;
    const efficientFrontier = computeFrontier(universe, mu, Sigma, { lb, ub, sectorCaps });
    const currentStats = portfolioStats(currentWeights, mu, Sigma);
    const factorReport = {};
    ['value', 'quality', 'momentum', 'size', 'lowvol'].forEach((f) => { factorReport[f] = universe.reduce((s, u, i) => s + optimalWeights[i] * (u.factors[f] || 0), 0); });
    const tradeList = universe.map((u, i) => {
      const delta = optimalWeights[i] - currentWeights[i];
      return { security: u.id, name: u.name, currentWeight: currentWeights[i], targetWeight: Number(optimalWeights[i].toFixed(4)), delta: Number(delta.toFixed(4)), side: delta > 0.0005 ? 'BUY' : delta < -0.0005 ? 'SELL' : 'HOLD', estimatedCostBps: Math.abs(delta) * transactionCostBps * 100 };
    }).filter((t) => t.side !== 'HOLD');
    const turnover = tradeList.reduce((s, t) => s + Math.abs(t.delta), 0);
    const estimatedCost = tradeList.reduce((s, t) => s + Math.abs(t.delta) * (transactionCostBps / 10000), 0);
    const weightedAvgVol = universe.reduce((s, u, i) => s + optimalWeights[i] * u.vol, 0);
    const diversificationRatio = vol > 0 ? weightedAvgVol / vol : 1;
    const feasibility = {
      sumWeights: Number(optimalWeights.reduce((a, b) => a + b, 0).toFixed(6)),
      boxSatisfied: optimalWeights.every((w) => w >= -1e-6 && w <= boxMax + 1e-6),
      sectorCapsSatisfied: Object.entries(sectorCaps).every(([sector, cap]) => {
        const sum = universe.reduce((s, u, i) => (u.sector === sector ? s + optimalWeights[i] : s), 0);
        return sum <= cap + 0.01;
      }),
    };
    return {
      universe: universe.map((u) => ({ id: u.id, name: u.name, sector: u.sector, vol: u.vol })),
      optimalWeights: universe.map((u, i) => ({ security: u.id, weight: Number(optimalWeights[i].toFixed(4)) })),
      efficientFrontier, currentPortfolio: { return: currentStats.ret, risk: currentStats.vol }, factorReport, tradeList,
      riskMetrics: { expectedReturn: ret, volatility: vol, sharpe, diversificationRatio, turnover, estimatedCost },
      feasibility, muUsed: useBlackLitterman ? 'black-litterman-blended' : 'house-view-prior',
      mu, covariance: Sigma, riskFreeRate,
    };
  }

  // ============================== UC4: Dynamic Rebalancing Engine ==============================
  function monthsBetween(dateStr, asOf) {
    const d = new Date(dateStr), now = asOf ? new Date(asOf) : new Date();
    return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  }
  function lotTaxRate(lot, asOf) {
    const held = monthsBetween(lot.purchaseDate, asOf);
    const isLongTerm = held >= TAX_RULES.equity.shortTermMonths;
    return { isLongTerm, rate: isLongTerm ? TAX_RULES.equity.ltcgRate : TAX_RULES.equity.stcgRate };
  }
  function aggregateBySecurity(lots) {
    const bySecurity = {};
    for (const lot of lots) { if (!bySecurity[lot.security]) bySecurity[lot.security] = []; bySecurity[lot.security].push(lot); }
    return bySecurity;
  }
  function currentValueAndWeights(lots) {
    const bySecurity = aggregateBySecurity(lots);
    const values = {}; let total = 0;
    for (const [sec, secLots] of Object.entries(bySecurity)) { const val = secLots.reduce((s, l) => s + l.qty * l.currentPrice, 0); values[sec] = val; total += val; }
    const weights = {};
    for (const sec of Object.keys(values)) weights[sec] = total ? values[sec] / total : 0;
    return { values, weights, total, bySecurity };
  }
  function runRebalancing(input) {
    const {
      lots = [], targetWeights = {}, driftBandAbs = 0.05, driftBandRel = 0.20, policy = 'threshold',
      cashflow = 0, transactionCostBps = 10, minTradeValue = 5000, asOfDate = null,
    } = input;
    const { values, weights, total, bySecurity } = currentValueAndWeights(lots);
    const allSecurities = new Set([...Object.keys(weights), ...Object.keys(targetWeights)]);
    const driftAlerts = [];
    for (const sec of allSecurities) {
      const actual = weights[sec] || 0, target = targetWeights[sec] || 0, drift = actual - target;
      const relDrift = target > 0 ? Math.abs(drift) / target : (actual > 0 ? 1 : 0);
      const breach = Math.abs(drift) > driftBandAbs || relDrift > driftBandRel;
      driftAlerts.push({ security: sec, currentWeight: Number(actual.toFixed(4)), targetWeight: Number(target.toFixed(4)), drift: Number(drift.toFixed(4)), band: driftBandAbs, breach });
    }
    const anyBreach = driftAlerts.some((d) => d.breach);
    const rebalanceTriggered = policy === 'calendar' ? true : anyBreach;
    // Only ever touches breached securities (unlike M4-UC3, which considers the whole portfolio).
    const tradeList = []; const newTotal = total + cashflow;
    let taxImpactTotal = 0, unallocatedCash = 0;
    if (rebalanceTriggered) {
      const breachedUnderweight = driftAlerts
        .filter((d) => d.breach && d.drift < 0)
        .sort((a, b) => a.drift - b.drift)
        .map((d) => ({ security: d.security, gap: Math.max(0, d.targetWeight * newTotal - (values[d.security] || 0)) }));
      const breachedOverweight = driftAlerts.filter((d) => d.breach && d.drift > 0);

      // Stage 1 (cash-flow-first): fund underweight-breached gaps from incoming cashflow.
      let pool = cashflow;
      for (const u of breachedUnderweight) {
        if (pool <= 0 || u.gap <= 0) continue;
        const buyAmount = Math.min(u.gap, pool);
        if (buyAmount >= minTradeValue) { tradeList.push({ security: u.security, side: 'BUY', amount: Math.round(buyAmount), source: 'cashflow', taxImpact: 0, estimatedCost: Math.round(buyAmount * transactionCostBps / 10000) }); pool -= buyAmount; u.gap -= buyAmount; }
      }

      // Stage 2: sell every breached-overweight position down to target; pool the proceeds (do not discard them).
      for (const d of breachedOverweight) {
        const targetValue = d.targetWeight * newTotal, currentValue = values[d.security] || 0, gapValue = currentValue - targetValue;
        if (gapValue <= minTradeValue) continue;
        const secLots = (bySecurity[d.security] || []).slice();
        secLots.sort((a, b) => {
          const glA = (a.currentPrice - a.costBasis), glB = (b.currentPrice - b.costBasis);
          const scoreA = glA < 0 ? -1000 + glA : (lotTaxRate(a, asOfDate).isLongTerm ? 0 : 1000) + glA;
          const scoreB = glB < 0 ? -1000 + glB : (lotTaxRate(b, asOfDate).isLongTerm ? 0 : 1000) + glB;
          return scoreA - scoreB;
        });
        let remainingToSell = gapValue;
        for (const lot of secLots) {
          if (remainingToSell <= 0) break;
          const lotValue = lot.qty * lot.currentPrice, sellValue = Math.min(lotValue, remainingToSell), sellQty = sellValue / lot.currentPrice;
          const { isLongTerm, rate } = lotTaxRate(lot, asOfDate);
          const realizedGain = (lot.currentPrice - lot.costBasis) * sellQty, tax = Math.max(0, realizedGain) * rate;
          taxImpactTotal += tax;
          tradeList.push({ security: d.security, side: 'SELL', amount: Math.round(sellValue), lotId: lot.id, holdingType: isLongTerm ? 'LTCG' : 'STCG', realizedGain: Math.round(realizedGain), taxImpact: Math.round(tax), estimatedCost: Math.round(sellValue * transactionCostBps / 10000) });
          remainingToSell -= sellValue;
          pool += sellValue;
        }
      }

      // Stage 3: redeploy the combined pool (leftover cashflow + sell proceeds) into remaining underweight-breached gaps.
      for (const u of breachedUnderweight) {
        if (pool <= 0 || u.gap <= 0) continue;
        const buyAmount = Math.min(u.gap, pool);
        if (buyAmount >= minTradeValue) { tradeList.push({ security: u.security, side: 'BUY', amount: Math.round(buyAmount), source: 'sell-proceeds', taxImpact: 0, estimatedCost: Math.round(buyAmount * transactionCostBps / 10000) }); pool -= buyAmount; u.gap -= buyAmount; }
      }
      unallocatedCash = Math.round(pool);
    }
    const taxImpact = { totalTax: Math.round(taxImpactTotal), bucket: rebalanceTriggered ? 'STCG+LTCG blended' : 'n/a' };
    const postValues = { ...values };
    for (const t of tradeList) postValues[t.security] = (postValues[t.security] || 0) + (t.side === 'BUY' ? t.amount : -t.amount);
    const postTotal = Object.values(postValues).reduce((a, b) => a + b, 0) + unallocatedCash || 1;
    const postTradeWeights = {};
    for (const sec of allSecurities) postTradeWeights[sec] = Number(((postValues[sec] || 0) / postTotal).toFixed(4));
    if (unallocatedCash > 0) postTradeWeights['Cash (unallocated)'] = Number((unallocatedCash / postTotal).toFixed(4));
    const costEstimate = tradeList.reduce((s, t) => s + (t.estimatedCost || 0), 0);
    const alternativeTrades = tradeList.filter((t) => t.side === 'BUY' && t.source === 'cashflow');
    return {
      driftAlerts, rebalanceTriggered, tradeList, postTradeWeights, unallocatedCash, taxImpact, costEstimate,
      alternatives: [{ label: 'Tax-deferred (cash-flow only, tolerate residual drift)', tradeList: alternativeTrades, taxImpact: 0, note: 'Skips sell-side trades; relies on future cashflows and a wider drift tolerance to converge over time.' }],
      policy, currentTotal: total, postTotal,
    };
  }

  // ============================== UC5: Tax-Loss Harvesting ==============================
  function findSecurity(id) { return REAL_HOLDINGS.find((u) => u.id === id); }
  function factorSimilarity(a, b) {
    if (!a || !b) return 0;
    const keys = ['value', 'quality', 'momentum', 'size', 'lowvol'];
    let dist = 0; for (const k of keys) dist += Math.pow((a.factors[k] || 0) - (b.factors[k] || 0), 2);
    const maxDist = keys.length * 4;
    return Math.max(0, 1 - Math.sqrt(dist) / Math.sqrt(maxDist));
  }
  function trackingErrorEstimate(a, b) {
    if (!a || !b) return 1;
    const volDiff = Math.abs(a.vol - b.vol), sectorPenalty = a.sector === b.sector ? 0 : 0.06;
    return Number((volDiff * 0.5 + sectorPenalty).toFixed(4));
  }
  function runTaxLossHarvesting(input) {
    const {
      lots = [], realizedGainsYTD = { stcg: 0, ltcg: 0 }, washSaleWindowDays = TAX_RULES.washSaleWindowDays,
      minHarvestableLoss = 2000, recentlyPurchased = [], similarityWeight = 0.6, teWeight = 0.3, costWeight = 0.1,
      maxCarryForward = null, asOfDate = null,
    } = input;
    const now = asOfDate ? new Date(asOfDate) : new Date();
    const lossLots = [];
    for (const lot of lots) {
      const gainLoss = (lot.currentPrice - lot.costBasis) * lot.qty;
      if (gainLoss < -minHarvestableLoss) { const { isLongTerm, rate } = lotTaxRate(lot, asOfDate); lossLots.push({ ...lot, unrealizedLoss: gainLoss, isLongTerm, applicableRate: rate }); }
    }
    lossLots.forEach((l) => { l.taxBenefit = Math.abs(l.unrealizedLoss) * l.applicableRate; });
    lossLots.sort((a, b) => b.taxBenefit - a.taxBenefit);
    const complianceFlags = []; const sellBuyPairs = [];
    let harvestedSTCG = 0, harvestedLTCG = 0;
    let remainingSTCGOffset = realizedGainsYTD.stcg || 0, remainingLTCGOffset = realizedGainsYTD.ltcg || 0;
    for (const lot of lossLots) {
      const sold = findSecurity(lot.security);
      const recentBuy = recentlyPurchased.find((r) => r.security === lot.security);
      if (recentBuy) {
        const daysSince = Math.round((now - new Date(recentBuy.date)) / 86400000);
        if (daysSince < washSaleWindowDays) { complianceFlags.push({ security: lot.security, type: 'wash-sale-block', message: `Repurchase within ${washSaleWindowDays}d window (bought ${daysSince}d ago); harvesting blocked.` }); continue; }
      }
      let offsetBucket = lot.isLongTerm ? 'ltcg' : 'stcg';
      const available = offsetBucket === 'ltcg' ? remainingLTCGOffset : remainingSTCGOffset;
      const offsetAmount = Math.min(Math.abs(lot.unrealizedLoss), Math.max(available, 0));
      const unoffsetAmount = Math.abs(lot.unrealizedLoss) - offsetAmount;
      if (offsetBucket === 'ltcg') remainingLTCGOffset -= offsetAmount; else remainingSTCGOffset -= offsetAmount;
      if (lot.isLongTerm) harvestedLTCG += Math.abs(lot.unrealizedLoss); else harvestedSTCG += Math.abs(lot.unrealizedLoss);
      let candidates = REAL_HOLDINGS.filter((u) => u.id !== lot.security && sold && u.type === sold.type && u.macap === sold.macap);
      if (!candidates.length) candidates = REAL_HOLDINGS.filter((u) => u.id !== lot.security);
      let best = null, bestScore = -Infinity;
      for (const c of candidates) {
        const sim = factorSimilarity(sold, c), te = trackingErrorEstimate(sold, c);
        const score = similarityWeight * sim - teWeight * te - costWeight * 0.001;
        if (score > bestScore) { bestScore = score; best = { ...c, similarity: Number(sim.toFixed(3)), trackingError: te }; }
      }
      sellBuyPairs.push({ sellLotId: lot.id, sellSecurity: lot.security, qty: lot.qty, unrealizedLoss: Math.round(lot.unrealizedLoss), holdingType: lot.isLongTerm ? 'LTCG' : 'STCG', taxBenefit: Math.round(lot.taxBenefit), offsetBucket, offsetApplied: Math.round(offsetAmount), unoffsetAmount: Math.round(unoffsetAmount), remainingCapacityAfter: Math.round(Math.max(offsetBucket === 'ltcg' ? remainingLTCGOffset : remainingSTCGOffset, 0)), replacement: best ? { security: best.id, name: best.name, similarity: best.similarity, trackingError: best.trackingError } : null });
    }
    const ytdTaxAlpha = Math.round(harvestedSTCG * TAX_RULES.equity.stcgRate + harvestedLTCG * TAX_RULES.equity.ltcgRate);
    const harvestReport = { lotsScanned: lots.length, lossLotsFound: lossLots.length, lossLotsHarvested: sellBuyPairs.length, totalRealizedLoss: Math.round(harvestedSTCG + harvestedLTCG), breakdown: { stcgLossHarvested: Math.round(harvestedSTCG), ltcgLossHarvested: Math.round(harvestedLTCG) } };
    const harvestCapacity = { remainingSTCGOffset: Math.round(Math.max(remainingSTCGOffset, 0)), remainingLTCGOffset: Math.round(Math.max(remainingLTCGOffset, 0)), carryForwardEligible: maxCarryForward != null ? Math.max(0, maxCarryForward - (harvestedSTCG + harvestedLTCG)) : null };
    const allocationDelta = {};
    for (const pair of sellBuyPairs) { const sold = findSecurity(pair.sellSecurity); if (sold) allocationDelta[sold.assetClass] = (allocationDelta[sold.assetClass] || 0); }
    return { harvestReport, sellBuyPairs, complianceFlags, ytdTaxAlpha, harvestCapacity, allocationDelta };
  }

  // ============================== UC6: ESG & Mandate-Constrained Optimization ==============================
  // Keeps its own small illustrative universe (with ESG/carbon fields), independent of UC3's
  // universe (repointed to the client-supplied real-holdings dataset, which has no ESG/carbon data).
  function buildUniverseUC6(ids) { return ids && ids.length ? UNIVERSE.filter((u) => ids.includes(u.id)) : UNIVERSE; }
  function runEsgOptimization(input) {
    const {
      universeIds = null, exclusions = EXCLUSION_LIST, esgMin = 65, carbonMax = 35, teMax = 0.06,
      boxMax = 0.30, shrinkageIntensity = 0.3, riskAversion = 3,
    } = input;
    const universe = buildUniverseUC6(universeIds);
    const n = universe.length;
    const mu = universe.map((u) => u.expReturn);
    const sampleSigma = buildCovariance(universe);
    const Sigma = shrinkCovariance(sampleSigma, shrinkageIntensity);
    const esgScores = universe.map((u) => u.esg), carbonScores = universe.map((u) => u.carbon);
    const benchmarkWeights = universe.map((u) => BENCHMARK_WEIGHTS[u.id] || 0);
    const bmkSum = benchmarkWeights.reduce((a, b) => a + b, 0) || 1;
    const normBmk = benchmarkWeights.map((w) => w / bmkSum);
    const lb = new Array(n).fill(0), ub = universe.map((u) => (exclusions.includes(u.id) ? 0 : boxMax));
    const unconstrainedWeights = optimize(universe, mu, Sigma, { objective: 'maxSharpe', lb: new Array(n).fill(0), ub: new Array(n).fill(boxMax), riskAversion });
    const unconstrainedStats = portfolioStats(unconstrainedWeights, mu, Sigma);
    const esgWeights = optimize(universe, mu, Sigma, { objective: 'maxSharpe', lb, ub, riskAversion, esgScores, esgMin, carbonScores, carbonMax, benchmarkWeights: normBmk, teMax, iterations: 800 });
    const esgStats = portfolioStats(esgWeights, mu, Sigma);
    const weightedEsg = esgWeights.reduce((s, w, i) => s + w * esgScores[i], 0);
    const weightedCarbon = esgWeights.reduce((s, w, i) => s + w * carbonScores[i], 0);
    const bmkEsg = normBmk.reduce((s, w, i) => s + w * esgScores[i], 0);
    const bmkCarbon = normBmk.reduce((s, w, i) => s + w * carbonScores[i], 0);
    const unconEsg = unconstrainedWeights.reduce((s, w, i) => s + w * esgScores[i], 0);
    const unconCarbon = unconstrainedWeights.reduce((s, w, i) => s + w * carbonScores[i], 0);
    const active = esgWeights.map((w, i) => w - normBmk[i]);
    let teVar = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) teVar += active[i] * active[j] * Sigma[i][j];
    const trackingError = Math.sqrt(Math.max(teVar, 0));
    const exclusionCompliance = { excludedNames: exclusions, allZeroWeight: exclusions.every((id) => { const idx = universe.findIndex((u) => u.id === id); return idx < 0 || esgWeights[idx] < 1e-6; }) };
    const esgReturnCost = Math.max(0, unconstrainedStats.ret - esgStats.ret);
    const sectorWeights = (weightsArr) => { const sw = {}; universe.forEach((u, i) => { sw[u.sector] = (sw[u.sector] || 0) + weightsArr[i]; }); return sw; };
    const esgSectors = sectorWeights(esgWeights), bmkSectors = sectorWeights(normBmk);
    const residualTilts = {};
    const allSectors = new Set([...Object.keys(esgSectors), ...Object.keys(bmkSectors)]);
    for (const s of allSectors) residualTilts[s] = Number(((esgSectors[s] || 0) - (bmkSectors[s] || 0)).toFixed(4));
    return {
      esgWeights: universe.map((u, i) => ({ security: u.id, weight: Number(esgWeights[i].toFixed(4)) })),
      esgCarbonReport: { portfolioEsg: Number(weightedEsg.toFixed(1)), portfolioCarbon: Number(weightedCarbon.toFixed(1)), benchmarkEsg: Number(bmkEsg.toFixed(1)), benchmarkCarbon: Number(bmkCarbon.toFixed(1)), unconstrainedEsg: Number(unconEsg.toFixed(1)), unconstrainedCarbon: Number(unconCarbon.toFixed(1)), esgMinConstraint: esgMin, carbonMaxConstraint: carbonMax, esgConstraintMet: weightedEsg >= esgMin - 0.5, carbonConstraintMet: weightedCarbon <= carbonMax + 0.5 },
      exclusionCompliance, trackingError: Number(trackingError.toFixed(4)), esgReturnCost: Number(esgReturnCost.toFixed(4)), residualTilts,
      comparison: { unconstrained: { return: unconstrainedStats.ret, risk: unconstrainedStats.vol }, esgConstrained: { return: esgStats.ret, risk: esgStats.vol } },
    };
  }

  // ============================== UC7: Robo-Advisory Engine ==============================
  function scoreQuestionnaire(responses) {
    const avg = (arr) => (arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 3);
    const toleranceScore = avg(responses.tolerance), capacityScore = avg(responses.capacity);
    const finalCategory = Math.max(1, Math.min(5, Math.round(Math.min(toleranceScore, capacityScore))));
    return { toleranceScore: Number(toleranceScore.toFixed(2)), capacityScore: Number(capacityScore.toFixed(2)), finalCategory };
  }
  function runRoboAdvisory(input) {
    const {
      riskQuestionnaire = { tolerance: [4, 3, 4], capacity: [3, 3, 4] }, goals = [], lots = [], cashflow = 0,
      targetSuccessProbability = 0.80, driftBandAbs = 0.05, rmOverride = null, seed = 11,
    } = input;
    const auditTrail = []; const now = new Date().toISOString();
    const riskScore = scoreQuestionnaire(riskQuestionnaire);
    let finalCategory = riskScore.finalCategory;
    auditTrail.push({ timestamp: now, action: 'risk-scored', detail: riskScore });
    if (rmOverride && rmOverride.category) { auditTrail.push({ timestamp: now, action: 'rm-override', detail: { from: finalCategory, to: rmOverride.category, rationale: rmOverride.rationale || 'not provided' } }); finalCategory = rmOverride.category; }
    const model = MODEL_PORTFOLIO_LIBRARY[finalCategory] || MODEL_PORTFOLIO_LIBRARY[3];
    auditTrail.push({ timestamp: now, action: 'model-assigned', detail: { category: finalCategory, model: model.name } });
    const goalAllocationResult = runGoalAllocation({ goals, riskCategory: finalCategory, targetSuccessProbability, driftBandAbs, seed });
    auditTrail.push({ timestamp: now, action: 'funding-plan-built', detail: { goalCount: goals.length } });
    const fundingPlan = goalAllocationResult.goalAllocations.map((g) => ({ goalName: g.goalName, requiredMonthlySip: g.requiredMonthlySip, stepUpSuggested: Math.round(g.requiredMonthlySip * 0.10), horizonBucket: g.horizonBucket, requiredCorpus: g.requiredCorpus }));
    let rebalancingAlerts = [];
    if (lots.length) {
      const holdingsBySecurity = {};
      for (const lot of lots) holdingsBySecurity[lot.security] = (holdingsBySecurity[lot.security] || 0) + lot.qty * lot.currentPrice;
      const totalValue = Object.values(holdingsBySecurity).reduce((a, b) => a + b, 0) || 1;
      const bySecurityTarget = {};
      for (const sec of Object.keys(holdingsBySecurity)) bySecurityTarget[sec] = holdingsBySecurity[sec] / totalValue;
      const rebalanceResult = runRebalancing({ lots, targetWeights: bySecurityTarget, driftBandAbs, cashflow });
      rebalancingAlerts = rebalanceResult.driftAlerts.filter((d) => d.breach).map((d) => ({ ...d, recommendedAction: d.drift > 0 ? 'Trim overweight position' : 'Top up underweight position' }));
      auditTrail.push({ timestamp: now, action: 'rebalancing-checked', detail: { breaches: rebalancingAlerts.length } });
    }
    const goalDashboard = {
      goals: goalAllocationResult.goalAllocations.map((g) => {
        const fundedRatio = g.requiredCorpus > 0 ? Math.min(1, g.currentValue / g.requiredCorpus) : 1;
        const offTrack = g.probability < targetSuccessProbability;
        return { goalName: g.goalName, fundedRatio: Number(fundedRatio.toFixed(3)), probability: g.probability, healthScore: g.goalAttainmentScore, status: offTrack ? 'OFF-TRACK' : 'ON-TRACK', recommendedAction: offTrack ? `Increase SIP to ₹${g.requiredMonthlySip}/month` : 'No action needed' };
      }),
      householdAllocation: goalAllocationResult.householdAllocation,
    };
    auditTrail.push({ timestamp: now, action: 'goal-dashboard-computed', detail: { offTrackCount: goalDashboard.goals.filter((g) => g.status === 'OFF-TRACK').length } });
    return {
      riskProfile: { tolerance: riskScore.toleranceScore, capacity: riskScore.capacityScore, finalCategory, overridden: !!rmOverride },
      modelRecommendation: { category: finalCategory, modelName: model.name, personalisedWeights: model.weights },
      fundingPlan, rebalancingAlerts, goalDashboard, auditTrail,
      suitabilityNote: 'Recommendation subject to Module 9 suitability checks; disclosures and RM override are logged in auditTrail per SEBI RA requirements.',
    };
  }

  // ============================== Sample requests (mirrors src/routes/*.js) ==============================
  const SAMPLES = {
    uc1: {
      riskCategory: 3, targetSuccessProbability: 0.80,
      goals: [
        { name: 'Child Education', targetAmount: 3000000, horizonYears: 12, inflation: 0.08, currentValue: 400000, lumpSum: 0, monthlySip: 8000 },
        { name: 'Retirement', targetAmount: 20000000, horizonYears: 25, inflation: 0.06, currentValue: 1500000, lumpSum: 0, monthlySip: 15000 },
        { name: 'Home Down-payment', targetAmount: 2000000, horizonYears: 4, inflation: 0.06, currentValue: 300000, lumpSum: 100000, monthlySip: 20000 },
      ],
    },
    uc2: {
      currentCorpus: 5000000, accumulationYears: 15, decumulationYears: 25, monthlyContribution: 25000,
      annualWithdrawal: 420000, inflationMean: 0.06, inflationVol: 0.015,
      accumulationWeights: { Equity: 0.65, Debt: 0.25, Gold: 0.05, Cash: 0.05, International: 0.0 },
      decumulationWeights: { Equity: 0.35, Debt: 0.50, Gold: 0.10, Cash: 0.05, International: 0.0 },
      shockProbability: 0.03, shockSize: 300000, pathCount: 3000, targetSuccessProbability: 0.85,
    },
    uc3: {
      objective: 'maxSharpe', riskFreeRate: 0.065, shrinkageIntensity: 0.3, useBlackLitterman: true,
      views: [{ assetId: 'HDFCBANK', viewReturn: 0.16, confidence: 0.6 }],
      sectorCaps: { 'Information Technology': 0.15, 'Financial Services': 0.30 }, boxMax: 0.15, riskAversion: 3, turnoverCap: null,
      currentHoldings: (() => {
        const total = REAL_HOLDINGS.reduce((s, h) => s + h.qty * h.currentPrice, 0);
        const out = {}; REAL_HOLDINGS.forEach((h) => { out[h.id] = Number(((h.qty * h.currentPrice) / total).toFixed(4)); }); return out;
      })(),
      transactionCostBps: 15,
    },
    uc4: (() => {
      const lots = REAL_HOLDINGS.map((h) => ({ id: h.isin, security: h.id, qty: h.qty, costBasis: h.costBasis, purchaseDate: h.purchaseDate, currentPrice: h.currentPrice }));
      const total = REAL_HOLDINGS.reduce((s, h) => s + h.qty * h.currentPrice, 0);
      const rawTargets = {};
      REAL_HOLDINGS.forEach((h) => { const cw = (h.qty * h.currentPrice) / total; rawTargets[h.id] = h.reco === 'Sell' ? 0 : h.reco === 'Buy' ? cw * 1.4 : cw; });
      const targetSum = Object.values(rawTargets).reduce((a, b) => a + b, 0) || 1;
      const targetWeights = {};
      Object.entries(rawTargets).forEach(([id, w]) => { targetWeights[id] = Number((w / targetSum).toFixed(4)); });
      return { lots, targetWeights, driftBandAbs: 0.05, driftBandRel: 0.20, policy: 'threshold', cashflow: 50000, transactionCostBps: 10, minTradeValue: 2000 };
    })(),
    uc5: {
      lots: REAL_HOLDINGS.map((h) => ({ id: h.isin, security: h.id, qty: h.qty, costBasis: h.costBasis, purchaseDate: h.purchaseDate, currentPrice: h.currentPrice })),
      realizedGainsYTD: { stcg: 15000, ltcg: 40000 }, washSaleWindowDays: 30,
      minHarvestableLoss: 500, recentlyPurchased: [],
    },
    uc6: { exclusions: EXCLUSION_LIST, esgMin: 65, carbonMax: 35, teMax: 0.06, boxMax: 0.30 },
    uc7: {
      riskQuestionnaire: { tolerance: [4, 4, 3, 5], capacity: [3, 4, 3] },
      goals: [
        { name: 'Child Education', targetAmount: 3000000, horizonYears: 12, inflation: 0.08, currentValue: 400000, monthlySip: 8000 },
        { name: 'Retirement', targetAmount: 20000000, horizonYears: 25, inflation: 0.06, currentValue: 1500000, monthlySip: 15000 },
      ],
      lots: SAMPLE_LOTS, cashflow: 20000, targetSuccessProbability: 0.80,
    },
  };

  
  // Compact pure-JS SHA-256 (browser has no synchronous 'crypto' module) -- used for the M3-UC5
  // recommendation-ledger hash chain so tamper-evidence works identically to the Node build.
  function sha256Hex(message) {
    function rightRotate(v, n) { return (v >>> n) | (v << (32 - n)); }
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const bytes = [];
    for (let i = 0; i < message.length; i++) {
      const c = message.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else { bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);
    for (let chunkStart = 0; chunkStart < bytes.length; chunkStart += 64) {
      const w = new Array(64).fill(0);
      for (let i = 0; i < 16; i++) {
        w[i] = (bytes[chunkStart + i * 4] << 24) | (bytes[chunkStart + i * 4 + 1] << 16) | (bytes[chunkStart + i * 4 + 2] << 8) | (bytes[chunkStart + i * 4 + 3]);
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      H = [H[0]+a|0, H[1]+b|0, H[2]+c|0, H[3]+d|0, H[4]+e|0, H[5]+f|0, H[6]+g|0, H[7]+h|0];
    }
    return H.map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('');
  }

// Module 3 stock universe: the 21 real stocks from Module 4's client portfolio (so Module 3's stock
// analysis and Module 4's portfolio views describe the same companies) plus 14 illustrative extra
// stocks across sectors/caps so screener/discovery buckets have enough breadth to be meaningful.
//
// No licensed market-data feed is wired into this prototype (see Data-Source Mapping in the spec —
// exchange price/quote/delivery data requires a redistribution licence). Every OHLCV series,
// financial-statement line item, pledge/RPT flag, promoter/FII/DII holding and estimate below is
// generated deterministically from each stock's ISIN via a seeded PRNG: same ISIN always produces
// the same numbers, so results are reproducible across runs, not random each time. Replace this
// file with a live vendor feed (Accord/ACE/Capitaline/etc., per the spec's licensing table) before
// production use.

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return Math.abs(h) || 1;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngNormal(rng) {
  const u1 = Math.max(rng(), 1e-9), u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const TODAY = new Date('2026-07-08');

// The 21 real stocks (ISIN, symbol, name, sector, cap bucket, ATP, qty) mirrored from Module 4's
// realPortfolioData.js so the two modules describe the same holdings.
const REAL_STOCKS = [
  { isin: 'INE009A01021', id: 'INFY', name: 'Infosys Ltd', sector: 'Information Technology', macap: 'Mid', atp: 1520.2 },
  { isin: 'INE010B01027', id: 'ZYDUSLIFE', name: 'Zydus Life Sciences Ltd', sector: 'Healthcare', macap: 'Mid', atp: 905 },
  { isin: 'INE019A01038', id: 'JSWSTEEL', name: 'JSW Steel Ltd', sector: 'Metals & Mining', macap: 'Mid', atp: 1239.8 },
  { isin: 'INE020B01018', id: 'RECLTD', name: 'Rural Electrification Corporation Ltd', sector: 'Financial Services', macap: 'Mid', atp: 382.1 },
  { isin: 'INE021A01026', id: 'ASIANPAINT', name: 'Asian Paints Ltd', sector: 'Consumer Durables', macap: 'Mid', atp: 2432.1 },
  { isin: 'INE030A01027', id: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', sector: 'Fast Moving Consumer Goods', macap: 'Mid', atp: 2354.4 },
  { isin: 'INE038A01020', id: 'HINDALCO', name: 'Hindalco Industries Ltd', sector: 'Metals & Mining', macap: 'Mid', atp: 935.45 },
  { isin: 'INE040A01034', id: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Financial Services', macap: 'Mid', atp: 949.7 },
  { isin: 'INE044A01036', id: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd', sector: 'Healthcare', macap: 'Mid', atp: 1702.6 },
  { isin: 'INE066A01021', id: 'EICHERMOT', name: 'Eicher Motors Ltd', sector: 'Automobile and Auto Components', macap: 'Mid', atp: 7209.5 },
  { isin: 'INE075A01022', id: 'WIPRO', name: 'Wipro Ltd', sector: 'Information Technology', macap: 'Mid', atp: 233.39 },
  { isin: 'INE154A01025', id: 'ITC', name: 'ITC Ltd', sector: 'Fast Moving Consumer Goods', macap: 'Mid', atp: 310.2 },
  { isin: 'INE158A01026', id: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd', sector: 'Automobile and Auto Components', macap: 'Mid', atp: 5766 },
  { isin: 'INE235A01022', id: 'FINCABLES', name: 'Finolex Cables Ltd', sector: 'Capital Goods', macap: 'Small', atp: 745.5 },
  { isin: 'INE481G01011', id: 'ULTRACEMCO', name: 'UltraTech Cement Ltd', sector: 'Construction Materials', macap: 'Mid', atp: 12773 },
  { isin: 'INE585B01010', id: 'MARUTI', name: 'Maruti Suzuki India Ltd', sector: 'Automobile and Auto Components', macap: 'Mid', atp: 15059 },
  { isin: 'INE732A01036', id: 'KIRLOSBROS', name: 'Kirloskar Brothers Ltd', sector: 'Capital Goods', macap: 'Small', atp: 1545.2 },
  { isin: 'INE742F01042', id: 'ADANIPORTS', name: 'Adani Ports & SEZ Ltd', sector: 'Services', macap: 'Mid', atp: 1570.2 },
  { isin: 'INE787D01026', id: 'BALKRISIND', name: 'Balkrishna Industries Ltd', sector: 'Automobile and Auto Components', macap: 'Small', atp: 2687.8 },
  { isin: 'INE795G01014', id: 'HDFCLIFE', name: 'HDFC Life Insurance Company Ltd', sector: 'Financial Services', macap: 'Mid', atp: 720.7 },
  { isin: 'INE917I01010', id: 'BAJAJ-AUTO', name: 'Bajaj Auto Ltd', sector: 'Automobile and Auto Components', macap: 'Mid', atp: 9647 },
];

// Illustrative extra stocks so screener/discovery buckets aren't thin with only 21 names.
const EXTRA_STOCKS = [
  { isin: 'XIL0000TCS1', id: 'TCS', name: 'Tata Consultancy Services Ltd', sector: 'Information Technology', macap: 'Large', atp: 3850 },
  { isin: 'XIL0000RELI', id: 'RELIANCE', name: 'Reliance Industries Ltd', sector: 'Oil Gas & Consumable Fuels', macap: 'Large', atp: 2950 },
  { isin: 'XIL0000ICIC', id: 'ICICIBANK', name: 'ICICI Bank Ltd', sector: 'Financial Services', macap: 'Large', atp: 1180 },
  { isin: 'XIL0000LTIM', id: 'LT', name: 'Larsen & Toubro Ltd', sector: 'Capital Goods', macap: 'Large', atp: 3550 },
  { isin: 'XIL0000BHAR', id: 'BHARTIARTL', name: 'Bharti Airtel Ltd', sector: 'Telecommunication', macap: 'Large', atp: 1520 },
  { isin: 'XIL0000NTPC', id: 'NTPC', name: 'NTPC Ltd', sector: 'Power', macap: 'Large', atp: 385 },
  { isin: 'XIL0000ONGC', id: 'ONGC', name: 'Oil & Natural Gas Corporation Ltd', sector: 'Oil Gas & Consumable Fuels', macap: 'Large', atp: 265 },
  { isin: 'XIL0000COAL', id: 'COALINDIA', name: 'Coal India Ltd', sector: 'Metals & Mining', macap: 'Large', atp: 445 },
  { isin: 'XIL0000IEXX', id: 'IEX', name: 'Indian Energy Exchange Ltd', sector: 'Capital Goods', macap: 'Small', atp: 172 },
  { isin: 'XIL0000CDSL', id: 'CDSL', name: 'Central Depository Services Ltd', sector: 'Financial Services', macap: 'Small', atp: 1620 },
  { isin: 'XIL0000IRCT', id: 'IRCTC', name: 'Indian Railway Catering & Tourism Corp Ltd', sector: 'Services', macap: 'Mid', atp: 890 },
  { isin: 'XIL0000DIXO', id: 'DIXON', name: 'Dixon Technologies (India) Ltd', sector: 'Consumer Durables', macap: 'Mid', atp: 14800 },
  { isin: 'XIL0000PAYT', id: 'PAYTM', name: 'One 97 Communications Ltd', sector: 'Financial Services', macap: 'Mid', atp: 890 },
  { isin: 'XIL0000YESB', id: 'YESBANK', name: 'Yes Bank Ltd', sector: 'Financial Services', macap: 'Mid', atp: 21.5 },
];

const CYCLICALITY = {
  'Information Technology': 'Late-Cycle', 'Healthcare': 'Defensive', 'Metals & Mining': 'Early-Cycle',
  'Financial Services': 'Early-Cycle', 'Consumer Durables': 'Mid-Cycle', 'Fast Moving Consumer Goods': 'Defensive',
  'Automobile and Auto Components': 'Early-Cycle', 'Capital Goods': 'Early-Cycle', 'Construction Materials': 'Early-Cycle',
  'Services': 'Mid-Cycle', 'Oil Gas & Consumable Fuels': 'Mid-Cycle', 'Telecommunication': 'Defensive', 'Power': 'Defensive',
};

function capProfile(macap) {
  if (macap === 'Large') return { vol: 0.17, drift: 0.12, revenueBase: 60000 };
  if (macap === 'Mid') return { vol: 0.23, drift: 0.14, revenueBase: 8000 };
  return { vol: 0.30, drift: 0.16, revenueBase: 1200 };
}

function buildOHLCV(isin, currentPrice, macap, days) {
  const rng = mulberry32(hashSeed(isin + 'ohlcv'));
  const { vol, drift } = capProfile(macap);
  const dt = 1 / 252;
  // Simulate forward from a starting price ~drift/vol-consistent with currentPrice at the end, then
  // rescale the whole path so it lands exactly on currentPrice (keeps returns realistic while
  // guaranteeing internal consistency with the price used elsewhere in the app).
  const prices = [currentPrice * 0.72];
  for (let i = 1; i < days; i++) {
    const z = rngNormal(rng);
    const prev = prices[i - 1];
    const next = prev * Math.exp((drift - 0.5 * vol * vol) * dt + vol * Math.sqrt(dt) * z);
    prices.push(Math.max(0.5, next));
  }
  const scale = currentPrice / prices[prices.length - 1];
  const bars = [];
  let date = new Date(TODAY.getTime() - (days - 1) * 86400000);
  for (let i = 0; i < days; i++) {
    const close = prices[i] * scale;
    const prevClose = i === 0 ? close : prices[i - 1] * scale;
    const high = Math.max(close, prevClose) * (1 + rng() * 0.012);
    const low = Math.min(close, prevClose) * (1 - rng() * 0.012);
    const open = low + rng() * (high - low);
    const volume = Math.round(100000 + rng() * 900000 * (macap === 'Large' ? 3 : macap === 'Mid' ? 1.3 : 0.5));
    const deliveryPct = Math.round((35 + rng() * 45) * 10) / 10;
    bars.push({ date: date.toISOString().slice(0, 10), open: round2(open), high: round2(high), low: round2(low), close: round2(close), volume, deliveryPct });
    date = new Date(date.getTime() + 86400000);
  }
  return bars;
}
function round2(n) { return Math.round(n * 100) / 100; }

function buildFinancials(isin, macap) {
  const rng = mulberry32(hashSeed(isin + 'financials'));
  const { revenueBase } = capProfile(macap);
  const years = ['FY24', 'FY25', 'FY26(TTM)'];
  let revenue = revenueBase * (0.8 + rng() * 0.4);
  const rows = { revenue: [], cogs: [], sga: [], depreciation: [], ebit: [], interest: [], pretaxIncome: [], tax: [], netIncome: [], totalAssets: [], currentAssets: [], receivables: [], ppeGross: [], currentLiabilities: [], totalDebt: [], equity: [], cfo: [] };
  let assets = revenue * (1.1 + rng() * 0.3);
  for (let y = 0; y < 3; y++) {
    const growth = -0.03 + rng() * 0.26;
    if (y > 0) revenue *= 1 + growth;
    const cogsRatio = 0.55 + rng() * 0.15;
    const sgaRatio = 0.10 + rng() * 0.08;
    const cogs = revenue * cogsRatio;
    const sga = revenue * sgaRatio;
    const depreciation = assets * (0.04 + rng() * 0.02);
    const ebit = revenue - cogs - sga - depreciation;
    const debtRatio = 0.15 + rng() * 0.25;
    const totalDebt = assets * debtRatio;
    const interest = totalDebt * (0.07 + rng() * 0.02);
    const pretaxIncome = ebit - interest;
    const taxRate = 0.24 + rng() * 0.06;
    const tax = Math.max(0, pretaxIncome * taxRate);
    const netIncome = pretaxIncome - tax;
    assets = assets * (1 + growth * 0.6) * (1 + (rng() - 0.4) * 0.03);
    const currentAssets = assets * (0.30 + rng() * 0.15);
    const receivables = revenue * (0.08 + rng() * 0.08);
    const ppeGross = assets * (0.35 + rng() * 0.15);
    const currentLiabilities = assets * (0.18 + rng() * 0.1);
    const equity = assets - totalDebt - currentLiabilities * 0.4;
    const accrualNoise = (rng() - 0.5) * netIncome * 0.15;
    const cfo = netIncome - accrualNoise + depreciation * 0.3;
    rows.revenue.push(revenue); rows.cogs.push(cogs); rows.sga.push(sga); rows.depreciation.push(depreciation);
    rows.ebit.push(ebit); rows.interest.push(interest); rows.pretaxIncome.push(pretaxIncome); rows.tax.push(tax);
    rows.netIncome.push(netIncome); rows.totalAssets.push(assets); rows.currentAssets.push(currentAssets);
    rows.receivables.push(receivables); rows.ppeGross.push(ppeGross); rows.currentLiabilities.push(currentLiabilities);
    rows.totalDebt.push(totalDebt); rows.equity.push(equity); rows.cfo.push(cfo);
  }
  return { years, ...rows };
}

function buildGovernance(isin) {
  const rng = mulberry32(hashSeed(isin + 'governance'));
  return {
    promoterHolding: round2(35 + rng() * 35),
    promoterPledgePct: round2(rng() < 0.25 ? rng() * 18 : 0),
    fiiHolding: round2(5 + rng() * 25),
    diiHolding: round2(5 + rng() * 20),
    rptFlag: rng() < 0.2,
    boardIndependencePct: round2(40 + rng() * 40),
  };
}

function buildEstimates(isin, currentPrice) {
  const rng = mulberry32(hashSeed(isin + 'estimates'));
  const upside = -0.1 + rng() * 0.45;
  return {
    consensusTarget: round2(currentPrice * (1 + upside)),
    analystCount: Math.round(4 + rng() * 22),
    epsEstimateGrowth: round2((5 + rng() * 20) * 10) / 10,
  };
}

function buildStock(raw) {
  const priceRng = mulberry32(hashSeed(raw.isin));
  const movement = -0.30 + priceRng() * 0.70;
  const currentPrice = round2(Math.max(1, raw.atp * (1 + movement)));
  const financials = buildFinancials(raw.isin, raw.macap);
  return {
    id: raw.id, isin: raw.isin, name: raw.name, sector: raw.sector, macap: raw.macap,
    cyclicality: CYCLICALITY[raw.sector] || 'Mid-Cycle',
    currentPrice, ohlcv: buildOHLCV(raw.isin, currentPrice, raw.macap, 260),
    financials, governance: buildGovernance(raw.isin), estimates: buildEstimates(raw.isin, currentPrice),
  };
}

const STOCK_UNIVERSE = REAL_STOCKS.concat(EXTRA_STOCKS).map(buildStock);

// Synthetic benchmark index ("WIS 50") built as a cap-weighted basket of the universe, used for
// index-attribution and breadth calculations in Act 1.
const INDEX_WEIGHTS = (() => {
  const capWeight = (m) => (m === 'Large' ? 4 : m === 'Mid' ? 1.5 : 0.6);
  const raw = STOCK_UNIVERSE.map((s) => ({ id: s.id, w: capWeight(s.macap) }));
  const total = raw.reduce((a, r) => a + r.w, 0);
  const weights = {};
  raw.forEach((r) => { weights[r.id] = r.w / total; });
  return weights;
})();



// M3-UC1 — Market Intelligence (Act 1). Presentational/aggregation layer: breadth, volatility
// regime, index attribution, sector rotation, delivery/liquidity, earnings hub. No independent
// buy/sell calls are issued here (FR-MI constraint).

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
    return { id: s.id, name: s.name, weight: round2(weight * 100), return: round2(ret * 100), contributionBps: round2(weight * ret * 10000) };
  });
  const indexMove = contributions.reduce((a, c) => a + c.contributionBps, 0) / 100;
  const sorted = [...contributions].sort((a, b) => b.contributionBps - a.contributionBps);
  return { indexMovePct: round2(indexMove), topUp: sorted.slice(0, 5), topDown: sorted.slice(-5).reverse(), all: contributions };
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



// M3-UC2 — Six-Pillar Stock Analysis (Act 2). Composes Fundamental, Technical, Sentiment, Macro,
// Governance and Valuation pillars for one stock and normalises each to a 0-100 sub-score for
// downstream synthesis (M3-UC5). Fundamental valuation/forensic content is meant to be *sourced*
// from Module 1 in production; since Module 1 isn't built in this prototype, forensic scores are
// computed here directly from the synthetic financials using the spec's own formulas (labelled as
// such in the coachmark tour) rather than left blank.

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
function sma(arr, w, end) { let s = 0; for (let i = end - w + 1; i <= end; i++) s += arr[i]; return s / w; }
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
  const ma50 = sma(closes, 50, n), ma200 = sma(closes, 200, n);
  const rsi14 = computeRSI(closes, 14);
  const macd = computeMACD(closes);
  const bb = computeBollinger(closes);
  const goldenCross = ma50 > ma200;
  const obv = stock.ohlcv.reduce((acc, b, i) => i === 0 ? b.volume : acc + (b.close > stock.ohlcv[i - 1].close ? b.volume : -b.volume), 0);
  const patterns = [];
  if (goldenCross && closes[n - 20] < sma(closes, 50, n - 20)) patterns.push('Golden Cross (50/200 EMA)');
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



// M3-UC3 — Risk & Quantitative Analytics (Act 3). Monte Carlo price paths, bull/bear adversarial
// engine, red-team/devil's-advocate stress checks, strategy backtests, Sharpe/Sortino, an inference
// map and an exportable compliance audit trail. The adversarial/red-team components are governed,
// reproducible rule-based scoring over the six pillars (FR-RQ-02/03/04 require this, not free-form
// text) rather than an actual LLM call.

function dailyReturns(ohlcv) {
  const rets = [];
  for (let i = 1; i < ohlcv.length; i++) rets.push((ohlcv[i].close - ohlcv[i - 1].close) / ohlcv[i - 1].close);
  return rets;
}
function meanStdev(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, r) => a + (r - mean) ** 2, 0) / arr.length;
  return { mean, stdev: Math.sqrt(variance) };
}

function runM3MonteCarlo(stock, opts) {
  const paths = opts.pathCount || 2000;
  const horizonDays = opts.horizonDays || 126;
  const { mean, stdev } = meanStdev(dailyReturns(stock.ohlcv));
  const mu = mean * 252, sigma = stdev * Math.sqrt(252);
  const dt = 1 / 252;
  const rng = mulberry32(hashSeed(stock.isin + 'montecarlo' + paths + horizonDays));
  const finalPrices = [];
  for (let p = 0; p < paths; p++) {
    let s = stock.currentPrice;
    for (let d = 0; d < horizonDays; d++) {
      const u1 = Math.max(rng(), 1e-9), u2 = rng();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      s *= Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z);
    }
    finalPrices.push(s);
  }
  finalPrices.sort((a, b) => a - b);
  const pct = (p) => finalPrices[Math.min(finalPrices.length - 1, Math.floor(p * finalPrices.length))];
  const target = opts.targetPrice || stock.currentPrice * 1.15;
  const probHitTarget = finalPrices.filter((p) => p >= target).length / finalPrices.length;
  return {
    pathCount: paths, horizonDays, annualDrift: round2(mu * 100), annualVol: round2(sigma * 100),
    ci: { p5: round2(pct(0.05)), p25: round2(pct(0.25)), p50: round2(pct(0.5)), p75: round2(pct(0.75)), p95: round2(pct(0.95)) },
    targetPrice: round2(target), probHitTarget: round2(probHitTarget * 100),
  };
}

function computeRiskRatios(stock, riskFreeRate) {
  const rets = dailyReturns(stock.ohlcv);
  const { mean, stdev } = meanStdev(rets);
  const annualReturn = mean * 252, annualVol = stdev * Math.sqrt(252);
  const downside = rets.filter((r) => r < 0);
  const downsideDev = Math.sqrt(downside.reduce((a, r) => a + r * r, 0) / (downside.length || 1)) * Math.sqrt(252);
  const sharpe = (annualReturn - riskFreeRate) / annualVol;
  const sortino = (annualReturn - riskFreeRate) / (downsideDev || 0.0001);
  return { annualReturnPct: round2(annualReturn * 100), annualVolPct: round2(annualVol * 100), sharpe: round2(sharpe), sortino: round2(sortino) };
}

function runAdversarialEngine(pillarScores, stock) {
  const bullPoints = [];
  const bearPoints = [];
  if (pillarScores.fundamental > 60) bullPoints.push({ point: 'DuPont ROE and forensic scores support fundamental quality', weight: round2((pillarScores.fundamental - 50) / 10) });
  else bearPoints.push({ point: 'Fundamental sub-score below governed threshold', weight: round2((50 - pillarScores.fundamental) / 10) });
  if (pillarScores.technical > 55) bullPoints.push({ point: 'Technical trend (MA/MACD) constructive', weight: round2((pillarScores.technical - 50) / 10) });
  else bearPoints.push({ point: 'Technical trend not confirming', weight: round2((50 - pillarScores.technical) / 10) });
  if (pillarScores.sentiment > 55) bullPoints.push({ point: 'News/social sentiment (CSS) net positive', weight: round2((pillarScores.sentiment - 50) / 10) });
  else bearPoints.push({ point: 'Sentiment channels net negative or neutral', weight: round2((50 - pillarScores.sentiment) / 10) });
  if (pillarScores.valuation > 55) bullPoints.push({ point: 'Trading below sector-median valuation', weight: round2((pillarScores.valuation - 50) / 10) });
  else bearPoints.push({ point: 'Valuation at or above sector median', weight: round2((50 - pillarScores.valuation) / 10) });
  if (pillarScores.governance < 45) bearPoints.push({ point: 'Governance flags present (pledge/RPT)', weight: round2((50 - pillarScores.governance) / 10) });
  const bullScore = bullPoints.reduce((a, b) => a + b.weight, 0);
  const bearScore = bearPoints.reduce((a, b) => a + b.weight, 0);
  const netStance = bullScore > bearScore ? 'Bull case dominant' : bearScore > bullScore ? 'Bear case dominant' : 'Balanced — no dominant case';
  return {
    bullCase: { points: bullPoints, score: round2(bullScore) },
    bearCase: { points: bearPoints, score: round2(bearScore) },
    netStance,
    convergenceProof: `Bull score ${round2(bullScore)} vs Bear score ${round2(bearScore)} computed deterministically from the six pillar sub-scores (fundamental/technical/sentiment/valuation/governance) — reproducible from the same pillar inputs, not free-form generation.`,
  };
}

const STRESS_SCENARIOS = [
  { name: 'Asset-quality deterioration', category: 'Red Team', probability: 0.08, shockToScore: -18 },
  { name: 'Regulatory crackdown on sector', category: 'Red Team', probability: 0.05, shockToScore: -22 },
  { name: 'Data-integrity / restatement risk', category: 'Red Team', probability: 0.03, shockToScore: -30 },
  { name: 'Black-swan macro shock (sector-wide)', category: "Devil's Advocate", probability: 0.02, shockToScore: -35 },
  { name: 'Key-management exit', category: "Devil's Advocate", probability: 0.04, shockToScore: -15 },
];
function runStressTests(stock, convictionBase) {
  return STRESS_SCENARIOS.map((s) => {
    const stressedScore = Math.max(0, convictionBase + s.shockToScore);
    const tailImpact = round2(s.probability * Math.abs(s.shockToScore));
    return { ...s, stressedConviction: round2(stressedScore), tailImpactWeighted: tailImpact };
  });
}

function runBacktests(stock) {
  const rng = mulberry32(hashSeed(stock.isin + 'backtest'));
  const STRATEGIES = [
    'MA Crossover + RSI Confirm', 'MACD + Volume Breakout', 'Bollinger Squeeze + RSI', 'EMA200 Filter + MACD',
    'RSI Divergence + Support', 'Golden Cross + OBV', 'BB Band-Touch + Fibonacci', 'MACD Divergence + Volume',
    'Death Cross Avoidance + RSI', 'KST Multi-Oscillator', 'Dow Theory Trend + MA', 'Delivery-Volume Confirmation',
  ];
  const closes = stock.ohlcv.map((b) => b.close);
  return STRATEGIES.map((name) => {
    const winRate = round2(72 + rng() * 18);
    const avgReturnPct = round2(0.8 + rng() * 3.5);
    // Max drawdown computed once from the real price series (shared across strategies here, since
    // this prototype doesn't implement each strategy's distinct trade-entry logic).
    let peak = closes[0], maxDD = 0;
    closes.forEach((c) => { peak = Math.max(peak, c); maxDD = Math.min(maxDD, (c - peak) / peak); });
    return { name, winRatePct: winRate, avgReturnPct, maxDrawdownPct: round2(maxDD * 100) };
  });
}

function buildInferenceMap(pillarScores, adversarial) {
  const nodes = [
    { id: 'fundamental', label: 'Fundamental', value: pillarScores.fundamental },
    { id: 'technical', label: 'Technical', value: pillarScores.technical },
    { id: 'sentiment', label: 'Sentiment', value: pillarScores.sentiment },
    { id: 'macro', label: 'Macro', value: pillarScores.macro },
    { id: 'governance', label: 'Governance', value: pillarScores.governance },
    { id: 'valuation', label: 'Valuation', value: pillarScores.valuation },
    { id: 'adversarial', label: 'Adversarial Net Stance', value: round2(adversarial.bullCase.score - adversarial.bearCase.score) },
    { id: 'conviction', label: 'Conviction Score', value: null },
  ];
  const edges = ['fundamental', 'technical', 'sentiment', 'macro', 'governance', 'valuation', 'adversarial'].map((id) => ({ from: id, to: 'conviction' }));
  return { nodes, edges };
}

function runRiskQuantAnalytics(payload) {
  const stockId = (payload && payload.stockId) || 'INFY';
  const pathCount = (payload && payload.pathCount) || 2000;
  const horizonDays = (payload && payload.horizonDays) || 126;
  const riskFreeRate = (payload && payload.riskFreeRate) || 0.068;
  const stock = findStock(stockId);
  const pillars = runSixPillarAnalysis({ stockId });
  const convictionBase = Object.values(pillars.pillarScores).reduce((a, b) => a + b, 0) / 6;
  const monteCarlo = runM3MonteCarlo(stock, { pathCount, horizonDays, targetPrice: payload && payload.targetPrice });
  const riskRatios = computeRiskRatios(stock, riskFreeRate);
  const adversarial = runAdversarialEngine(pillars.pillarScores, stock);
  const stressTests = runStressTests(stock, convictionBase);
  const backtests = runBacktests(stock);
  const inferenceMap = buildInferenceMap(pillars.pillarScores, adversarial);
  const auditTrail = {
    runAt: new Date().toISOString(), stockId, inputs: { pathCount, horizonDays, riskFreeRate }, pillarScoresUsed: pillars.pillarScores,
    modelVersions: { monteCarlo: 'GBM v1', adversarial: 'rule-based v1', backtest: 'strategy-stats v1' },
  };
  return { stock: pillars.stock, monteCarlo, riskRatios, adversarial, stressTests, backtests, inferenceMap, auditTrail, convictionBase: round2(convictionBase) };
}



// M3-UC4 — Stock Setup & Discovery (Act 4). Retrieval/ranking service: combination scans,
// institutional intent, event-risk tagging, rotation ideas, investor/business-house portfolios, IPO
// analysis, themes and filings aggregation. Discovery ranks/surfaces; ratings only ever come from
// M3-UC5 (FR-SD constraint) — nothing here issues a Buy/Sell call.

function runCombinationScans(criteria) {
  const c = criteria || {};
  const results = STOCK_UNIVERSE.filter((s) => {
    const n = s.financials.revenue.length - 1;
    const roe = (s.financials.netIncome[n] / s.financials.equity[n]) * 100;
    const revGrowth = ((s.financials.revenue[n] / s.financials.revenue[0]) - 1) * 100;
    const closes = s.ohlcv.map((b) => b.close);
    const ret1m = ((closes[closes.length - 1] / closes[closes.length - 21]) - 1) * 100;
    let pass = true;
    if (c.minRoe != null) pass = pass && roe >= c.minRoe;
    if (c.macap) pass = pass && s.macap === c.macap;
    if (c.sector) pass = pass && s.sector === c.sector;
    if (c.minMomentum != null) pass = pass && ret1m >= c.minMomentum;
    return pass;
  }).map((s) => {
    const n = s.financials.revenue.length - 1;
    return { id: s.id, name: s.name, sector: s.sector, macap: s.macap, roe: round2((s.financials.netIncome[n] / s.financials.equity[n]) * 100), currentPrice: s.currentPrice };
  }).sort((a, b) => b.roe - a.roe);
  return { criteria: c, matchCount: results.length, results };
}

function computeInstitutionalIntent() {
  return STOCK_UNIVERSE.map((s) => {
    const rng = mulberry32(hashSeed(s.isin + 'institutional'));
    const bulkDeals = Math.round(rng() * 4);
    const promoterFlow = round2((rng() - 0.5) * 2);
    const fiiFlow = round2((rng() - 0.4) * 3);
    const diiFlow = round2((rng() - 0.5) * 2.5);
    const intentScore = round2(promoterFlow * 0.4 + fiiFlow * 0.35 + diiFlow * 0.25);
    return { id: s.id, name: s.name, bulkBlockDealsLast30d: bulkDeals, promoterNetFlow: promoterFlow, fiiNetFlow: fiiFlow, diiNetFlow: diiFlow, institutionalIntentScore: intentScore };
  }).sort((a, b) => b.institutionalIntentScore - a.institutionalIntentScore);
}

function computeEventRisk() {
  const today = new Date('2026-07-08');
  return STOCK_UNIVERSE.map((s) => {
    const rng = mulberry32(hashSeed(s.isin + 'events'));
    const daysAhead = Math.round(rng() * 45);
    const eventTypes = ['Quarterly Results', 'Board Meeting (Dividend/Buyback)', 'AGM', 'Regulatory Filing Deadline'];
    const eventType = eventTypes[Math.floor(rng() * eventTypes.length)];
    const riskLevel = rng() < 0.15 ? 'High' : rng() < 0.5 ? 'Medium' : 'Low';
    const date = new Date(today.getTime() + daysAhead * 86400000).toISOString().slice(0, 10);
    return { id: s.id, name: s.name, eventType, date, riskLevel };
  }).sort((a, b) => (a.date < b.date ? -1 : 1));
}

function computeRotationRecommendations(sectorRotation) {
  if (!sectorRotation) return [];
  const topSectors = [...sectorRotation].sort((a, b) => b.momentumZ - a.momentumZ).slice(0, 3).map((r) => r.sector);
  return STOCK_UNIVERSE.filter((s) => topSectors.includes(s.sector)).map((s) => ({ id: s.id, name: s.name, sector: s.sector, rationale: `Sector momentum z-score ranks in top 3 (${s.cyclicality})` }));
}

const INVESTOR_NAMES = ['Ashish Kacholia', 'Radhakishan Damani (Promoter Book)', 'Vijay Kedia', 'Mukul Agrawal', 'Sunil Singhania — Abakkus'];
function computeInvestorPortfolios() {
  return INVESTOR_NAMES.map((name) => {
    const rng = mulberry32(hashSeed(name));
    const holdings = STOCK_UNIVERSE.filter(() => rng() < 0.22).slice(0, 6).map((s) => ({ id: s.id, name: s.name, holdingPct: round2(0.5 + rng() * 4) }));
    return { investor: name, asOfQuarter: 'Q1 FY26 (filings-based, quarterly lag)', holdings };
  });
}

const THEMES = [
  { name: 'PLI — Production Linked Incentive', sectors: ['Consumer Durables', 'Capital Goods', 'Automobile and Auto Components'] },
  { name: 'China+1 Manufacturing Shift', sectors: ['Capital Goods', 'Metals & Mining', 'Consumer Durables'] },
  { name: 'EV & Clean Mobility', sectors: ['Automobile and Auto Components', 'Power'] },
  { name: 'Digital India / Financial Inclusion', sectors: ['Information Technology', 'Financial Services'] },
];
function computeThemes() {
  return THEMES.map((t) => ({ ...t, constituents: STOCK_UNIVERSE.filter((s) => t.sectors.includes(s.sector)).map((s) => ({ id: s.id, name: s.name })) }));
}

function computeIPOAnalysis() {
  const IPOS = [
    { name: 'Vertex Semiconductors Ltd', sector: 'Information Technology' }, { name: 'Solaris Green Energy Ltd', sector: 'Power' },
    { name: 'Nimbus Logistics Ltd', sector: 'Services' },
  ];
  return IPOS.map((ipo) => {
    const rng = mulberry32(hashSeed(ipo.name));
    const gmpPct = round2((rng() - 0.3) * 60);
    const subscriptionX = round2(1 + rng() * 40);
    const fundamentalsScore = round2(40 + rng() * 40);
    return { ...ipo, gmpPct, subscriptionX, fundamentalsScore, postListingConviction: round2(fundamentalsScore * 0.6 + Math.min(20, subscriptionX) * 0.8), gmpDisclaimer: 'GMP is grey-market and speculative — not investment advice.' };
  });
}

function computeBusinessHouses() {
  const groups = { 'Tata Group': ['TCS'], 'Adani Group': ['ADANIPORTS'], 'Bajaj Group': ['BAJAJ-AUTO'] };
  return Object.keys(groups).map((group) => ({ group, constituents: STOCK_UNIVERSE.filter((s) => groups[group].includes(s.id)).map((s) => ({ id: s.id, name: s.name, sector: s.sector })) }));
}

function computeFilingsIndex() {
  const types = ['Annual Report', 'Quarterly Results', 'Shareholding Pattern', 'Board Resolution', 'Corporate Announcement'];
  const filings = [];
  STOCK_UNIVERSE.slice(0, 15).forEach((s) => {
    const rng = mulberry32(hashSeed(s.isin + 'filings'));
    const count = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(rng() * types.length)];
      const daysAgo = Math.round(rng() * 90);
      filings.push({ id: s.id, name: s.name, type, date: new Date(new Date('2026-07-08').getTime() - daysAgo * 86400000).toISOString().slice(0, 10) });
    }
  });
  return { filings: filings.sort((a, b) => (a.date < b.date ? 1 : -1)), searchableFields: ['id', 'name', 'type', 'date'] };
}

function runDiscovery(payload) {
  const p = payload || {};
  const marketIntel = p.sectorRotation;
  return {
    scanResults: runCombinationScans(p.scanCriteria),
    institutionalIntent: computeInstitutionalIntent(),
    eventRisk: computeEventRisk(),
    rotationRecommendations: computeRotationRecommendations(marketIntel),
    investorPortfolios: computeInvestorPortfolios(),
    ipoAnalysis: computeIPOAnalysis(),
    themes: computeThemes(),
    businessHouses: computeBusinessHouses(),
    filingsIndex: computeFilingsIndex(),
  };
}



// M3-UC5 — Synthesis & Conviction Score (Act 5). Deterministic weighted composition over the six
// pillar sub-scores into a 0-100 Conviction Score + rating, an append-only tamper-evident ledger
// (SHA-256 hash chain per FR-CS/SEBI RA Reg 16(2)), recommendation-vs-OHLC tracking, a non-published
// scenario sandbox, and auto-attached SEBI RA disclosures. The score aggregates upstream signals; it
// never originates new valuations (Act 5 constraint).

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
  return sha256Hex(JSON.stringify(entry) + '|' + prevHash);
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



// M3-UC6 — Screening & Discovery. Query-compilation and ranking service: a typed field schema with
// AND/OR filter compilation, pre-built buckets, a small NL->filter translator (echoed back per the
// FR-SC-03 validation requirement, not silently applied), chart-pattern enrichment and conviction
// links, investor/theme/IPO views (reused from Act 4) and curated investment ideas.

const FIELD_SCHEMA = [
  { field: 'roe', label: 'ROE (%)', type: 'number', category: 'fundamental' },
  { field: 'revenueGrowthPct', label: 'Revenue Growth (%)', type: 'number', category: 'fundamental' },
  { field: 'peRatio', label: 'P/E', type: 'number', category: 'valuation' },
  { field: 'macap', label: 'Market Cap Bucket', type: 'enum', category: 'reference', options: ['Large', 'Mid', 'Small'] },
  { field: 'sector', label: 'Sector', type: 'enum', category: 'reference' },
  { field: 'momentum1mPct', label: '1M Momentum (%)', type: 'number', category: 'technical' },
  { field: 'rsi14', label: 'RSI (14)', type: 'number', category: 'technical' },
];

function buildFieldRow(stock) {
  const n = stock.financials.revenue.length - 1;
  const closes = stock.ohlcv.map((b) => b.close);
  const roe = round2((stock.financials.netIncome[n] / stock.financials.equity[n]) * 100);
  const revenueGrowthPct = round2(((stock.financials.revenue[n] / stock.financials.revenue[0]) - 1) * 100);
  const momentum1mPct = round2(((closes[closes.length - 1] / closes[closes.length - 21]) - 1) * 100);
  let gains = 0, losses = 0;
  for (let i = closes.length - 14; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) gains += d; else losses -= d; }
  const rsi14 = round2(100 - 100 / (1 + (losses === 0 ? 100 : gains / 14 / (losses / 14))));
  return { id: stock.id, name: stock.name, sector: stock.sector, macap: stock.macap, currentPrice: stock.currentPrice, roe, revenueGrowthPct, momentum1mPct, rsi14 };
}

const PREBUILT_BUCKETS = {
  'Quality Compounders': (r) => r.roe > 15 && r.revenueGrowthPct > 8,
  'Deep Value': (r) => r.roe > 8 && r.momentum1mPct < 0,
  'Multibagger Early': (r) => r.macap !== 'Large' && r.revenueGrowthPct > 15,
  'Momentum Leaders': (r) => r.momentum1mPct > 5 && r.rsi14 < 75,
};

function compileFilterExpression(filters) {
  // filters: [{field, op, value}], AND-combined (OR groups are represented as nested arrays)
  return (row) => (filters || []).every((f) => {
    const v = row[f.field];
    if (f.op === '>=') return v >= f.value;
    if (f.op === '<=') return v <= f.value;
    if (f.op === '=') return v === f.value;
    if (f.op === '>') return v > f.value;
    if (f.op === '<') return v < f.value;
    return true;
  });
}

// Small keyword->filter parser (not real NLP) that translates a constrained natural-language
// pattern into the same (field, op, value) triples the manual filter builder uses, and echoes the
// compiled expression back so the caller can verify the translation before it's applied
// (FR-SC-03: NL translation must be validated/echoed back, never silently applied).
function parseNaturalLanguageQuery(text) {
  const filters = [];
  const t = (text || '').toLowerCase();
  const re = /(roe|pe|revenue growth|momentum|rsi)\s*(above|below|over|under)\s*(-?\d+(\.\d+)?)/g;
  let m;
  const fieldMap = { roe: 'roe', pe: 'peRatio', 'revenue growth': 'revenueGrowthPct', momentum: 'momentum1mPct', rsi: 'rsi14' };
  while ((m = re.exec(t))) {
    const field = fieldMap[m[1]];
    const op = (m[2] === 'above' || m[2] === 'over') ? '>=' : '<=';
    filters.push({ field, op, value: parseFloat(m[3]) });
  }
  if (t.includes('large cap')) filters.push({ field: 'macap', op: '=', value: 'Large' });
  if (t.includes('mid cap')) filters.push({ field: 'macap', op: '=', value: 'Mid' });
  if (t.includes('small cap')) filters.push({ field: 'macap', op: '=', value: 'Small' });
  return { originalText: text, compiledFilters: filters, confidence: filters.length ? round2(0.6 + Math.min(0.35, filters.length * 0.1)) : 0.2 };
}

function detectPatternsForRow(stock) {
  const pillars = runSixPillarAnalysis({ stockId: stock.id });
  return pillars.technicalPillar.patterns;
}

function runScreener(payload) {
  const p = payload || {};
  const rows = STOCK_UNIVERSE.map(buildFieldRow);
  let compiledQuery = null;
  let predicate = () => true;
  if (p.naturalLanguageQuery) {
    compiledQuery = parseNaturalLanguageQuery(p.naturalLanguageQuery);
    predicate = compileFilterExpression(compiledQuery.compiledFilters);
  } else if (p.filters) {
    compiledQuery = { compiledFilters: p.filters };
    predicate = compileFilterExpression(p.filters);
  } else if (p.bucket && PREBUILT_BUCKETS[p.bucket]) {
    predicate = PREBUILT_BUCKETS[p.bucket];
    compiledQuery = { bucket: p.bucket };
  }
  let screenResults = rows.filter(predicate);
  if (p.withConvictionAndPatterns) {
    screenResults = screenResults.map((r) => {
      const stock = STOCK_UNIVERSE.find((s) => s.id === r.id);
      const conviction = runConvictionSynthesis({ stockId: r.id });
      return { ...r, convictionScore: conviction.convictionScore, rating: conviction.rating, targetPrice: round2(r.currentPrice * (1 + (conviction.convictionScore - 50) / 200)), detectedPatterns: detectPatternsForRow(stock) };
    });
  }
  screenResults.sort((a, b) => b.roe - a.roe);
  const discovery = runDiscovery({});
  const investmentIdeas = [...screenResults].sort((a, b) => (b.convictionScore || b.roe) - (a.convictionScore || a.roe)).slice(0, 2).map((r) => ({ id: r.id, name: r.name, label: 'Stock of the Week', reason: `Ranked by ${p.withConvictionAndPatterns ? 'conviction score' : 'ROE'} among screened results` }));
  return {
    fieldSchema: FIELD_SCHEMA, buckets: Object.keys(PREBUILT_BUCKETS), compiledQuery, screenResults,
    detectedPatterns: p.withConvictionAndPatterns ? screenResults.map((r) => ({ id: r.id, patterns: r.detectedPatterns })) : [],
    savedScans: [], investorPortfolios: discovery.investorPortfolios, themes: discovery.themes, ipoAnalysis: discovery.ipoAnalysis, investmentIdeas,
  };
}



// M3-UC7 — Personalised Recommendation Layer. Re-ranks/contextualises Module 3 analytics against
// the client's actual portfolio (Module 4's REAL_HOLDINGS — same 21 stocks so the two modules stay
// consistent): holding-aware analysis, SwitchER replacements, surfaced portfolio alerts, model-
// portfolio gap analysis, and a compatibility-ranked screener. Module 2 doesn't exist in this
// prototype, so its alerts are illustrative and labelled as such (FR-PR-03 constraint: never
// re-generate or contradict Module 2 — this prototype cannot honour that without Module 2 existing).

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



// M3-UC8 — Platform & Administration (SDK). Cross-cutting platform substrate: token auth/RBAC
// resolution, per-user watchlists, a unified notification centre and global search — the services
// every act depends on. This prototype mocks the token/identity layer (no real OAuth2/JWT issuer
// wired in) but implements the actual RBAC entitlement resolution and search-ranking logic.

const RBAC_MATRIX = {
  'Retail Investor': { features: ['marketIntel', 'sixPillar', 'screener', 'watchlist', 'search'], dataScope: 'own-portfolio-only' },
  'Research Analyst': { features: ['marketIntel', 'sixPillar', 'riskQuant', 'discovery', 'conviction', 'screener', 'watchlist', 'search'], dataScope: 'full-universe' },
  'Relationship Manager': { features: ['marketIntel', 'sixPillar', 'riskQuant', 'discovery', 'conviction', 'screener', 'personalisation', 'watchlist', 'search'], dataScope: 'assigned-clients' },
  Admin: { features: ['*'], dataScope: 'all' },
};

function mockValidateToken(token) {
  // No real JWT issuer in this prototype — accepts a role name as a stand-in "token" and resolves
  // entitlements from the RBAC matrix, which is the part FR-PL-02/03 actually specify.
  const role = RBAC_MATRIX[token] ? token : 'Retail Investor';
  return { valid: true, role, expiresInSec: 3600 };
}
function resolveEntitlements(role) {
  return RBAC_MATRIX[role] || RBAC_MATRIX['Retail Investor'];
}

// In-memory per-process watchlist store (per user id) — a production build persists this in the
// WIS platform store.
const WATCHLISTS = {};
function getWatchlist(userId) { return WATCHLISTS[userId] || []; }
function addToWatchlist(userId, stockId, alertRule) {
  if (!WATCHLISTS[userId]) WATCHLISTS[userId] = [];
  if (!WATCHLISTS[userId].find((w) => w.stockId === stockId)) WATCHLISTS[userId].push({ stockId, alertRule: alertRule || null, addedAt: new Date().toISOString() });
  return WATCHLISTS[userId];
}
function removeFromWatchlist(userId, stockId) {
  WATCHLISTS[userId] = getWatchlist(userId).filter((w) => w.stockId !== stockId);
  return WATCHLISTS[userId];
}

function unifiedNotifications() {
  const discovery = runDiscovery({});
  const highRiskEvents = discovery.eventRisk.filter((e) => e.riskLevel === 'High').slice(0, 5).map((e) => ({ source: 'Platform', type: 'Event Risk', message: `${e.name}: ${e.eventType} on ${e.date}`, severity: 'High' }));
  const module2Style = [{ source: 'Module 2 (illustrative)', type: 'Portfolio Alert', message: 'Portfolio drift exceeds 5% band on 2 holdings — see Module 4 Dynamic Rebalancing', severity: 'Medium' }];
  return [...highRiskEvents, ...module2Style];
}

function globalSearch(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];
  const entityWeights = { instrument: 3, report: 2, theme: 1.5, idea: 1 };
  const instrumentMatches = STOCK_UNIVERSE.filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)).map((s) => ({ type: 'instrument', id: s.id, label: s.name, rank: entityWeights.instrument * (s.id.toLowerCase() === q ? 2 : 1) }));
  const themeMatches = ['PLI', 'China+1', 'EV', 'Digital India'].filter((t) => t.toLowerCase().includes(q)).map((t) => ({ type: 'theme', id: t, label: t, rank: entityWeights.theme }));
  return [...instrumentMatches, ...themeMatches].sort((a, b) => b.rank - a.rank).slice(0, 10);
}

function runPlatform(payload) {
  const p = payload || {};
  const auth = mockValidateToken(p.token);
  const entitlements = resolveEntitlements(auth.role);
  const userId = p.userId || 'demo-user';
  if (p.watchlistAction === 'add') addToWatchlist(userId, p.stockId, p.alertRule);
  if (p.watchlistAction === 'remove') removeFromWatchlist(userId, p.stockId);
  return {
    authResult: { ...auth, entitlements },
    endpointCatalogue: { version: 'v1', endpoints: ['/m3/uc1/market-intelligence', '/m3/uc2/six-pillar', '/m3/uc3/risk-quant', '/m3/uc4/discovery', '/m3/uc5/conviction', '/m3/uc6/screener', '/m3/uc7/personalisation', '/m3/uc8/platform'], paginationDefault: 25 },
    watchlist: getWatchlist(userId),
    notifications: unifiedNotifications(),
    searchResults: globalSearch(p.searchQuery),
  };
}



  
  // ============================== Module 3 samples + exports ==============================
  const M3_SAMPLES = {
    m3uc1: {},
    m3uc2: { stockId: 'INFY', universe: STOCK_UNIVERSE.map((s) => ({ id: s.id, name: s.name, sector: s.sector, macap: s.macap })) },
    m3uc3: { stockId: 'INFY', pathCount: 2000, horizonDays: 126, riskFreeRate: 0.068, universe: STOCK_UNIVERSE.map((s) => ({ id: s.id, name: s.name })) },
    m3uc4: { scanCriteria: { minRoe: 12 } },
    m3uc5: { stockId: 'INFY', weights: DEFAULT_WEIGHTS, publish: true, sandbox: { gdpDelta: 0, repoDelta: 0, inrDelta: 0 }, universe: STOCK_UNIVERSE.map((s) => ({ id: s.id, name: s.name })) },
    m3uc6: { bucket: 'Quality Compounders', withConvictionAndPatterns: true },
    m3uc7: { stockId: 'INFY', templateName: 'Balanced', heldStocks: REAL_HOLDINGS.filter((h) => h.type === 'STOCK').map((h) => ({ id: h.id, name: h.name })) },
    m3uc8: { token: 'Research Analyst', userId: 'demo-user', searchQuery: 'infy', roles: Object.keys(RBAC_MATRIX) },
  };
  function runM3Discovery(payload) {
    const mi = runMarketIntelligence();
    return runDiscovery({ ...(payload || {}), sectorRotation: mi.sectorRotation });
  }

  global.WISModels = {
    uc1: { run: runGoalAllocation, sample: SAMPLES.uc1 },
    uc2: { run: runMonteCarlo, sample: SAMPLES.uc2 },
    uc3: { run: runOptimization, sample: SAMPLES.uc3 },
    uc4: { run: runRebalancing, sample: SAMPLES.uc4 },
    uc5: { run: runTaxLossHarvesting, sample: SAMPLES.uc5 },
    uc6: { run: runEsgOptimization, sample: SAMPLES.uc6 },
    uc7: { run: runRoboAdvisory, sample: SAMPLES.uc7 },
    m3uc1: { run: runMarketIntelligence, sample: M3_SAMPLES.m3uc1 },
    m3uc2: { run: runSixPillarAnalysis, sample: M3_SAMPLES.m3uc2 },
    m3uc3: { run: runRiskQuantAnalytics, sample: M3_SAMPLES.m3uc3 },
    m3uc4: { run: runM3Discovery, sample: M3_SAMPLES.m3uc4 },
    m3uc5: { run: runConvictionSynthesis, sample: M3_SAMPLES.m3uc5 },
    m3uc6: { run: runScreener, sample: M3_SAMPLES.m3uc6 },
    m3uc7: { run: runPersonalization, sample: M3_SAMPLES.m3uc7 },
    m3uc8: { run: runPlatform, sample: M3_SAMPLES.m3uc8 },
  };
  global.WISRealHoldings = REAL_HOLDINGS;
  global.WISStockUniverse = STOCK_UNIVERSE;
})(window);
