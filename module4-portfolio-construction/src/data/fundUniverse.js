// Module 5 fund/ETF universe for M5-UC6 (Mutual Fund & ETF Selection): the 12 real mutual funds
// from your Module 4 holdings (so this module's fund analysis and your actual portfolio describe
// the same schemes) plus a handful of illustrative extra funds/ETFs for category breadth. NAV
// history, expense ratios and holdings-based style exposure are synthetic — no licensed MF data
// feed (AMFI/Morningstar/Value Research) is wired into this prototype.
const { hashSeed, mulberry32, round2, rngNormal } = require('./stockUniverse');
const { REAL_HOLDINGS } = require('./realPortfolioData');

const TODAY_FUNDS = new Date('2026-07-08');

const CATEGORY_PROFILE = {
  'Large Cap Fund': { vol: 0.15, drift: 0.115, benchmark: 'Nifty 100 TRI' },
  'Mid Cap Fund': { vol: 0.21, drift: 0.135, benchmark: 'Nifty Midcap 150 TRI' },
  'Small Cap Fund': { vol: 0.27, drift: 0.155, benchmark: 'Nifty Smallcap 250 TRI' },
};

const EXTRA_FUNDS = [
  { isin: 'XFND0000FLX1', id: 'PARAG_FLEXI', name: 'Parag Parikh Flexi Cap Fund(G)', sector: 'Flexi Cap Fund', macap: 'Mid' },
  { isin: 'XFND0000IDX1', id: 'UTI_NIFTY50', name: 'UTI Nifty 50 Index Fund(G)', sector: 'Large Cap Fund', macap: 'Large' },
  { isin: 'XFND0000ELS1', id: 'AXIS_ELSS', name: 'Axis Long Term Equity Fund(G)', sector: 'Large Cap Fund', macap: 'Large' },
];

function buildNavHistory(isin, currentNav, category, days) {
  const rng = mulberry32(hashSeed(isin + 'nav'));
  const profile = CATEGORY_PROFILE[category] || CATEGORY_PROFILE['Large Cap Fund'];
  const dt = 1 / 252;
  const navs = [currentNav * 0.7];
  for (let i = 1; i < days; i++) {
    const z = rngNormal(rng);
    navs.push(Math.max(0.5, navs[i - 1] * Math.exp((profile.drift - 0.5 * profile.vol * profile.vol) * dt + profile.vol * Math.sqrt(dt) * z)));
  }
  const scale = currentNav / navs[navs.length - 1];
  let date = new Date(TODAY_FUNDS.getTime() - (days - 1) * 86400000);
  return navs.map((n) => {
    const row = { date: date.toISOString().slice(0, 10), nav: round2(n * scale) };
    date = new Date(date.getTime() + 86400000);
    return row;
  });
}

function buildFund(raw, currentNav) {
  const rng = mulberry32(hashSeed(raw.isin + 'fund'));
  const category = raw.sector;
  const profile = CATEGORY_PROFILE[category] || CATEGORY_PROFILE['Large Cap Fund'];
  const navHistory = buildNavHistory(raw.isin, currentNav, category, 500);
  const expenseRatioPct = round2((category === 'Small Cap Fund' ? 0.7 : category === 'Mid Cap Fund' ? 0.6 : 0.4) + rng() * 0.6);
  const exitLoadPct = round2(rng() < 0.7 ? 1 : 0);
  const aumCr = Math.round(500 + rng() * 15000);
  const turnoverPct = Math.round(20 + rng() * 60);
  const top10ConcentrationPct = round2(30 + rng() * 30);
  const styleDriftScore = round2(rng() * 30); // 0 = no drift from stated category, higher = more drift
  return {
    id: raw.id, isin: raw.isin, name: raw.name, category, macap: raw.macap,
    benchmark: profile.benchmark, currentNav, navHistory, expenseRatioPct, exitLoadPct, aumCr,
    turnoverPct, top10ConcentrationPct, styleDriftScore,
  };
}

const REAL_FUNDS = REAL_HOLDINGS.filter((h) => h.type === 'MF').map((h) => buildFund(h, h.currentPrice));
const EXTRA_BUILT = EXTRA_FUNDS.map((f) => {
  const rng = mulberry32(hashSeed(f.isin));
  const nav = round2(50 + rng() * 250);
  return buildFund({ isin: f.isin, id: f.id, name: f.name, sector: f.sector, macap: f.macap }, nav);
});

const FUND_UNIVERSE = REAL_FUNDS.concat(EXTRA_BUILT);

module.exports = { FUND_UNIVERSE, CATEGORY_PROFILE };
