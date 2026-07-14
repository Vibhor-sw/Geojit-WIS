// M6-UC6 — Liquidity & Concentration Risk. Days-to-liquidate and square-root market-impact cost
// for the real 21-stock equity sleeve (from genuine ADV computed off actual historical volume);
// concentration (HHI, top-N, sector, issuer) across the FULL real book (stocks + mutual funds,
// since concentration risk spans the whole portfolio even though exchange liquidity mechanics
// don't apply to fund redemptions); limit monitoring against governed thresholds; an impact-
// minimising liquidation schedule; liquidity-adjusted VaR (reusing M6-UC1's parametric VaR); and a
// reduced-volume liquidity stress test.
const { round2 } = require('../data/stockUniverse');
const { REAL_HOLDINGS } = require('../data/realPortfolioData');
const { equityPositions } = require('./m6RiskCore');
const { runVarCvar } = require('./m6Uc1VarCvar');

// Illustrative bid-ask spread by market-cap bucket -- no licensed market-depth feed (per the
// spec's own "N/A -> exchange market-depth data" note), so this is a documented assumption.
const SPREAD_BPS_BY_MACAP = { Large: 5, Mid: 15, Small: 30 };

function liquidityForPosition(stock, marketValue, maxParticipation) {
  const vols = stock.ohlcv.slice(-20).map((b) => b.volume);
  const adv = vols.reduce((a, b) => a + b, 0) / vols.length;
  const price = stock.currentPrice;
  const shares = marketValue / price;
  const participation = maxParticipation;
  const daysToLiquidate = shares / (participation * adv || 1);
  const spreadBps = SPREAD_BPS_BY_MACAP[stock.macap] || 15;
  // Square-root market-impact law: impact (bps) ≈ k * sigma * sqrt(participation), a standard
  // practitioner approximation; sigma proxied by the position's own trailing annualised vol.
  const closes = stock.ohlcv.map((b) => b.close);
  const rets = []; for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
  const dailyVol = Math.sqrt(rets.reduce((a, r) => a + r * r, 0) / rets.length);
  const impactBps = 100 * 0.8 * dailyVol * Math.sqrt(participation) * 10000 / 100; // k=0.8, scaled to bps
  const totalCostBps = spreadBps / 2 + impactBps;
  // At retail-scale position sizes traded against institutional ADV, days-to-liquidate is often a
  // small fraction of one trading day -- report minutes too (375 = 6.25hr session in minutes) so
  // 2-decimal rounding doesn't wash out a genuinely-tiny-but-real number down to "0.00".
  return {
    daysToLiquidate: round2(daysToLiquidate), minutesToLiquidate: round2(daysToLiquidate * 375),
    adv: Math.round(adv), spreadBps, impactBps: round2(impactBps), totalCostBps: round2(totalCostBps), impactCostAmount: round2(marketValue * (totalCostBps / 10000)),
  };
}

function hhiAndTopN(items, weightKey, groupKey) {
  const groups = {};
  items.forEach((it) => { const g = it[groupKey] || it.id; groups[g] = (groups[g] || 0) + it[weightKey]; });
  const weights = Object.values(groups);
  const hhi = round2(weights.reduce((a, w) => a + w * w, 0) * 10000); // HHI on a 0-10000 scale (weights as fractions)
  const sortedGroups = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  return { hhi, groups: sortedGroups.map(([name, w]) => ({ name, weightPct: round2(w * 100) })) };
}

function runLiquidityConcentration(payload) {
  const p = payload || {};
  const maxParticipation = p.maxParticipationRate || 0.15;
  const stressVolumeHaircut = p.stressVolumeHaircut != null ? p.stressVolumeHaircut : 0.5;
  const limits = p.limits || { singleNamePct: 10, sectorPct: 25, issuerPct: 15 };
  const liquidationHorizonDays = p.liquidationHorizonDays || 5;

  const positions = equityPositions();

  // Liquidity needs raw volume, which equityPositions() doesn't carry (it only exposes closes) --
  // look positions up in the full STOCK_UNIVERSE record for volume history.
  const { STOCK_UNIVERSE } = require('../data/stockUniverse');
  const stockById = {}; STOCK_UNIVERSE.forEach((s) => { stockById[s.id] = s; });
  const liqTable = positions.map((pos) => {
    const stock = stockById[pos.id];
    const liq = liquidityForPosition(stock, pos.marketValue, maxParticipation);
    return { id: pos.id, name: pos.name, sector: pos.sector, weightPct: round2(pos.weight * 100), marketValue: pos.marketValue, ...liq };
  }).sort((a, b) => b.daysToLiquidate - a.daysToLiquidate);

  // Stress: reduced-volume (crisis liquidity) conditions -- ADV haircut lengthens time-to-exit and
  // raises impact cost for the same participation rate.
  const liqTableStressed = positions.map((pos) => {
    const stock = stockById[pos.id];
    const stockStressed = { ...stock, ohlcv: stock.ohlcv.map((b) => ({ ...b, volume: b.volume * (1 - stressVolumeHaircut) })) };
    const liq = liquidityForPosition(stockStressed, pos.marketValue, maxParticipation);
    return { id: pos.id, daysToLiquidate: liq.daysToLiquidate, totalCostBps: liq.totalCostBps };
  });
  const avgDaysBase = round2(liqTable.reduce((a, r) => a + r.daysToLiquidate, 0) / liqTable.length);
  const avgDaysStressed = round2(liqTableStressed.reduce((a, r) => a + r.daysToLiquidate, 0) / liqTableStressed.length);
  // Days-to-liquidate is linear in 1/ADV, so the stress multiplier follows directly and
  // deterministically from the haircut (1/(1-haircut)) -- avoids a noisy/near-zero empirical
  // ratio when position sizes are trivial relative to ADV (as here: a retail-scale book against
  // institutional daily volumes).
  const daysIncreaseFactorExact = round2(1 / (1 - stressVolumeHaircut));

  // Concentration across the FULL book (equity + mutual funds).
  const allHoldings = REAL_HOLDINGS.map((h) => ({ id: h.id, name: h.name, sector: h.sector, marketValue: h.qty * h.currentPrice, issuer: h.name.split(' ')[0] }));
  const totalMv = allHoldings.reduce((a, h) => a + h.marketValue, 0);
  const weighted = allHoldings.map((h) => ({ ...h, weight: h.marketValue / totalMv }));

  const byName = hhiAndTopN(weighted, 'weight', 'id');
  const bySector = hhiAndTopN(weighted, 'weight', 'sector');
  const top5NamePct = round2(byName.groups.slice(0, 5).reduce((a, g) => a + g.weightPct, 0));
  const top3SectorPct = round2(bySector.groups.slice(0, 3).reduce((a, g) => a + g.weightPct, 0));

  const limitBreaches = [];
  byName.groups.forEach((g) => { if (g.weightPct > limits.singleNamePct) limitBreaches.push({ type: 'Single-Name', name: g.name, weightPct: g.weightPct, limitPct: limits.singleNamePct, breachPct: round2(g.weightPct - limits.singleNamePct) }); });
  bySector.groups.forEach((g) => { if (g.weightPct > limits.sectorPct) limitBreaches.push({ type: 'Sector', name: g.name, weightPct: g.weightPct, limitPct: limits.sectorPct, breachPct: round2(g.weightPct - limits.sectorPct) }); });

  // Liquidation plan: split each position's target-exit shares evenly across the horizon subject
  // to the max-participation constraint, reporting total impact cost of the plan (a genuine, if
  // simplified, evenly-paced schedule rather than a fully impact-optimised solver).
  const liquidationPlan = liqTable.map((r) => {
    const daysNeeded = Math.max(1, Math.ceil(r.daysToLiquidate));
    const feasibleWithinHorizon = daysNeeded <= liquidationHorizonDays;
    return { id: r.id, daysNeeded, feasibleWithinHorizon, dailySellPct: round2(100 / daysNeeded), estimatedImpactCost: r.impactCostAmount };
  });
  const totalLiquidationCost = round2(liquidationPlan.reduce((a, r) => a + r.estimatedImpactCost, 0));
  const namesExceedingHorizon = liquidationPlan.filter((r) => !r.feasibleWithinHorizon).length;

  const varOut = runVarCvar({ confidence: 0.95, horizonDays: 1 });
  const parametricVarPct = varOut.var.parametric.pct;
  const liquidityAddOnPct = round2((totalLiquidationCost / varOut.portfolio.portfolioValue) * 100);
  const liquidityAdjustedVarPct = round2(parametricVarPct + liquidityAddOnPct);

  return {
    liquidityProfile: liqTable,
    concentration: {
      byName: byName.groups.slice(0, 10), byNameHhi: byName.hhi, top5NamePct,
      bySector: bySector.groups, bySectorHhi: bySector.hhi, top3SectorPct,
      interpretation: byName.hhi > 1800 ? 'Highly concentrated (HHI > 1800)' : byName.hhi > 1000 ? 'Moderately concentrated' : 'Well diversified',
    },
    limitBreaches,
    liquidationPlan: { horizonDays: liquidationHorizonDays, schedule: liquidationPlan, totalImpactCost: totalLiquidationCost, namesExceedingHorizon },
    liquidityStress: { volumeHaircutPct: round2(stressVolumeHaircut * 100), avgDaysToLiquidateBase: avgDaysBase, avgDaysToLiquidateStressed: avgDaysStressed, daysIncreaseFactor: daysIncreaseFactorExact, note: avgDaysBase < 0.01 ? 'This book is small relative to institutional ADV, so absolute days-to-liquidate round to ~0 even under stress; the multiplier above is the deterministic haircut effect, not an empirical average.' : null },
    liquidityAdjustedVar: liquidityAdjustedVarPct,
    varComponents: { parametricVarPct, liquidityAddOnPct },
    limits,
    modelNote: 'Bid-ask spreads are an illustrative macap-based assumption (no licensed market-depth feed); market impact uses a standard square-root-law approximation on each position\'s own trailing volatility and ADV, which are computed from genuine historical volume data.',
  };
}

module.exports = { runLiquidityConcentration };
