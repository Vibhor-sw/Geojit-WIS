// M3-UC4 — Stock Setup & Discovery (Act 4). Retrieval/ranking service: combination scans,
// institutional intent, event-risk tagging, rotation ideas, investor/business-house portfolios, IPO
// analysis, themes and filings aggregation. Discovery ranks/surfaces; ratings only ever come from
// M3-UC5 (FR-SD constraint) — nothing here issues a Buy/Sell call.
const { STOCK_UNIVERSE, hashSeed, mulberry32, round2 } = require('../data/stockUniverse');
const { runSixPillarAnalysis } = require('./m3Act2SixPillar');

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

module.exports = { runDiscovery };
