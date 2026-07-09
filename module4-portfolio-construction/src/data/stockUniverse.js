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

module.exports = { STOCK_UNIVERSE, INDEX_WEIGHTS, hashSeed, mulberry32, rngNormal, round2 };
