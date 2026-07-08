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
    driftBandAbs = 0.05,
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

  // IMPORTANT: unlike M4-UC3 (which re-optimises the whole portfolio at any time), this engine only
  // ever touches securities that are actually breached -- non-breached holdings are left untouched,
  // so their post-trade weight will simply equal their current weight.
  const tradeList = [];
  const newTotal = total + cashflow;
  let taxImpactTotal = 0;
  let unallocatedCash = 0;

  if (rebalanceTriggered) {
    const breachedUnderweight = driftAlerts
      .filter((d) => d.breach && d.drift < 0)
      .sort((a, b) => a.drift - b.drift) // most negative (most underweight) first
      .map((d) => {
        const targetValue = d.targetWeight * newTotal;
        const currentValue = values[d.security] || 0;
        return { security: d.security, gap: Math.max(0, targetValue - currentValue) };
      });
    const breachedOverweight = driftAlerts.filter((d) => d.breach && d.drift > 0);

    // Stage 1 (FR-RB-04, cash-flow-first): fund underweight-breached gaps from the incoming cashflow
    // before any sell-side trade is generated at all.
    let pool = cashflow;
    for (const u of breachedUnderweight) {
      if (pool <= 0 || u.gap <= 0) continue;
      const buyAmount = Math.min(u.gap, pool);
      if (buyAmount >= minTradeValue) {
        tradeList.push({ security: u.security, side: 'BUY', amount: Math.round(buyAmount), source: 'cashflow', taxImpact: 0, estimatedCost: Math.round(buyAmount * transactionCostBps / 10000) });
        pool -= buyAmount;
        u.gap -= buyAmount;
      }
    }

    // Stage 2: sell every breached-overweight position down to target (tax-aware lot ordering) --
    // these trims happen regardless of Stage 1, and their proceeds are pooled for Stage 3 rather than
    // discarded, so the portfolio's total value is conserved (previous version lost sell proceeds here).
    for (const d of breachedOverweight) {
      const targetValue = d.targetWeight * newTotal;
      const currentValue = values[d.security] || 0;
      const gapValue = currentValue - targetValue;
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
        const lotValue = lot.qty * lot.currentPrice;
        const sellValue = Math.min(lotValue, remainingToSell);
        const sellQty = sellValue / lot.currentPrice;
        const { isLongTerm, rate } = lotTaxRate(lot, asOfDate);
        const realizedGain = (lot.currentPrice - lot.costBasis) * sellQty;
        const tax = Math.max(0, realizedGain) * rate;
        taxImpactTotal += tax;
        tradeList.push({
          security: d.security, side: 'SELL', amount: Math.round(sellValue), lotId: lot.id,
          holdingType: isLongTerm ? 'LTCG' : 'STCG', realizedGain: Math.round(realizedGain),
          taxImpact: Math.round(tax), estimatedCost: Math.round(sellValue * transactionCostBps / 10000),
        });
        remainingToSell -= sellValue;
        pool += sellValue;
      }
    }

    // Stage 3: redeploy the combined pool (leftover cashflow + sell proceeds) into whatever
    // underweight-breached gap remains, most-underweight-first.
    for (const u of breachedUnderweight) {
      if (pool <= 0 || u.gap <= 0) continue;
      const buyAmount = Math.min(u.gap, pool);
      if (buyAmount >= minTradeValue) {
        tradeList.push({ security: u.security, side: 'BUY', amount: Math.round(buyAmount), source: 'sell-proceeds', taxImpact: 0, estimatedCost: Math.round(buyAmount * transactionCostBps / 10000) });
        pool -= buyAmount;
        u.gap -= buyAmount;
      }
    }

    unallocatedCash = Math.round(pool);
  }

  const taxImpact = { totalTax: Math.round(taxImpactTotal), bucket: rebalanceTriggered ? 'STCG+LTCG blended' : 'n/a' };

  // Post-trade weights: apply trades to values (this conserves total value -- sells fund buys, nothing
  // vanishes), plus an explicit "Cash (unallocated)" line for any pool left over after all breached
  // gaps were closed, so weights are internally consistent and sum to 100%.
  const postValues = { ...values };
  for (const t of tradeList) {
    postValues[t.security] = (postValues[t.security] || 0) + (t.side === 'BUY' ? t.amount : -t.amount);
  }
  const postTotal = Object.values(postValues).reduce((a, b) => a + b, 0) + unallocatedCash || 1;
  const postTradeWeights = {};
  for (const sec of allSecurities) postTradeWeights[sec] = Number(((postValues[sec] || 0) / postTotal).toFixed(4));
  if (unallocatedCash > 0) postTradeWeights['Cash (unallocated)'] = Number((unallocatedCash / postTotal).toFixed(4));

  const costEstimate = tradeList.reduce((s, t) => s + (t.estimatedCost || 0), 0);

  // Tax-deferred alternative: only do cash-flow-first + widen the band (skip sell-side trades entirely).
  const alternativeTrades = tradeList.filter((t) => t.side === 'BUY' && t.source === 'cashflow');

  return {
    driftAlerts,
    rebalanceTriggered,
    tradeList,
    postTradeWeights,
    unallocatedCash,
    taxImpact,
    costEstimate,
    alternatives: [
      {
        label: 'Tax-deferred (cash-flow only, tolerate residual drift)',
        tradeList: alternativeTrades,
        taxImpact: 0,
        note: 'Skips sell-side trades; relies on future cashflows and a wider drift tolerance to converge over time.',
      },
    ],
    policy, currentTotal: total, postTotal,
  };
}

module.exports = { runRebalancing, currentValueAndWeights, lotTaxRate };
