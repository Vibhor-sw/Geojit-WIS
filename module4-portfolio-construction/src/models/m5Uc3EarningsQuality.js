// M5-UC3 — Earnings Quality & Accruals Detection. Accruals metrics, four forensic component scores
// (Beneish M, Altman Z, Piotroski F, a Montier-style C-Score), rule-based red-flag detection, a
// composite 0-100 earnings-quality score, and a 2-point trend + peer-rank. This reuses the same
// Beneish/Altman/Piotroski formulas as Module 3's fundamental pillar (the spec calls these out as a
// shared/reusable core) but is computed independently here to keep the two modules decoupled in the
// static bundle.
const { STOCK_UNIVERSE, round2 } = require('../data/stockUniverse');

function findStock(id) {
  const s = STOCK_UNIVERSE.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown stock id: ${id}`);
  return s;
}

function accrualsMetrics(f, n) {
  // Sloan (1996) operating-accruals ratio. The spec's formula also subtracts cash flow from
  // investing (CFI); this synthetic dataset doesn't carry a separate CFI line, so this is the
  // operating-accruals variant only — flagged as such in the coachmark tour.
  const sloanRatio = (f.netIncome[n] - f.cfo[n]) / f.totalAssets[n];
  const cashConversion = f.cfo[n] / f.netIncome[n]; // >1 = cash-backed earnings, <1 = accrual-heavy
  const discretionaryAccrualsProxy = (f.netIncome[n] - f.cfo[n]) / f.revenue[n]; // scaled by revenue instead of assets, a second lens
  return { sloanRatio: round2(sloanRatio * 100), cashConversion: round2(cashConversion), discretionaryAccrualsPctRevenue: round2(discretionaryAccrualsProxy * 100) };
}

function beneishMScoreM5(f, n) {
  const dsri = (f.receivables[n] / f.revenue[n]) / (f.receivables[n - 1] / f.revenue[n - 1]);
  const gmi = ((f.revenue[n - 1] - f.cogs[n - 1]) / f.revenue[n - 1]) / ((f.revenue[n] - f.cogs[n]) / f.revenue[n]);
  const aqi = (1 - (f.currentAssets[n] + f.ppeGross[n]) / f.totalAssets[n]) / (1 - (f.currentAssets[n - 1] + f.ppeGross[n - 1]) / f.totalAssets[n - 1]);
  const sgi = f.revenue[n] / f.revenue[n - 1];
  const depi = (f.depreciation[n - 1] / (f.depreciation[n - 1] + f.ppeGross[n - 1])) / (f.depreciation[n] / (f.depreciation[n] + f.ppeGross[n]));
  const sgai = (f.sga[n] / f.revenue[n]) / (f.sga[n - 1] / f.revenue[n - 1]);
  const lvgi = ((f.totalDebt[n] + f.currentLiabilities[n]) / f.totalAssets[n]) / ((f.totalDebt[n - 1] + f.currentLiabilities[n - 1]) / f.totalAssets[n - 1]);
  const tata = (f.netIncome[n] - f.cfo[n]) / f.totalAssets[n];
  const m = -4.84 + 0.92 * dsri + 0.528 * gmi + 0.404 * aqi + 0.892 * sgi + 0.115 * depi - 0.172 * sgai + 4.679 * tata - 0.327 * lvgi;
  return { score: round2(m), flag: m > -1.78 ? 'Possible manipulation risk' : 'No flag', components: { dsri: round2(dsri), gmi: round2(gmi), aqi: round2(aqi), sgi: round2(sgi), depi: round2(depi), sgai: round2(sgai), lvgi: round2(lvgi), tata: round2(tata) } };
}
function altmanZM5(f, n) {
  const wc = f.currentAssets[n] - f.currentLiabilities[n];
  const re = f.equity[n] * 0.4;
  const mve = f.equity[n] * 1.3;
  const z = 1.2 * (wc / f.totalAssets[n]) + 1.4 * (re / f.totalAssets[n]) + 3.3 * (f.ebit[n] / f.totalAssets[n])
    + 0.6 * (mve / (f.totalDebt[n] + f.currentLiabilities[n])) + 1.0 * (f.revenue[n] / f.totalAssets[n]);
  return { score: round2(z), zone: z > 2.99 ? 'Safe' : z > 1.81 ? 'Grey' : 'Distress' };
}
function piotroskiFM5(f, n) {
  const roa = f.netIncome[n] / f.totalAssets[n];
  const roaPrev = f.netIncome[n - 1] / f.totalAssets[n - 1];
  const tests = [
    f.netIncome[n] > 0, f.cfo[n] > 0, roa > roaPrev, f.cfo[n] > f.netIncome[n],
    (f.totalDebt[n] / f.totalAssets[n]) < (f.totalDebt[n - 1] / f.totalAssets[n - 1]),
    (f.currentAssets[n] / f.currentLiabilities[n]) > (f.currentAssets[n - 1] / f.currentLiabilities[n - 1]),
    true,
    (f.revenue[n] / f.totalAssets[n]) > (f.revenue[n - 1] / f.totalAssets[n - 1]),
    ((f.revenue[n] - f.cogs[n]) / f.revenue[n]) > ((f.revenue[n - 1] - f.cogs[n - 1]) / f.revenue[n - 1]),
  ];
  return { score: tests.filter(Boolean).length, max: 9 };
}
// Montier-style C-Score: 6 binary "earnings-manipulation-adjacent" red flags. Adapted to the fields
// available in this synthetic dataset (no separate inventory line, so tests 2/3 use the closest
// available proxies) — each true test adds 1 point; higher = more red flags, same direction as
// Beneish (worse quality), unlike Altman/Piotroski where higher is better.
function montierCScore(f, n) {
  const niGrowingFasterThanCfo = (f.netIncome[n] - f.netIncome[n - 1]) > (f.cfo[n] - f.cfo[n - 1]);
  const dsoRising = (f.receivables[n] / f.revenue[n]) > (f.receivables[n - 1] / f.revenue[n - 1]);
  const ocaToSalesRising = ((f.currentAssets[n] - f.receivables[n]) / f.revenue[n]) > ((f.currentAssets[n - 1] - f.receivables[n - 1]) / f.revenue[n - 1]);
  const depreciationRateDeclining = (f.depreciation[n] / f.ppeGross[n]) < (f.depreciation[n - 1] / f.ppeGross[n - 1]);
  const assetGrowthHigh = (f.totalAssets[n] / f.totalAssets[n - 1] - 1) > 0.20;
  const sgaToSalesRising = (f.sga[n] / f.revenue[n]) > (f.sga[n - 1] / f.revenue[n - 1]);
  const tests = { niGrowingFasterThanCfo, dsoRising, ocaToSalesRising, depreciationRateDeclining, assetGrowthHigh, sgaToSalesRising };
  const score = Object.values(tests).filter(Boolean).length;
  return { score, max: 6, tests };
}

function detectRedFlags(stock, f, n) {
  const flags = [];
  const dsoGrowthPct = ((f.receivables[n] / f.revenue[n]) / (f.receivables[n - 1] / f.revenue[n - 1]) - 1) * 100;
  if (dsoGrowthPct > 15) flags.push({ type: 'Receivables Build', evidence: `Days-sales-outstanding proxy up ${round2(dsoGrowthPct)}% YoY vs revenue growth — customers may be taking longer to pay, or revenue is being recognised early.` });
  const revenueGrowthPct = (f.revenue[n] / f.revenue[n - 1] - 1) * 100;
  const cfoGrowthPct = (f.cfo[n] / f.cfo[n - 1] - 1) * 100;
  if (revenueGrowthPct > 5 && cfoGrowthPct < revenueGrowthPct - 15) flags.push({ type: 'Revenue vs Cash-Flow Divergence', evidence: `Revenue grew ${round2(revenueGrowthPct)}% but operating cash flow grew only ${round2(cfoGrowthPct)}% — profits are outrunning cash collection.` });
  if (stock.governance.rptFlag) flags.push({ type: 'Related-Party Transaction', evidence: 'A related-party transaction is on record for this issuer — not necessarily improper, but it warrants scrutiny of the transaction terms.' });
  if (stock.governance.promoterPledgePct > 5) flags.push({ type: 'Promoter Share Pledge', evidence: `${stock.governance.promoterPledgePct}% of promoter holding is pledged — a forced-sale risk if the stock falls sharply.` });
  return flags;
}

function computeForYear(stock, yearIdx) {
  const f = stock.financials;
  const n = yearIdx;
  const accruals = accrualsMetrics(f, n);
  const beneish = beneishMScoreM5(f, n);
  const altman = altmanZM5(f, n);
  const piotroski = piotroskiFM5(f, n);
  const montier = montierCScore(f, n);
  // Composite: sign-adjust so higher always means "better quality", then blend.
  const beneishComponent = beneish.score < -1.78 ? 70 : 30; // below threshold = cleaner
  const altmanComponent = altman.zone === 'Safe' ? 85 : altman.zone === 'Grey' ? 55 : 20;
  const piotroskiComponent = (piotroski.score / piotroski.max) * 100;
  const montierComponent = 100 - (montier.score / montier.max) * 100;
  const accrualsComponent = Math.max(0, Math.min(100, 70 - accruals.sloanRatio * 3)); // more negative/small sloan ratio = cleaner
  const composite = round2(0.25 * beneishComponent + 0.2 * altmanComponent + 0.2 * piotroskiComponent + 0.2 * montierComponent + 0.15 * accrualsComponent);
  return { year: f.years[n], accruals, beneish, altman, piotroski, montier, composite };
}

function runEarningsQuality(payload) {
  const p = payload || {};
  const stockId = p.stockId || 'INFY';
  const stock = findStock(stockId);
  const f = stock.financials;
  const latestIdx = f.revenue.length - 1;
  const latest = computeForYear(stock, latestIdx);
  const prior = computeForYear(stock, latestIdx - 1);
  const redFlags = detectRedFlags(stock, f, latestIdx);

  const peers = STOCK_UNIVERSE.filter((s) => s.sector === stock.sector && s.id !== stock.id);
  const peerScores = peers.map((peer) => ({ id: peer.id, name: peer.name, score: computeForYear(peer, peer.financials.revenue.length - 1).composite }));
  const allSectorScores = [{ id: stock.id, name: stock.name, score: latest.composite }, ...peerScores].sort((a, b) => b.score - a.score);
  const peerRank = allSectorScores.findIndex((s) => s.id === stock.id) + 1;

  return {
    stock: { id: stock.id, name: stock.name, sector: stock.sector, macap: stock.macap },
    earningsQualityScore: latest.composite,
    forensicScores: { beneish: latest.beneish, altman: latest.altman, piotroski: latest.piotroski, montier: latest.montier },
    accrualsMetrics: latest.accruals,
    redFlags,
    qualityTrend: [{ year: prior.year, score: prior.composite }, { year: latest.year, score: latest.composite }],
    peerRank: { rank: peerRank, outOf: allSectorScores.length, table: allSectorScores },
  };
}

module.exports = { runEarningsQuality };
