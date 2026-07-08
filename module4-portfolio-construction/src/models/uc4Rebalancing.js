// M4-UC4 -- Dynamic Rebalancing Engine
// FR-RB-01..06: drift monitoring, calendar/threshold/hybrid policy, cash-flow-first allocation,
// cost+tax-aware trade list, tax-deferred alternative, no-trade bands & lot-size respect.

const { TAX_RULES } = require('../data/sampleData');

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
  for (const lot of lots) {
    if (!bySecurity[lot.security]) bySecurity[lot.security] = [];
    bySecurity[lot.security].push(lot);
  }
  return bySecurity;
}

function currentValueAndWeights(lots) {
  const bySecurity = aggregateBySecurity(lots);
  const values = {};
  let total = 0;
  for (const [sec, secLots] of Object.entries(bySecurity)) {
    const val = secLots.reduce((s, l) => s + l.qty * l.currentPrice, 0);
    values[sec] = val;
    total += val;
  }
  const weights = {};
  for (const sec of Object.keys(values)) weights[sec] = total ? values[sec] / total : 0;
  return { values, weights, total, bySecurity };
}

function runRebalancing(input) {
  const {
    lots = [],
    targetWeights = {},
    driftBandAbs = 0.03,
    driftBandRel = 0.20,
    policy = 'threshold', // calendar | threshold | hybrid
    cashflow = 0,
    transactionCostBps = 10,
    taxAversionKappa = 1.0,
    minTradeValue = 5000,
    asOfDate = null,
  } = input;

  const { values, weights, total, bySecurity } = currentValueAndWeights(lots);
  const allSecurities = new Set([...Object.keys(weights), ...Object.keys(targetWeights)]);

  const driftAlerts = [];
  for (const sec of allSecurities) {
    const actual = weights[sec] || 0;
    const target = targetWeights[sec] || 0;
    const drift = actual - target;
    const relDrift = target > 0 ? Math.abs(drift) / target : (actual > 0 ? 1 : 0);
    const breach = Math.abs(drift) > driftBandAbs || relDrift > driftBandRel;
    driftAlerts.push({
      security: sec, currentWeight: Number(actual.toFixed(4)), targetWeight: Number(target.toFixed(4)),
      drift: Number(drift.toFixed(4)), band: driftBandAbs, breach,
    });
  }

  const anyBreach = driftAlerts.some((d) => d.breach);
  const rebalanceTriggered = policy === 'calendar' ? true : anyBreach;

  const tradeList = [];
  let cashRemaining = cashflow;
  const newTotal = total + cashflow;

  if (rebalanceTriggered) {
    // 1) Cash-flow-first: allocate incoming cash to most-underweight securities.
    const underweights = driftAlerts
      .filter((d) => d.drift < 0)
      .sort((a, b) => a.drift - b.drift); // most negative (most underweight) first

    for (const u of underweights) {
      if (cashRemaining <= 0) break;
      const targetValue = u.targetWeight * newTotal;
      const currentValue = values[u.security] || 0;
      const gap = Math.max(0, targetValue - currentValue);
      const buyAmount = Math.min(gap, cashRemaining);
      if (buyAmount >= minTradeValue) {
        tradeList.push({ security: u.security, side: 'BUY', amount: Math.round(buyAmount), source: 'cashflow', taxImpact: 0, estimatedCost: Math.round(buyAmount * transactionCostBps / 10000) });
        cashRemaining -= buyAmount;
      }
    }

    // 2) Residual gaps: sell overweight positions (tax-aware lot selection), buy remaining underweight with any leftover cash.
    let taxImpactTotal = 0;
    for (const d of driftAlerts) {
      if (!d.breach) continue;
      const targetValue = d.targetWeight * newTotal;
      const currentValue = values[d.security] || 0;
      const gapValue = currentValue - targetValue; // positive => need to sell
      if (gapValue > minTradeValue) {
        const secLots = (bySecurity[d.security] || []).slice();
        // Tax-aware ordering: sell realised-loss lots first, then long-term gains, then short-term gains last.
        secLots.sort((a, b) => {
          const glA = (a.currentPrice - a.costBasis), glB = (b.currentPrice - b.costBasis);
          const scoreA = glA < 0 ? -1000 + glA : (lotTaxRate(a, asOfDate).isLongTerm ? 0 : 1000) + glA;
          const scoreB = glB < 0 ? -1000 + glB : (lotTaxRate(b, asOfDate).isLongTerm ? 0 : 1000) + glB;
          return scoreA - scoreB;
        });
        let remainingToSell = gapValue;
        for (const lot of secLots) {
          if (remainingToSell <= 0) break;
          const lotValue = lot.qty * lot.currentPrice;
          const sellValue = Math.min(lotValue, remainingToSell);
          const sellQty = sellValue / lot.currentPrice;
          const { isLongTerm, rate } = lotTaxRate(lot, asOfDate);
          const gainPerUnit = lot.currentPrice - lot.costBasis;
          const realizedGain = gainPerUnit * sellQty;
          const tax = Math.max(0, realizedGain) * rate;
          taxImpactTotal += tax;
          tradeList.push({
            security: d.security, side: 'SELL', amount: Math.round(sellValue), lotId: lot.id,
            holdingType: isLongTerm ? 'LTCG' : 'STCG', realizedGain: Math.round(realizedGain),
            taxImpact: Math.round(tax), estimatedCost: Math.round(sellValue * transactionCostBps / 10000),
          });
          remainingToSell -= sellValue;
        }
      } else if (gapValue < -minTradeValue && cashRemaining > 0) {
        const buyAmount = Math.min(-gapValue, cashRemaining);
        if (buyAmount >= minTradeValue) {
          tradeList.push({ security: d.security, side: 'BUY', amount: Math.round(buyAmount), source: 'residual-cash', taxImpact: 0, estimatedCost: Math.round(buyAmount * transactionCostBps / 10000) });
          cashRemaining -= buyAmount;
        }
      }
    }

    var taxImpact = { totalTax: Math.round(taxImpactTotal), bucket: 'STCG+LTCG blended' };
  } else {
    var taxImpact = { totalTax: 0, bucket: 'n/a' };
  }

  // Post-trade weights (approximate: apply trades to values, then renormalise).
  const postValues = { ...values };
  for (const t of tradeList) {
    postValues[t.security] = (postValues[t.security] || 0) + (t.side === 'BUY' ? t.amount : -t.amount);
  }
  const postTotal = Object.values(postValues).reduce((a, b) => a + b, 0) || 1;
  const postTradeWeights = {};
  for (const sec of allSecurities) postTradeWeights[sec] = Number(((postValues[sec] || 0) / postTotal).toFixed(4));

  const costEstimate = tradeList.reduce((s, t) => s + (t.estimatedCost || 0), 0);

  // Tax-deferred alternative: only do cash-flow-first + widen the band (skip sell-side trades entirely).
  const alternativeTrades = tradeList.filter((t) => t.side === 'BUY');
  const alternativeTax = 0;

  return {
    driftAlerts,
    rebalanceTriggered,
    tradeList,
    postTradeWeights,
    taxImpact,
    costEstimate,
    alternatives: [
      {
        label: 'Tax-deferred (cash-flow only, tolerate residual drift)',
        tradeList: alternativeTrades,
        taxImpact: alternativeTax,
        note: 'Skips sell-side trades; relies on future cashflows and a wider drift tolerance to converge over time.',
      },
    ],
    policy, currentTotal: total, postTotal,
  };
}

module.exports = { runRebalancing, currentValueAndWeights, lotTaxRate };
