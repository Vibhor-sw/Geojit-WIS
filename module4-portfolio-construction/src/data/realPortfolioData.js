// Real-shaped sample portfolio (21 NSE stocks + 12 equity mutual funds) supplied by the client,
// used across UC1/UC3/UC4/UC5 in place of the smaller synthetic universe so the prototype can be
// reviewed against an actual-looking holding set.
//
// The source export gives ISIN, symbol, company/scheme name, sector/category, market-cap bucket,
// a Buy/Hold/Sell recommendation, "atp" (average trade price) and quantity. It does NOT include a
// current market price or purchase date, both of which are required for gain/loss, drift and
// tax-lot calculations. Rather than leave those blank or use today's date for everything (which
// would make every lot short-term and show zero gain/loss), both are derived deterministically
// from each ISIN: same inputs always produce the same outputs, so results are reproducible across
// runs without being random. Replace this file with a live holdings + pricing feed in production.

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

const TODAY = new Date('2026-07-08'); // stable "as of" date so derived prices/dates don't shift between runs

function buildHolding(raw) {
  const priceRng = mulberry32(hashSeed(raw.isin));
  const movement = -0.35 + priceRng() * 0.80; // -35%..+45%: wide enough to yield real gains AND losses
  const currentPrice = Math.max(0.5, raw.atp * (1 + movement));
  const daysAgo = Math.round(30 + priceRng() * 1070); // ~1 month to ~3 years ago -> mixes ST and LT lots
  const purchaseDate = new Date(TODAY.getTime() - daysAgo * 86400000);

  // Illustrative expected-return/vol proxy by market-cap bucket (no real fundamentals feed in this prototype).
  const capProfile = raw.macap === 'Large' ? { expReturn: 0.11, vol: 0.16 } : raw.macap === 'Mid' ? { expReturn: 0.135, vol: 0.22 } : { expReturn: 0.16, vol: 0.28 };
  const factorRng = mulberry32(hashSeed(raw.isin + 'factors'));
  return {
    id: raw.id, isin: raw.isin, name: raw.name, sector: raw.sector, macap: raw.macap, type: raw.type, reco: raw.reco,
    qty: raw.qty, costBasis: raw.atp, currentPrice: Math.round(currentPrice * 100) / 100,
    purchaseDate: purchaseDate.toISOString().slice(0, 10),
    assetClass: 'Equity', expReturn: capProfile.expReturn, vol: capProfile.vol,
    factors: {
      value: Number((factorRng() * 4 - 2).toFixed(2)),
      quality: Number((factorRng() * 4 - 2).toFixed(2)),
      momentum: Number((factorRng() * 4 - 2).toFixed(2)),
      size: raw.macap === 'Large' ? 1.3 : raw.macap === 'Mid' ? 0.5 : -0.6,
      lowvol: raw.macap === 'Large' ? 0.8 : raw.macap === 'Mid' ? 0.1 : -0.7,
    },
  };
}

const REAL_HOLDINGS = RAW_HOLDINGS.map(buildHolding);

module.exports = { REAL_HOLDINGS };
