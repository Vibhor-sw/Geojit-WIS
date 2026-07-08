// Metadata + result-renderers for each M4 use case. Kept separate from app.js (shell/wiring)
// so each use case's rendering logic is easy to locate and extend.
(function (global) {
  const { barChart, bandChart, frontierChart, fmtCompact, fmtPct } = global.WISCharts;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function metricCard(label, value, sub) {
    const card = el('div', 'metric-card');
    card.appendChild(el('div', 'metric-label', label));
    card.appendChild(el('div', 'metric-value', value));
    if (sub) card.appendChild(el('div', 'metric-sub', sub));
    return card;
  }

  function table(headers, rows) {
    const t = el('table', 'data-table');
    const thead = el('thead');
    const trh = el('tr');
    headers.forEach((h) => trh.appendChild(el('th', null, h)));
    thead.appendChild(trh);
    t.appendChild(thead);
    const tbody = el('tbody');
    rows.forEach((r) => {
      const tr = el('tr');
      r.forEach((c) => {
        const td = el('td');
        if (c instanceof HTMLElement) td.appendChild(c); else td.innerHTML = c;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    return t;
  }

  function tag(text, cls) { return `<span class="tag ${cls}">${text}</span>`; }

  const USE_CASES = [
    {
      key: 'uc1', tag: 'M4-UC1', title: 'Goal-Based Asset Allocation', api: '/api/uc1',
      objective: 'Map each client goal to an asset allocation using time-horizon bucketing and a probability-of-success score, and emit rebalancing triggers and scenario paths.',
      frs: ['FR-GA-01 Multi-goal capture (Must)', 'FR-GA-02 Horizon glide-path (Must)', 'FR-GA-03 Probability of success (Must)', 'FR-GA-04 SIP goal-seek (Must)', 'FR-GA-05 Rebalancing triggers (Must)', 'FR-GA-06 CMA governance (Should)', 'FR-GA-07 Household aggregation (Should)'],
      render(container, data) {
        container.innerHTML = '';
        const metrics = el('div', 'metric-row');
        metrics.appendChild(metricCard('Goals Modelled', data.goalAllocations.length));
        metrics.appendChild(metricCard('CMA Version', data.assumptionSet.version, data.assumptionSet.effectiveDate));
        metrics.appendChild(metricCard('Rebalancing Triggers', data.rebalancingTriggers.length));
        container.appendChild(metrics);

        const panel1 = el('div', 'panel');
        panel1.appendChild(el('div', 'panel-title', 'Goal Allocations'));
        panel1.appendChild(table(
          ['Goal', 'Horizon', 'Required Corpus', 'Required SIP', 'Attainment Score', 'P(success)'],
          data.goalAllocations.map((g) => [
            g.goalName, g.horizonBucket,
            '₹' + fmtCompact(g.requiredCorpus), '₹' + fmtCompact(g.requiredMonthlySip) + '/mo',
            g.goalAttainmentScore + '/100', fmtPct(g.probability),
          ])
        ));
        container.appendChild(panel1);

        const two = el('div', 'two-col');
        const p2 = el('div', 'panel');
        p2.appendChild(el('div', 'panel-title', 'Household Allocation (aggregated across goals)'));
        const chart1 = el('div', 'chart-wrap');
        p2.appendChild(chart1);
        two.appendChild(p2);

        const p3 = el('div', 'panel');
        p3.appendChild(el('div', 'panel-title', 'Rebalancing Triggers'));
        if (data.rebalancingTriggers.length) {
          p3.appendChild(table(['Type', 'Scope', 'Threshold', 'Current'], data.rebalancingTriggers.map((t) => [
            t.type, t.goal || t.assetClass, t.threshold != null ? t.threshold : t.band, t.currentValue,
          ])));
        } else {
          p3.appendChild(el('div', 'empty-hint', 'No triggers breached'));
        }
        two.appendChild(p3);
        container.appendChild(two);

        barChart(chart1, Object.entries(data.householdAllocation).map(([k, v]) => ({ label: k, value: v })), {
          valueFormatter: (v) => fmtPct(v), max: 1,
        });

        const p4 = el('div', 'panel');
        p4.appendChild(el('div', 'panel-title', 'Scenario Wealth Paths (5th–95th percentile band, gold = median)'));
        data.scenarioPaths.forEach((sp) => {
          p4.appendChild(el('div', null, `<strong>${sp.goalName}</strong>`));
          const cw = el('div', 'chart-wrap');
          p4.appendChild(cw);
          bandChart(cw, sp.series, { xLabel: (i) => 'Yr ' + i });
        });
        container.appendChild(p4);
      },
    },

    {
      key: 'uc2', tag: 'M4-UC2', title: 'Monte Carlo Retirement & Wealth Simulation', api: '/api/uc2',
      objective: 'Model stochastic accumulation and decumulation paths incorporating returns, inflation, taxes and spending shocks; output probability-of-success, percentile wealth paths and a safe withdrawal rate.',
      frs: ['FR-MC-01 ≥10,000 paths (Must)', 'FR-MC-02 Stochastic inputs (Must)', 'FR-MC-03 Success probability (Must)', 'FR-MC-04 Safe withdrawal rate (Must)', 'FR-MC-05 Sequence-of-returns risk (Should)', 'FR-MC-06 Return-model selection (Should)'],
      render(container, data) {
        container.innerHTML = '';
        const metrics = el('div', 'metric-row');
        metrics.appendChild(metricCard('Plan Success Probability', fmtPct(data.successProbability)));
        metrics.appendChild(metricCard('Safe Withdrawal Rate', fmtPct(data.safeWithdrawalRate, 2)));
        metrics.appendChild(metricCard('Sequence-Risk Delta', fmtPct(data.sequenceRiskDelta, 1), 'back-loaded vs front-loaded bad years'));
        metrics.appendChild(metricCard('Paths Simulated', data.runManifest.pathCount));
        container.appendChild(metrics);

        const p1 = el('div', 'panel');
        p1.appendChild(el('div', 'panel-title', 'Percentile Wealth Trajectory (accumulation → decumulation)'));
        const cw = el('div', 'chart-wrap');
        p1.appendChild(cw);
        container.appendChild(p1);
        bandChart(cw, data.percentileWealthPaths, { height: 280, xLabel: (i) => 'Yr ' + i });

        const two = el('div', 'two-col');
        const p2 = el('div', 'panel');
        p2.appendChild(el('div', 'panel-title', 'Depletion Age Distribution (failed paths only)'));
        if (data.depletionAgeDist.count) {
          p2.appendChild(table(['Failed Paths', 'Earliest Depletion (yr)', 'Median', 'Latest'], [[
            data.depletionAgeDist.count, data.depletionAgeDist.min, data.depletionAgeDist.median, data.depletionAgeDist.max,
          ]]));
        } else {
          p2.appendChild(el('div', 'empty-hint', 'No paths depleted the corpus'));
        }
        two.appendChild(p2);

        const p3 = el('div', 'panel');
        p3.appendChild(el('div', 'panel-title', 'Run Manifest (audit)'));
        p3.appendChild(table(['Field', 'Value'], [
          ['Assumption set', data.runManifest.assumptions],
          ['Return model', data.runManifest.model],
          ['Seed', data.runManifest.seed],
          ['Timestamp', data.runManifest.timestamp],
        ]));
        two.appendChild(p3);
        container.appendChild(two);
      },
    },

    {
      key: 'uc3', tag: 'M4-UC3', title: 'Mean-Variance & Factor Optimization', api: '/api/uc3',
      objective: 'Produce optimal portfolio weights using Markowitz mean-variance, Black-Litterman and robust optimisation subject to factor targets and constraints; return the efficient frontier, factor report and trade list.',
      frs: ['FR-MV-01 Objective solve (Must)', 'FR-MV-02 Black-Litterman (Must)', 'FR-MV-03 Shrinkage covariance (Must)', 'FR-MV-04 Factor/sector limits (Must)', 'FR-MV-05 Efficient frontier (Must)', 'FR-MV-06 Trade list (Must)', 'FR-MV-07 Turnover-aware (Should)'],
      render(container, data) {
        container.innerHTML = '';
        const m = data.riskMetrics;
        const metrics = el('div', 'metric-row');
        metrics.appendChild(metricCard('Expected Return', fmtPct(m.expectedReturn)));
        metrics.appendChild(metricCard('Volatility', fmtPct(m.volatility)));
        metrics.appendChild(metricCard('Sharpe Ratio', m.sharpe.toFixed(2)));
        metrics.appendChild(metricCard('Turnover', fmtPct(m.turnover)));
        metrics.appendChild(metricCard('Diversification Ratio', m.diversificationRatio.toFixed(2)));
        container.appendChild(metrics);

        const two = el('div', 'two-col');
        const p1 = el('div', 'panel');
        p1.appendChild(el('div', 'panel-title', 'Optimal Weights (' + data.muUsed + ')'));
        const cw1 = el('div', 'chart-wrap');
        p1.appendChild(cw1);
        two.appendChild(p1);

        const p2 = el('div', 'panel');
        p2.appendChild(el('div', 'panel-title', 'Efficient Frontier'));
        const cw2 = el('div', 'chart-wrap');
        p2.appendChild(cw2);
        two.appendChild(p2);
        container.appendChild(two);

        barChart(cw1, data.optimalWeights.filter((w) => w.weight > 0.001).map((w) => ({ label: w.security, value: w.weight })), { valueFormatter: fmtPct, max: Math.max(...data.optimalWeights.map((w) => w.weight)) });
        frontierChart(cw2, data.efficientFrontier, data.currentPortfolio, { risk: m.volatility, return: m.expectedReturn });

        const p3 = el('div', 'panel');
        p3.appendChild(el('div', 'panel-title', 'Factor Report'));
        p3.appendChild(table(['Factor', 'Portfolio Exposure'], Object.entries(data.factorReport).map(([k, v]) => [k, v.toFixed(2)])));
        container.appendChild(p3);

        const p4 = el('div', 'panel');
        p4.appendChild(el('div', 'panel-title', `Trade List (${data.tradeList.length} trades, feasible: ${data.feasibility.boxSatisfied && data.feasibility.sectorCapsSatisfied})`));
        p4.appendChild(table(['Security', 'Side', 'Current Wt', 'Target Wt', 'Delta', 'Est. Cost (bps)'], data.tradeList.map((t) => [
          t.name, tag(t.side, t.side === 'BUY' ? 'buy' : 'sell'), fmtPct(t.currentWeight), fmtPct(t.targetWeight), fmtPct(t.delta), t.estimatedCostBps.toFixed(1),
        ])));
        container.appendChild(p4);
      },
    },

    {
      key: 'uc4', tag: 'M4-UC4', title: 'Dynamic Rebalancing Engine', api: '/api/uc4',
      objective: 'Monitor allocation drift and trigger cost- and tax-optimised rebalancing, returning drift alerts, a prioritised trade list, post-trade vs target comparison and tax impact.',
      frs: ['FR-RB-01 Drift monitoring (Must)', 'FR-RB-02 Calendar/threshold/hybrid policy (Must)', 'FR-RB-03 Cost+tax-aware trades (Must)', 'FR-RB-04 Cash-flow-first (Must)', 'FR-RB-05 Tax impact & alternative (Must)', 'FR-RB-06 No-trade bands (Should)'],
      render(container, data) {
        container.innerHTML = '';
        const metrics = el('div', 'metric-row');
        metrics.appendChild(metricCard('Rebalance Triggered', data.rebalanceTriggered ? 'Yes' : 'No'));
        metrics.appendChild(metricCard('Trades Proposed', data.tradeList.length));
        metrics.appendChild(metricCard('Estimated Tax Impact', '₹' + fmtCompact(data.taxImpact.totalTax)));
        metrics.appendChild(metricCard('Estimated Cost', '₹' + fmtCompact(data.costEstimate)));
        container.appendChild(metrics);

        const p1 = el('div', 'panel');
        p1.appendChild(el('div', 'panel-title', 'Drift Alerts vs Target'));
        p1.appendChild(table(['Security', 'Current Wt', 'Target Wt', 'Drift', 'Breach'], data.driftAlerts.map((d) => [
          d.security, fmtPct(d.currentWeight), fmtPct(d.targetWeight), fmtPct(d.drift), d.breach ? tag('BREACH', 'breach') : tag('OK', 'ok'),
        ])));
        container.appendChild(p1);

        const p2 = el('div', 'panel');
        p2.appendChild(el('div', 'panel-title', 'Prioritised Trade List'));
        if (data.tradeList.length) {
          p2.appendChild(table(['Security', 'Side', 'Amount', 'Source/Lot', 'Holding', 'Realised Gain', 'Tax'], data.tradeList.map((t) => [
            t.security, tag(t.side, t.side === 'BUY' ? 'buy' : 'sell'), '₹' + fmtCompact(t.amount),
            t.source || t.lotId || '-', t.holdingType || '-', t.realizedGain != null ? '₹' + fmtCompact(t.realizedGain) : '-',
            t.taxImpact ? '₹' + fmtCompact(t.taxImpact) : '₹0',
          ])));
        } else {
          p2.appendChild(el('div', 'empty-hint', 'No trades required — portfolio within bands'));
        }
        container.appendChild(p2);

        const two = el('div', 'two-col');
        const p3 = el('div', 'panel');
        p3.appendChild(el('div', 'panel-title', 'Post-Trade Weights'));
        const cw = el('div', 'chart-wrap');
        p3.appendChild(cw);
        two.appendChild(p3);
        barChart(cw, Object.entries(data.postTradeWeights).map(([k, v]) => ({ label: k, value: v })), { valueFormatter: fmtPct, max: 1 });

        const p4 = el('div', 'panel');
        p4.appendChild(el('div', 'panel-title', 'Tax-Deferred Alternative'));
        const alt = data.alternatives[0];
        p4.appendChild(el('p', null, alt.note));
        p4.appendChild(table(['Security', 'Side', 'Amount'], alt.tradeList.map((t) => [t.security, tag(t.side, 'buy'), '₹' + fmtCompact(t.amount)])));
        two.appendChild(p4);
        container.appendChild(two);
      },
    },

    {
      key: 'uc5', tag: 'M4-UC5', title: 'Tax-Loss Harvesting', api: '/api/uc5',
      objective: 'Scan holdings for harvestable losses and suitable replacements that preserve the factor/risk profile, remaining wash-sale compliant; output a harvest report, sell/buy pairs, compliance flags and YTD tax alpha.',
      frs: ['FR-TL-01 Loss-lot ranking (Must)', 'FR-TL-02 Replacement selection (Must)', 'FR-TL-03 Wash-sale gate (Must)', 'FR-TL-04 Tax alpha (Must)', 'FR-TL-05 YTD capacity tracking (Must)', 'FR-TL-06 Min trade size (Should)'],
      render(container, data) {
        container.innerHTML = '';
        const r = data.harvestReport;
        const metrics = el('div', 'metric-row');
        metrics.appendChild(metricCard('Loss Lots Found', r.lossLotsFound));
        metrics.appendChild(metricCard('Lots Harvested', r.lossLotsHarvested));
        metrics.appendChild(metricCard('Total Realised Loss', '₹' + fmtCompact(r.totalRealizedLoss)));
        metrics.appendChild(metricCard('YTD Tax Alpha', '₹' + fmtCompact(data.ytdTaxAlpha)));
        container.appendChild(metrics);

        const p1 = el('div', 'panel');
        p1.appendChild(el('div', 'panel-title', 'Sell / Replacement Pairs'));
        if (data.sellBuyPairs.length) {
          p1.appendChild(table(['Sell', 'Loss', 'Holding', 'Tax Benefit', 'Replacement', 'Similarity', 'Tracking Error'], data.sellBuyPairs.map((p) => [
            p.sellSecurity, '₹' + fmtCompact(p.unrealizedLoss), tag(p.holdingType, 'long'), '₹' + fmtCompact(p.taxBenefit),
            p.replacement ? p.replacement.name : '-', p.replacement ? fmtPct(p.replacement.similarity) : '-', p.replacement ? p.replacement.trackingError : '-',
          ])));
        } else {
          p1.appendChild(el('div', 'empty-hint', 'No harvestable losses above threshold'));
        }
        container.appendChild(p1);

        const two = el('div', 'two-col');
        const p2 = el('div', 'panel');
        p2.appendChild(el('div', 'panel-title', 'Compliance Flags'));
        if (data.complianceFlags.length) {
          p2.appendChild(table(['Security', 'Type', 'Message'], data.complianceFlags.map((f) => [f.security, tag(f.type, 'breach'), f.message])));
        } else {
          p2.appendChild(el('div', 'empty-hint', 'No wash-sale conflicts'));
        }
        two.appendChild(p2);

        const p3 = el('div', 'panel');
        p3.appendChild(el('div', 'panel-title', 'Harvest Capacity'));
        p3.appendChild(table(['Metric', 'Value'], [
          ['Remaining STCG offset', '₹' + fmtCompact(data.harvestCapacity.remainingSTCGOffset)],
          ['Remaining LTCG offset', '₹' + fmtCompact(data.harvestCapacity.remainingLTCGOffset)],
        ]));
        two.appendChild(p3);
        container.appendChild(two);
      },
    },

    {
      key: 'uc6', tag: 'M4-UC6', title: 'ESG & Mandate-Constrained Optimization', api: '/api/uc6',
      objective: 'Incorporate ESG scores, carbon limits, exclusions and tilts into portfolio construction without materially sacrificing return; output ESG-optimised weights, an ESG/carbon report, exclusion compliance and tracking error.',
      frs: ['FR-ES-01 ESG/carbon ingestion (Must)', 'FR-ES-02 Hard exclusions (Must)', 'FR-ES-03 ESG/carbon constraints (Must)', 'FR-ES-04 TE-controlled optimisation (Must)', 'FR-ES-05 ESG/carbon reporting (Must)', 'FR-ES-06 Frontier-shift cost (Should)'],
      render(container, data) {
        container.innerHTML = '';
        const r = data.esgCarbonReport;
        const metrics = el('div', 'metric-row');
        metrics.appendChild(metricCard('Portfolio ESG Score', r.portfolioEsg, r.esgConstraintMet ? 'meets min ' + r.esgMinConstraint : 'below min ' + r.esgMinConstraint));
        metrics.appendChild(metricCard('Portfolio Carbon Intensity', r.portfolioCarbon, r.carbonConstraintMet ? 'within max ' + r.carbonMaxConstraint : 'exceeds max ' + r.carbonMaxConstraint));
        metrics.appendChild(metricCard('Tracking Error vs Benchmark', fmtPct(data.trackingError)));
        metrics.appendChild(metricCard('Return Cost of ESG', fmtPct(data.esgReturnCost)));
        container.appendChild(metrics);

        const two = el('div', 'two-col');
        const p1 = el('div', 'panel');
        p1.appendChild(el('div', 'panel-title', 'ESG-Constrained Weights'));
        const cw = el('div', 'chart-wrap');
        p1.appendChild(cw);
        two.appendChild(p1);
        barChart(cw, data.esgWeights.filter((w) => w.weight > 0.001).map((w) => ({ label: w.security, value: w.weight })), { valueFormatter: fmtPct });

        const p2 = el('div', 'panel');
        p2.appendChild(el('div', 'panel-title', 'ESG vs Benchmark vs Unconstrained'));
        p2.appendChild(table(['Metric', 'ESG Portfolio', 'Benchmark', 'Unconstrained'], [
          ['ESG score', r.portfolioEsg, r.benchmarkEsg, r.unconstrainedEsg],
          ['Carbon intensity', r.portfolioCarbon, r.benchmarkCarbon, r.unconstrainedCarbon],
          ['Expected return', fmtPct(data.comparison.esgConstrained.return), '-', fmtPct(data.comparison.unconstrained.return)],
        ]));
        two.appendChild(p2);
        container.appendChild(two);

        const p3 = el('div', 'panel');
        p3.appendChild(el('div', 'panel-title', 'Exclusion Compliance'));
        p3.appendChild(el('p', null, `Excluded: ${data.exclusionCompliance.excludedNames.join(', ') || 'none'} — all zero-weight: ${data.exclusionCompliance.allZeroWeight ? tag('YES', 'ok') : tag('NO', 'breach')}`));
        container.appendChild(p3);

        const p4 = el('div', 'panel');
        p4.appendChild(el('div', 'panel-title', 'Residual Sector Tilts vs Benchmark'));
        p4.appendChild(table(['Sector', 'Tilt'], Object.entries(data.residualTilts).map(([k, v]) => [k, fmtPct(v)])));
        container.appendChild(p4);
      },
    },

    {
      key: 'uc7', tag: 'M4-UC7', title: 'Robo-Advisory Engine', api: '/api/uc7',
      objective: 'Automate risk profiling, model-portfolio assignment, SIP setup, rebalancing and goal tracking end-to-end; output a risk profile, model recommendation, rebalancing alerts and a goal dashboard.',
      frs: ['FR-RA-01 Risk scoring (Must)', 'FR-RA-02 Model assignment (Must)', 'FR-RA-03 SIP/funding plan (Must)', 'FR-RA-04 Orchestrated rebalancing (Must)', 'FR-RA-05 Goal/health tracking (Must)', 'FR-RA-06 Suitability audit trail (Must)', 'FR-RA-07 RM override (Should)'],
      render(container, data) {
        container.innerHTML = '';
        const rp = data.riskProfile, mr = data.modelRecommendation;
        const metrics = el('div', 'metric-row');
        metrics.appendChild(metricCard('Risk Category', rp.finalCategory + ' / 5', rp.overridden ? 'RM overridden' : 'system-scored'));
        metrics.appendChild(metricCard('Assigned Model', mr.modelName));
        metrics.appendChild(metricCard('Goals Tracked', data.goalDashboard.goals.length));
        metrics.appendChild(metricCard('Rebalancing Alerts', data.rebalancingAlerts.length));
        container.appendChild(metrics);

        const two = el('div', 'two-col');
        const p1 = el('div', 'panel');
        p1.appendChild(el('div', 'panel-title', 'Model Portfolio Weights (personalised)'));
        const cw = el('div', 'chart-wrap');
        p1.appendChild(cw);
        two.appendChild(p1);
        barChart(cw, Object.entries(mr.personalisedWeights).map(([k, v]) => ({ label: k, value: v })), { valueFormatter: fmtPct, max: 1 });

        const p2 = el('div', 'panel');
        p2.appendChild(el('div', 'panel-title', 'Risk Profile'));
        p2.appendChild(table(['Metric', 'Score'], [
          ['Tolerance', rp.tolerance], ['Capacity', rp.capacity], ['Final Category', rp.finalCategory],
        ]));
        two.appendChild(p2);
        container.appendChild(two);

        const p3 = el('div', 'panel');
        p3.appendChild(el('div', 'panel-title', 'Funding Plan (via UC1 goal-seek)'));
        p3.appendChild(table(['Goal', 'Horizon', 'Required Corpus', 'Required SIP', 'Suggested Step-up'], data.fundingPlan.map((f) => [
          f.goalName, f.horizonBucket, '₹' + fmtCompact(f.requiredCorpus), '₹' + fmtCompact(f.requiredMonthlySip) + '/mo', '₹' + fmtCompact(f.stepUpSuggested) + '/yr',
        ])));
        container.appendChild(p3);

        const p4 = el('div', 'panel');
        p4.appendChild(el('div', 'panel-title', 'Goal Dashboard'));
        p4.appendChild(table(['Goal', 'Funded Ratio', 'P(success)', 'Health', 'Status', 'Action'], data.goalDashboard.goals.map((g) => [
          g.goalName, fmtPct(g.fundedRatio), fmtPct(g.probability), g.healthScore + '/100',
          g.status === 'ON-TRACK' ? tag(g.status, 'ok') : tag(g.status, 'breach'), g.recommendedAction,
        ])));
        container.appendChild(p4);

        const p5 = el('div', 'panel');
        p5.appendChild(el('div', 'panel-title', 'Rebalancing Alerts (via UC4)'));
        if (data.rebalancingAlerts.length) {
          p5.appendChild(table(['Security', 'Drift', 'Recommended Action'], data.rebalancingAlerts.map((a) => [a.security, fmtPct(a.drift), a.recommendedAction])));
        } else {
          p5.appendChild(el('div', 'empty-hint', 'No drift alerts'));
        }
        container.appendChild(p5);

        const p6 = el('div', 'panel');
        p6.appendChild(el('div', 'panel-title', 'Audit Trail'));
        data.auditTrail.forEach((a) => {
          const item = el('div', 'audit-item');
          item.innerHTML = `<span class="audit-time">${new Date(a.timestamp).toLocaleString()}</span><strong>${a.action}</strong> — ${JSON.stringify(a.detail)}`;
          p6.appendChild(item);
        });
        container.appendChild(p6);
      },
    },
  ];

  global.WISUseCases = USE_CASES;
})(window);
