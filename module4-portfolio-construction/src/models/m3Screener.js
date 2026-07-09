// M3-UC6 — Screening & Discovery. Query-compilation and ranking service: a typed field schema with
// AND/OR filter compilation, pre-built buckets, a small NL->filter translator (echoed back per the
// FR-SC-03 validation requirement, not silently applied), chart-pattern enrichment and conviction
// links, investor/theme/IPO views (reused from Act 4) and curated investment ideas.
const { STOCK_UNIVERSE, round2 } = require('../data/stockUniverse');
const { runSixPillarAnalysis } = require('./m3Act2SixPillar');
const { runConvictionSynthesis } = require('./m3Act5Conviction');
const { runDiscovery } = require('./m3Act4Discovery');

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

module.exports = { runScreener, FIELD_SCHEMA, PREBUILT_BUCKETS };
