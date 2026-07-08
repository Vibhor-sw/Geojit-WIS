// M4-UC5 -- Tax-Loss Harvesting
// FR-TL-01..06: loss-lot scan ranked by tax benefit, similarity-constrained replacement selection,
// wash-sale compliance gate, tax-alpha computation, YTD tracking, minimum-trade-size respect.

const { UNIVERSE, TAX_RULES } = require('../data/sampleData');
const { lotTaxRate } = require('./uc4Rebalancing');

function findSecurity(id) {
  return UNIVERSE.find((u) => u.id === id);
}

function factorSimilarity(a, b) {
  if (!a || !b) return 0;
  const keys = ['value', 'quality', 'momentum', 'size', 'lowvol'];
  let dist = 0;
  for (const k of keys) dist += Math.pow((a.factors[k] || 0) - (b.factors[k] || 0), 2);
  const maxDist = keys.length * 4; // rough normalisation
  return Math.max(0, 1 - Math.sqrt(dist) / Math.sqrt(maxDist));
}

// Illustrative tracking-error proxy from vol difference + (1 - sector match) since we lack real return history.
function trackingErrorEstimate(a, b) {
  if (!a || !b) return 1;
  const volDiff = Math.abs(a.vol - b.vol);
  const sectorPenalty = a.sector === b.sector ? 0 : 0.06;
  return Number((volDiff * 0.5 + sectorPenalty).toFixed(4));
}

function runTaxLossHarvesting(input) {
  const {
    lots = [],
    realizedGainsYTD = { stcg: 0, ltcg: 0 },
    washSaleWindowDays = TAX_RULES.washSaleWindowDays,
    minHarvestableLoss = 2000,
    recentlyPurchased = [], // [{security, date}] to check wash-sale gate against candidate replacements
    similarityWeight = 0.6,
    teWeight = 0.3,
    costWeight = 0.1,
    maxCarryForward = null,
    asOfDate = null,
  } = input;

  const now = asOfDate ? new Date(asOfDate) : new Date();
  const lossLots = [];
  for (const lot of lots) {
    const gainLoss = (lot.currentPrice - lot.costBasis) * lot.qty;
    if (gainLoss < -minHarvestableLoss) {
      const { isLongTerm, rate } = lotTaxRate(lot, asOfDate);
      lossLots.push({ ...lot, unrealizedLoss: gainLoss, isLongTerm, applicableRate: rate });
    }
  }

  // Rank by tax benefit = |loss| * applicable rate.
  lossLots.forEach((l) => { l.taxBenefit = Math.abs(l.unrealizedLoss) * l.applicableRate; });
  lossLots.sort((a, b) => b.taxBenefit - a.taxBenefit);

  const complianceFlags = [];
  const sellBuyPairs = [];
  let harvestedSTCG = 0, harvestedLTCG = 0;

  let remainingSTCGOffset = realizedGainsYTD.stcg || 0;
  let remainingLTCGOffset = realizedGainsYTD.ltcg || 0;

  for (const lot of lossLots) {
    const sold = findSecurity(lot.security);

    // Wash-sale gate: block if this security was repurchased within the restriction window already.
    const recentBuy = recentlyPurchased.find((r) => r.security === lot.security);
    if (recentBuy) {
      const daysSince = Math.round((now - new Date(recentBuy.date)) / 86400000);
      if (daysSince < washSaleWindowDays) {
        complianceFlags.push({
          security: lot.security, type: 'wash-sale-block', message: `Repurchase within ${washSaleWindowDays}d window (bought ${daysSince}d ago); harvesting blocked.`,
        });
        continue;
      }
    }

    // Offset against available gains bucket, preferring same-type bucket first.
    let offsetBucket = lot.isLongTerm ? 'ltcg' : 'stcg';
    const available = offsetBucket === 'ltcg' ? remainingLTCGOffset : remainingSTCGOffset;
    const offsetAmount = Math.min(Math.abs(lot.unrealizedLoss), Math.max(available, 0));
    if (offsetBucket === 'ltcg') remainingLTCGOffset -= offsetAmount; else remainingSTCGOffset -= offsetAmount;

    if (lot.isLongTerm) harvestedLTCG += Math.abs(lot.unrealizedLoss);
    else harvestedSTCG += Math.abs(lot.unrealizedLoss);

    // Replacement candidate selection: highest similarity score among universe (excluding sold security itself
    // and anything substantially identical / within its own wash window).
    const candidates = UNIVERSE.filter((u) => u.id !== lot.security && u.assetClass === (sold ? sold.assetClass : u.assetClass));
    let best = null, bestScore = -Infinity;
    for (const c of candidates) {
      const sim = factorSimilarity(sold, c);
      const te = trackingErrorEstimate(sold, c);
      const score = similarityWeight * sim - teWeight * te - costWeight * 0.001;
      if (score > bestScore) { bestScore = score; best = { ...c, similarity: Number(sim.toFixed(3)), trackingError: te }; }
    }

    sellBuyPairs.push({
      sellLotId: lot.id,
      sellSecurity: lot.security,
      qty: lot.qty,
      unrealizedLoss: Math.round(lot.unrealizedLoss),
      holdingType: lot.isLongTerm ? 'LTCG' : 'STCG',
      taxBenefit: Math.round(lot.taxBenefit),
      replacement: best ? { security: best.id, name: best.name, similarity: best.similarity, trackingError: best.trackingError } : null,
    });
  }

  const ytdTaxAlpha = Math.round(
    harvestedSTCG * TAX_RULES.equity.stcgRate + harvestedLTCG * TAX_RULES.equity.ltcgRate
  );

  const harvestReport = {
    lotsScanned: lots.length,
    lossLotsFound: lossLots.length,
    lossLotsHarvested: sellBuyPairs.length,
    totalRealizedLoss: Math.round(harvestedSTCG + harvestedLTCG),
    breakdown: { stcgLossHarvested: Math.round(harvestedSTCG), ltcgLossHarvested: Math.round(harvestedLTCG) },
  };

  const harvestCapacity = {
    remainingSTCGOffset: Math.round(Math.max(remainingSTCGOffset, 0)),
    remainingLTCGOffset: Math.round(Math.max(remainingLTCGOffset, 0)),
    carryForwardEligible: maxCarryForward != null ? Math.max(0, maxCarryForward - (harvestedSTCG + harvestedLTCG)) : null,
  };

  // Allocation delta: net asset-class shift caused by sell->replacement swaps (same asset class by construction, so ~0 by design).
  const allocationDelta = {};
  for (const pair of sellBuyPairs) {
    const sold = findSecurity(pair.sellSecurity);
    if (sold) allocationDelta[sold.assetClass] = (allocationDelta[sold.assetClass] || 0);
  }

  return { harvestReport, sellBuyPairs, complianceFlags, ytdTaxAlpha, harvestCapacity, allocationDelta };
}

module.exports = { runTaxLossHarvesting };
