// Metadata + result-renderers for each M4 use case. Kept separate from app.js (shell/wiring)
// so each use case's rendering logic is easy to locate and extend.
//
// Every metric card / chart / table below carries an "info" string rendered as an (i) tooltip
// so nothing on screen is an unexplained number -- each one states what it is, how it's derived,
// and (where relevant) which functional requirement it satisfies.
(function (global) {
  const { barChart, bandChart, frontierChart, fmtCompact, fmtPct } = global.WISCharts;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function infoIcon(text) {
    const wrap = document.createElement('span');
    wrap.className = 'info-icon';
    wrap.textContent = 'i';
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('role', 'note');
    wrap.setAttribute('aria-label', text);
    const tip = document.createElement('span');
    tip.className = 'info-tooltip';
    tip.textContent = text;
    wrap.appendChild(tip);
    return wrap;
  }

  function metricCard(label, value, sub, info) {
    const card = el('div', 'metric-card');
    const labelRow = el('div', 'metric-label-row');
    labelRow.appendChild(el('span', 'metric-label', label));
    if (info) labelRow.appendChild(infoIcon(info));
    card.appendChild(labelRow);
    card.appendChild(el('div', 'metric-value', value));
    if (sub) card.appendChild(el('div', 'metric-sub', sub));
    return card;
  }

  function panelTitle(text, info) {
    const div = el('div', 'panel-title');
    div.appendChild(el('span', null, text));
    if (info) div.appendChild(infoIcon(info));
    return div;
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
      tour: [
        { fr: 'FR-GA-01', priority: 'Must Have', status: 'partial', selector: '#input-panel',
          requirement: 'Capture goals with target corpus, target date, priority and flexibility; support multiple concurrent goals per client.',
          achieved: 'The input JSON\'s goals[] array captures target corpus (targetAmount) and target date (horizonYears), and the model processes multiple concurrent goals (see the 3-goal sample). Gap: "priority" and "flexibility" fields are not yet captured or used by the allocation logic — every goal is currently treated with equal priority.' },
        { fr: 'FR-GA-02', priority: 'Must Have', status: 'full', selector: '#panel-uc1-goal-table',
          requirement: 'Bucket each goal into short / medium / long horizon and map to a glide-path allocation across equity, debt, gold, cash and international.',
          achieved: 'The "Horizon" column shows each goal\'s bucket (short <3y / medium 3–7y / long >7y). The recommended weights behind each row cover all 5 asset classes from a governed glide-path matrix, then clipped to the client\'s risk-category guardrails.' },
        { fr: 'FR-GA-03', priority: 'Must Have', status: 'full', selector: '#panel-uc1-goal-table',
          requirement: 'Compute a probability-of-success (goal-attainment) score per goal via forward simulation of the mapped allocation.',
          achieved: 'The "P(success)" and "Attainment Score" columns come from a forward Monte Carlo simulation of the mapped glide-path allocation against the required, inflation-adjusted corpus.' },
        { fr: 'FR-GA-04', priority: 'Must Have', status: 'partial', selector: '#panel-uc1-goal-table',
          requirement: 'Recommend asset-class weights and required monthly investment (SIP) to close any funding gap.',
          achieved: 'The "Required SIP" column is solved by goal-seek (bisection) to close the funding gap. Gap: the spec also allows closing the gap via an allocation shift; this prototype only solves via SIP, not by also adjusting the recommended weights.' },
        { fr: 'FR-GA-05', priority: 'Must Have', status: 'partial', selector: '#panel-uc1-triggers',
          requirement: 'Emit rebalancing triggers when realised allocation drifts beyond a configurable band or goal probability falls below threshold.',
          achieved: '"probability" triggers correctly fire when a goal\'s P(success) falls below your target. Gap: the "drift" trigger here checks household allocation against risk-guardrail edges as a proxy — it does not yet compare a client\'s realised (actual) holdings against recommended targets; that real drift check lives in M4-UC4 and isn\'t wired into UC1 itself.' },
        { fr: 'FR-GA-06', priority: 'Should Have', status: 'partial', selector: '#m-uc1-cma',
          requirement: 'Expose adjustable capital-market assumptions (expected return, volatility, correlation per asset class) with a governed default set.',
          achieved: 'A versioned, governed default assumption set (CMA-2026Q3-v1) is used and returned for audit. Gap: the API does not yet accept a custom assumption set in the request — assumptions are not adjustable per-call in this prototype.' },
        { fr: 'FR-GA-07', priority: 'Should Have', status: 'full', selector: '#panel-uc1-household',
          requirement: 'Return goal-level and household-level aggregated views (combined allocation across all goals).',
          achieved: 'Goal-level rows are shown in the table above; this chart is the household-level aggregation, weighted by each goal\'s required corpus.' },
      ],
      render(container, data) {
        container.innerHTML = '';
        const metrics = el('div', 'metric-row');
        metrics.appendChild(metricCard('Goals Modelled', data.goalAllocations.length, null,
          'Count of goals in your input JSON that were run through the horizon-bucketing + probability-of-success model (one row per goal below).'));
        const cmaCard = metricCard('CMA Version', data.assumptionSet.version, data.assumptionSet.effectiveDate,
          'Capital-market assumptions (expected return, volatility, correlation per asset class) used for every projection in this run — governed & version-stamped per FR-GA-06. Currently the illustrative sample set; replace with a licensed house view before production.');
        cmaCard.id = 'm-uc1-cma';
        metrics.appendChild(cmaCard);
        metrics.appendChild(metricCard('Rebalancing Triggers', data.rebalancingTriggers.length, null,
          'Count of goals whose success probability fell below target, or household asset-class weights sitting at a risk-guardrail edge — see the table below for which (FR-GA-05).'));
        container.appendChild(metrics);

        const panel1 = el('div', 'panel');
        panel1.id = 'panel-uc1-goal-table';
        panel1.appendChild(panelTitle('Goal Allocations',
          'Each row: horizon → governed glide-path allocation (FR-GA-02), then a forward Monte Carlo projection estimates the probability of meeting the inflation-adjusted required corpus (FR-GA-03). If that probability was below your target, the required monthly SIP was solved via goal-seek to lift it back to target (FR-GA-04) — a score of 100/100 means the solved SIP exactly reaches your target probability, not that the goal is risk-free.'));
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
        p2.id = 'panel-uc1-household';
        p2.appendChild(panelTitle('Household Allocation (aggregated across goals)',
          'Weighted average of each goal\'s recommended allocation, weighted by that goal\'s required corpus — larger goals pull the household mix more (FR-GA-07). Not a separate model; purely a roll-up of the rows above.'));
        const chart1 = el('div', 'chart-wrap');
        p2.appendChild(chart1);
        two.appendChild(p2);

        const p3 = el('div', 'panel');
        p3.id = 'panel-uc1-triggers';
        p3.appendChild(panelTitle('Rebalancing Triggers',
          '"probability" triggers fire when a goal\'s P(success) is below your targetSuccessProbability input. "drift" triggers fire when the household allocation for an asset class sits at the edge of its risk-category guardrail band.'));
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
        p4.appendChild(panelTitle('Scenario Wealth Paths (5th–95th percentile band, gold = median)',
          'A separate 500-path Monte Carlo run per goal (distinct from the probability-of-success calculation above, which uses its own simulation count) under the same capital-market assumptions and this goal\'s contribution schedule — shown to illustrate the dispersion of outcomes, not a single predicted number.'));
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
      tour: [
        { fr: 'FR-MC-01', priority: 'Must Have', status: 'partial', selector: '#m-uc2-paths',
          requirement: 'Simulate ≥10,000 paths over the plan horizon for both accumulation and decumulation phases.',
          achieved: 'The engine simulates both accumulation and decumulation phases correctly in a single path loop. Gap: the default pathCount is 3,000 (for interactive response time in this browser demo), below the spec\'s ≥10,000 minimum — raise pathCount in the input JSON to meet it; the model itself has no upper limit.' },
        { fr: 'FR-MC-02', priority: 'Must Have', status: 'partial', selector: '#panel-uc2-percentile',
          requirement: 'Incorporate stochastic returns (per asset class), inflation, contribution/withdrawal schedules, taxes and discrete spending shocks.',
          achieved: 'Stochastic inflation, a contribution/withdrawal schedule, a simplified tax drag, and discrete spending shocks (probability + size) are all implemented and visible in how the percentile bands widen over time. Gap: returns are drawn from a single blended portfolio-level mu/sigma per phase, not simulated per individual asset class with their own correlated paths each period.' },
        { fr: 'FR-MC-03', priority: 'Must Have', status: 'full', selector: '#m-uc2-success',
          requirement: 'Output probability of not depleting corpus (plan-success) and percentile terminal-wealth bands.',
          achieved: '"Plan Success Probability" is the direct share of simulated paths that never hit zero; the chart below shows the full percentile wealth trajectory including the terminal year, not just a single terminal band.' },
        { fr: 'FR-MC-04', priority: 'Must Have', status: 'full', selector: '#m-uc2-swr',
          requirement: 'Derive a sustainable / safe withdrawal rate for a target success probability.',
          achieved: '"Safe Withdrawal Rate" is solved by bisection: repeatedly re-running the simulation at candidate withdrawal rates until success probability matches your target.' },
        { fr: 'FR-MC-05', priority: 'Should Have', status: 'partial', selector: '#m-uc2-seq',
          requirement: 'Support sequence-of-returns risk analysis and stress overlays (early bad-return years).',
          achieved: '"Sequence-Risk Delta" compares success probability when the same simulated returns are ordered worst-first vs. worst-last — a direct sequence-of-returns risk test. Gap: there is no separate, user-configurable "stress overlay" toggle beyond this built-in reordering test.' },
        { fr: 'FR-MC-06', priority: 'Should Have', status: 'partial', selector: '#panel-uc2-percentile',
          requirement: 'Allow return model selection (i.i.d. normal, block bootstrap of historical, regime-switching).',
          achieved: 'The run manifest below records which return model was used for this run. Gap: only i.i.d. normal is implemented; block-bootstrap-of-historical and regime-switching return models are not yet available as selectable options.' },
      ],
      render(container, data) {
        container.innerHTML = '';
        const metrics = el('div', 'metric-row');
        const successCard = metricCard('Plan Success Probability', fmtPct(data.successProbability), null,
          `Share of ${data.runManifest.pathCount.toLocaleString()} simulated lifetime paths where the corpus never hit zero before the plan horizon ended (FR-MC-03). This is a direct count, not an estimate.`);
        successCard.id = 'm-uc2-success';
        metrics.appendChild(successCard);
        const swrCard = metricCard('Safe Withdrawal Rate', fmtPct(data.safeWithdrawalRate, 2), null,
          'Highest annual withdrawal, as a % of the corpus at retirement, that keeps plan-success probability at or above your target — found by bisection search re-running the simulation at each candidate rate (FR-MC-04).');
        swrCard.id = 'm-uc2-swr';
        metrics.appendChild(swrCard);
        const seqCard = metricCard('Sequence-Risk Delta', fmtPct(data.sequenceRiskDelta, 1), 'back-loaded vs front-loaded bad years',
          'Success-probability difference between two orderings of the same simulated returns: worst years placed late in retirement vs. worst years placed early. A large positive number means the plan is sensitive to bad luck early in decumulation (FR-MC-05).');
        seqCard.id = 'm-uc2-seq';
        metrics.appendChild(seqCard);
        const pathsCard = metricCard('Paths Simulated', data.runManifest.pathCount, null,
          'Number of Monte Carlo paths run for this result. The spec targets ≥10,000 (FR-MC-01); this prototype defaults lower for interactive response time — raise pathCount in the input JSON for a production-fidelity run.');
        pathsCard.id = 'm-uc2-paths';
        metrics.appendChild(pathsCard);
        container.appendChild(metrics);

        const p1 = el('div', 'panel');
        p1.id = 'panel-uc2-percentile';
        p1.appendChild(panelTitle('Percentile Wealth Trajectory (accumulation → decumulation)',
          'At each year, the 5th/25th/50th/75th/95th percentile of simulated wealth across all paths — not 5 separate forecasts, but percentiles cut from the same path set used for the success-probability metric above.'));
        const cw = el('div', 'chart-wrap');
        p1.appendChild(cw);
        container.appendChild(p1);
        bandChart(cw, data.percentileWealthPaths, { height: 280, xLabel: (i) => 'Yr ' + i });

        const two = el('div', 'two-col');
        const p2 = el('div', 'panel');
        p2.appendChild(panelTitle('Depletion Age Distribution (failed paths only)',
          'Computed only from paths where the corpus actually hit zero; "age" here is accumulation-years plus the simulated year of depletion within that path.'));
        if (data.depletionAgeDist.count) {
          p2.appendChild(table(['Failed Paths', 'Earliest Depletion (yr)', 'Median', 'Latest'], [[
            data.depletionAgeDist.count, data.depletionAgeDist.min, data.depletionAgeDist.median, data.depletionAgeDist.max,
          ]]));
        } else {
          p2.appendChild(el('div', 'empty-hint', 'No paths depleted the corpus'));
        }
        two.appendChild(p2);

        const p3 = el('div', 'panel');
        p3.appendChild(panelTitle('Run Manifest (audit)',
          'Every field needed to reproduce this exact result: same seed + same assumption version regenerates identical paths — required for the audit trail this use case must support.'));
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
      tour: [
        { fr: 'FR-MV-01', priority: 'Must Have', status: 'full', selector: '#panel-uc3-weights',
          requirement: 'Solve mean-variance optimisation for a given objective (max Sharpe, min variance, target return) with long-only and box constraints.',
          achieved: 'These weights come from a real constrained optimizer (projected-gradient ascent on the selected objective). Long-only (weight ≥ 0) and box constraints (weight ≤ boxMax) are both enforced by projection every iteration — "Feasibility" on the trade-list panel confirms it.' },
        { fr: 'FR-MV-02', priority: 'Must Have', status: 'full', selector: '#panel-uc3-weights',
          requirement: 'Support Black-Litterman blending of equilibrium returns with house/analyst views and view confidence.',
          achieved: 'The panel title shows "black-litterman-blended" when useBlackLitterman is on — the return estimates feeding these weights are house-view priors blended with your supplied views[], weighted by each view\'s confidence via the standard Black-Litterman formula.' },
        { fr: 'FR-MV-03', priority: 'Must Have', status: 'partial', selector: '#m-uc3-vol',
          requirement: 'Apply robust / shrinkage covariance estimation to stabilise weights (e.g. Ledoit-Wolf).',
          achieved: 'Volatility is computed from a covariance matrix shrunk toward a diagonal target (Ledoit-Wolf-style) before optimizing. Gap: the shrinkage intensity is a user-supplied parameter (shrinkageIntensity), not automatically estimated as optimal the way a full Ledoit-Wolf implementation would.' },
        { fr: 'FR-MV-04', priority: 'Must Have', status: 'full', selector: '#panel-uc3-factors',
          requirement: 'Enforce factor exposure targets/limits (value, quality, momentum, size, low-vol) and sector/single-name caps.',
          achieved: 'All 5 factors are tracked and constrainable via factorTargets; sector caps (sectorCaps) and single-name caps (boxMax) are enforced via the same penalty-gradient mechanism as the long-only constraint.' },
        { fr: 'FR-MV-05', priority: 'Must Have', status: 'full', selector: '#panel-uc3-frontier',
          requirement: 'Return the efficient frontier and the current portfolio\'s position relative to it.',
          achieved: '13 real re-optimizations at different target returns trace this frontier; the red "Current" marker plots your supplied currentHoldings on the same risk/return axes for direct comparison.' },
        { fr: 'FR-MV-06', priority: 'Must Have', status: 'full', selector: '#panel-uc3-trades',
          requirement: 'Generate a trade list (deltas from current holdings) with turnover and estimated cost.',
          achieved: 'Each row is optimal weight − current weight; the "Turnover" and "Estimated Cost" metric cards above sum these deltas and their cost estimates across the whole list.' },
        { fr: 'FR-MV-07', priority: 'Should Have', status: 'partial', selector: '#m-uc3-turnover',
          requirement: 'Support transaction-cost-aware and turnover-constrained optimisation.',
          achieved: 'Turnover-constrained optimisation is implemented (turnoverCap penalises solutions exceeding your cap). Gap: transaction cost is only estimated after the optimum is found, not fed into the optimization objective itself — so the optimizer is turnover-aware but not yet fully cost-aware during the solve.' },
      ],
      render(container, data) {
        container.innerHTML = '';
        const m = data.riskMetrics;
        const metrics = el('div', 'metric-row');
        metrics.appendChild(metricCard('Expected Return', fmtPct(m.expectedReturn), null,
          'Weighted-average expected return of the optimal portfolio: Σ(weight × expected return), using the return estimates shown as "muUsed" below (house view, or Black-Litterman-blended if enabled).'));
        const volCard = metricCard('Volatility', fmtPct(m.volatility), null,
          'Portfolio standard deviation from the shrinkage-adjusted covariance matrix: √(wᵀΣw). Shrinkage (FR-MV-03) pulls the raw sample covariance toward a stable diagonal target to reduce estimation noise.');
        volCard.id = 'm-uc3-vol';
        metrics.appendChild(volCard);
        metrics.appendChild(metricCard('Sharpe Ratio', m.sharpe.toFixed(2), null,
          '(Expected return − risk-free rate) ÷ volatility — the standard risk-adjusted return measure this optimizer maximises when objective = "maxSharpe".'));
        const turnoverCard = metricCard('Turnover', fmtPct(m.turnover), null,
          'Sum of absolute weight changes between your supplied currentHoldings and the optimal weights — a direct proxy for how much trading is required to reach this portfolio (FR-MV-07).');
        turnoverCard.id = 'm-uc3-turnover';
        metrics.appendChild(turnoverCard);
        metrics.appendChild(metricCard('Diversification Ratio', m.diversificationRatio.toFixed(2), null,
          'Weighted-average of each holding\'s own volatility, divided by the portfolio\'s actual volatility. A ratio above 1 means diversification is reducing risk below what you\'d get if the holdings moved in lockstep — higher is more diversified.'));
        container.appendChild(metrics);

        const two = el('div', 'two-col');
        const p1 = el('div', 'panel');
        p1.id = 'panel-uc3-weights';
        p1.appendChild(panelTitle('Optimal Weights (' + data.muUsed + ')',
          data.muUsed === 'black-litterman-blended'
            ? 'Return estimates are the house-view priors blended with your supplied views, weighted by each view\'s confidence (FR-MV-02), before optimizing.'
            : 'Return estimates are the sample universe\'s house-view priors directly (no Black-Litterman blending applied — set useBlackLitterman:true in the input to enable it).'));
        const cw1 = el('div', 'chart-wrap');
        p1.appendChild(cw1);
        two.appendChild(p1);

        const p2 = el('div', 'panel');
        p2.id = 'panel-uc3-frontier';
        p2.appendChild(panelTitle('Efficient Frontier',
          'Each point is a separate constrained optimization solved for a different target return, sweeping from the universe\'s lowest to highest expected return (FR-MV-05) — 13 real re-solves, not interpolated or decorative points.'));
        const cw2 = el('div', 'chart-wrap');
        p2.appendChild(cw2);
        two.appendChild(p2);
        container.appendChild(two);

        barChart(cw1, data.optimalWeights.filter((w) => w.weight > 0.001).map((w) => ({ label: w.security, value: w.weight })), { valueFormatter: fmtPct, max: Math.max(...data.optimalWeights.map((w) => w.weight)) });
        frontierChart(cw2, data.efficientFrontier, data.currentPortfolio, { risk: m.volatility, return: m.expectedReturn });

        const p3 = el('div', 'panel');
        p3.id = 'panel-uc3-factors';
        p3.appendChild(panelTitle('Factor Report',
          'Weighted-average factor loading of the optimal portfolio: Σ(weight × security\'s factor score) per factor (FR-MV-04). Positive = tilted toward that factor; these are illustrative factor scores, not licensed fundamentals-derived loadings.'));
        p3.appendChild(table(['Factor', 'Portfolio Exposure'], Object.entries(data.factorReport).map(([k, v]) => [k, v.toFixed(2)])));
        container.appendChild(p3);

        const p4 = el('div', 'panel');
        p4.id = 'panel-uc3-trades';
        p4.appendChild(panelTitle(`Trade List (${data.tradeList.length} trades, feasible: ${data.feasibility.boxSatisfied && data.feasibility.sectorCapsSatisfied})`,
          'Delta = optimal weight − current weight for each security with a non-zero change (FR-MV-06). Est. cost (bps) = |delta| × your transactionCostBps input, scaled per security. "Feasible" confirms box and sector-cap constraints are satisfied within tolerance.'));
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
      tour: [
        { fr: 'FR-RB-01', priority: 'Must Have', status: 'partial', selector: '#panel-uc4-drift',
          requirement: 'Continuously monitor realised vs target weights and flag drift beyond configurable absolute/relative bands.',
          achieved: 'The drift calculation itself (|current − target| vs. driftBandAbs/driftBandRel) is fully implemented and shown per security. Gap: "continuously" implies a running scheduler/monitor — this prototype computes drift only when you click Run; there is no background polling or streaming check yet.' },
        { fr: 'FR-RB-02', priority: 'Must Have', status: 'partial', selector: '#m-uc4-trig',
          requirement: 'Support calendar, threshold and hybrid (threshold-with-calendar-check) rebalancing policies.',
          achieved: '"calendar" (always rebalance) and "threshold" (only on breach) policies are both implemented and selectable via the policy input. Gap: "hybrid" (threshold-with-calendar-check) is not yet a distinct third mode.' },
        { fr: 'FR-RB-03', priority: 'Must Have', status: 'partial', selector: '#panel-uc4-tradelist',
          requirement: 'Generate a trade list that restores target weights while minimising transaction cost and tax realised.',
          achieved: 'The trade list restores target weights and orders lot sales to minimise tax (loss lots first, then long-term gains, then short-term gains last). Gap: this is a tax-priority heuristic, not a formal joint optimisation minimising a combined cost+tax objective the way the spec\'s formula (min Σcost·|trade| + κ·tax) describes.' },
        { fr: 'FR-RB-04', priority: 'Must Have', status: 'full', selector: '#panel-uc4-tradelist',
          requirement: 'Prioritise cash-flow / new-contribution rebalancing before sell-side trades where possible.',
          achieved: 'Trades tagged source: "cashflow" are generated first, buying the most-underweight securities with your supplied cashflow amount before any sell-side trade is considered.' },
        { fr: 'FR-RB-05', priority: 'Must Have', status: 'full', selector: '#m-uc4-tax',
          requirement: 'Compute estimated tax impact (STCG/LTCG) of the proposed rebalance and offer a tax-aware alternative.',
          achieved: '"Estimated Tax Impact" sums STCG/LTCG on every realised gain in the trade list; the "Tax-Deferred Alternative" panel below offers a lower-tax variant that skips sell-side trades entirely.' },
        { fr: 'FR-RB-06', priority: 'Should Have', status: 'partial', selector: '#m-uc4-cost',
          requirement: 'Respect no-trade bands, lot sizes and minimum trade thresholds to avoid churn.',
          achieved: 'Minimum trade thresholds (minTradeValue) are enforced — trades below this size are skipped. Gap: lot-size rounding (e.g. tradeable board lots) is not enforced; trade quantities can be fractional.' },
      ],
      render(container, data) {
        container.innerHTML = '';
        const metrics = el('div', 'metric-row');
        const trigCard = metricCard('Rebalance Triggered', data.rebalanceTriggered ? 'Yes' : 'No', null,
          `Policy = "${data.policy}". Under "threshold" this fires only if any security's drift breaches its band; under "calendar" it always fires on this scheduled check (FR-RB-02).`);
        trigCard.id = 'm-uc4-trig';
        metrics.appendChild(trigCard);
        metrics.appendChild(metricCard('Trades Proposed', data.tradeList.length, null,
          'Count of buy/sell lines in the trade list below, after cash-flow-first allocation and tax-lot selection.'));
        const taxCard = metricCard('Estimated Tax Impact', '₹' + fmtCompact(data.taxImpact.totalTax), null,
          'Sum of tax on realised gains across the sell trades below: gain per lot × its STCG or LTCG rate by holding period (FR-RB-05). Loss lots and lots inside the exemption contribute ₹0.');
        taxCard.id = 'm-uc4-tax';
        metrics.appendChild(taxCard);
        const costCard = metricCard('Estimated Cost', '₹' + fmtCompact(data.costEstimate), null,
          'Sum of transaction-cost estimates (trade amount × transactionCostBps) across every trade in the list — the friction cost of executing this rebalance.');
        costCard.id = 'm-uc4-cost';
        metrics.appendChild(costCard);
        container.appendChild(metrics);

        const p1 = el('div', 'panel');
        p1.id = 'panel-uc4-drift';
        p1.appendChild(panelTitle('Drift Alerts vs Target',
          'Drift = current weight − target weight per security. Breach = |drift| exceeds your driftBandAbs, or the relative drift exceeds driftBandRel (FR-RB-01). Only breached securities generate sell-side trades below.'));
        p1.appendChild(table(['Security', 'Current Wt', 'Target Wt', 'Drift', 'Breach'], data.driftAlerts.map((d) => [
          d.security, fmtPct(d.currentWeight), fmtPct(d.targetWeight), fmtPct(d.drift), d.breach ? tag('BREACH', 'breach') : tag('OK', 'ok'),
        ])));
        container.appendChild(p1);

        const p2 = el('div', 'panel');
        p2.id = 'panel-uc4-tradelist';
        p2.appendChild(panelTitle('Prioritised Trade List',
          'Order of operations (FR-RB-04): (1) any incoming cashflow buys the most-underweight securities first, reducing sell-side need; (2) remaining overweight positions are trimmed, selling loss lots first, then long-term gains, then short-term gains last, to minimise realised tax.'));
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
        p3.appendChild(panelTitle('Post-Trade Weights',
          'Current weights with the trade list above applied (buys add value, sells subtract it), then renormalised to 100% — this is what the portfolio looks like immediately after execution, before any market movement.'));
        const cw = el('div', 'chart-wrap');
        p3.appendChild(cw);
        two.appendChild(p3);
        barChart(cw, Object.entries(data.postTradeWeights).map(([k, v]) => ({ label: k, value: v })), { valueFormatter: fmtPct, max: 1 });

        const p4 = el('div', 'panel');
        p4.appendChild(panelTitle('Tax-Deferred Alternative',
          'A lower-tax variant that keeps only the cash-flow-funded buys and skips every sell-side trade — for comparison against the primary trade list when you want to weigh "rebalance now" against "rebalance gradually via future contributions" (FR-RB-05).'));
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
      tour: [
        { fr: 'FR-TL-01', priority: 'Must Have', status: 'full', selector: '#panel-uc5-pairs',
          requirement: 'Identify lots with unrealised losses eligible for harvesting, ranked by tax benefit.',
          achieved: 'Rows are sorted by tax benefit (|unrealised loss| × applicable STCG/LTCG rate) — "Loss Lots Found" counts how many lots crossed your minHarvestableLoss threshold.' },
        { fr: 'FR-TL-02', priority: 'Must Have', status: 'full', selector: '#panel-uc5-pairs',
          requirement: 'Propose replacement securities that maintain factor/sector exposure and low tracking error to the sold position.',
          achieved: 'The "Replacement" column picks the same-asset-class security with the best factor-similarity-minus-tracking-error score. Note: similarity/tracking-error use illustrative proxy formulas in this prototype (no licensed fundamentals/return-history feed yet) — see the note banner — but the selection logic itself is real.' },
        { fr: 'FR-TL-03', priority: 'Must Have', status: 'partial', selector: '#panel-uc5-compliance',
          requirement: 'Enforce wash-sale / bed-and-breakfasting rules and any regulatory holding constraints for the applicable regime.',
          achieved: 'The wash-sale gate correctly blocks harvesting a lot if it appears in the recentlyPurchased list within your washSaleWindowDays. Gap: this prototype checks only against a list you supply per request — it does not yet persist its own sell history across runs to automatically enforce the restriction window on future calls, as the spec\'s core logic describes.' },
        { fr: 'FR-TL-04', priority: 'Must Have', status: 'full', selector: '#m-uc5-alpha',
          requirement: 'Compute realised loss, offset against gains (STCG/LTCG buckets) and resulting tax saved (tax alpha).',
          achieved: '"YTD Tax Alpha" = harvested short-term loss × STCG rate + harvested long-term loss × LTCG rate, netted against your supplied realizedGainsYTD by bucket.' },
        { fr: 'FR-TL-05', priority: 'Must Have', status: 'partial', selector: '#panel-uc5-capacity',
          requirement: 'Track YTD harvested losses, carry-forward and remaining harvesting capacity.',
          achieved: 'Remaining STCG/LTCG offset capacity for this run is computed correctly from your input. Gap: because this prototype is stateless per request, YTD totals and carry-forward are not persisted between calls — each run needs last-known figures passed in via realizedGainsYTD.' },
        { fr: 'FR-TL-06', priority: 'Should Have', status: 'partial', selector: '#m-uc5-found',
          requirement: 'Respect minimum trade sizes and avoid degrading the portfolio\'s target allocation.',
          achieved: 'minHarvestableLoss acts as the minimum trade-size filter. Gap: "avoid degrading target allocation" is not enforced as an explicit guardrail — the allocationDelta output is reported but nothing currently blocks a harvest that would push the portfolio meaningfully off its target mix.' },
      ],
      render(container, data) {
        container.innerHTML = '';
        const r = data.harvestReport;
        const metrics = el('div', 'metric-row');
        const foundCard = metricCard('Loss Lots Found', r.lossLotsFound, null,
          'Lots where (current price − cost basis) × quantity is negative and exceeds your minHarvestableLoss threshold, out of ' + r.lotsScanned + ' lots scanned (FR-TL-01).');
        foundCard.id = 'm-uc5-found';
        metrics.appendChild(foundCard);
        metrics.appendChild(metricCard('Lots Harvested', r.lossLotsHarvested, null,
          'Of the loss lots found, the number actually proposed for harvesting — excludes any blocked by the wash-sale compliance gate below (FR-TL-03).'));
        metrics.appendChild(metricCard('Total Realised Loss', '₹' + fmtCompact(r.totalRealizedLoss), null,
          'Sum of unrealised losses across harvested lots, split into short-term vs long-term buckets for offset purposes.'));
        const alphaCard = metricCard('YTD Tax Alpha', '₹' + fmtCompact(data.ytdTaxAlpha), null,
          'Tax actually saved: harvested short-term loss × STCG rate + harvested long-term loss × LTCG rate (FR-TL-04) — the direct financial benefit of this harvest.');
        alphaCard.id = 'm-uc5-alpha';
        metrics.appendChild(alphaCard);
        container.appendChild(metrics);

        const p1 = el('div', 'panel');
        p1.id = 'panel-uc5-pairs';
        p1.appendChild(panelTitle('Sell / Replacement Pairs',
          'Ranked by tax benefit (|loss| × applicable rate) per FR-TL-01. Replacement is the same-asset-class security with the highest factor-similarity score minus a tracking-error penalty, so the portfolio\'s risk/factor profile is preserved after the swap (FR-TL-02). Similarity/TE are illustrative proxies here — see the note banner above.'));
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
        p2.id = 'panel-uc5-compliance';
        p2.appendChild(panelTitle('Compliance Flags',
          'A loss lot is blocked here if the same security was repurchased inside the wash-sale window (washSaleWindowDays) you supplied — this use case will not propose a wash-sale-violating trade (FR-TL-03).'));
        if (data.complianceFlags.length) {
          p2.appendChild(table(['Security', 'Type', 'Message'], data.complianceFlags.map((f) => [f.security, tag(f.type, 'breach'), f.message])));
        } else {
          p2.appendChild(el('div', 'empty-hint', 'No wash-sale conflicts'));
        }
        two.appendChild(p2);

        const p3 = el('div', 'panel');
        p3.id = 'panel-uc5-capacity';
        p3.appendChild(panelTitle('Harvest Capacity',
          'Realised gains YTD (your input) minus the losses just harvested against each bucket — the offsettable gains remaining this year, tracked so future harvests don\'t double-count capacity (FR-TL-05).'));
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
      tour: [
        { fr: 'FR-ES-01', priority: 'Must Have', status: 'full', selector: '#panel-uc6-weights',
          requirement: 'Ingest per-security ESG scores and carbon-intensity data and attach to the investable universe.',
          achieved: 'Every security in the sample universe carries an esg and carbon field, used directly in the weighted-average calculations shown throughout this page. Note: scores are illustrative sample data, not a live MSCI ESG/Sustainalytics feed — see the note banner.' },
        { fr: 'FR-ES-02', priority: 'Must Have', status: 'full', selector: '#panel-uc6-exclusion',
          requirement: 'Apply hard exclusions (sector/activity/name) and produce an exclusion-compliance report.',
          achieved: 'Excluded securities get their upper bound forced to 0 before optimizing (a hard constraint, not a soft preference); this panel confirms they received exactly zero weight in the result.' },
        { fr: 'FR-ES-03', priority: 'Must Have', status: 'partial', selector: '#m-uc6-esg',
          requirement: 'Support ESG tilts and a portfolio-level minimum ESG score and/or maximum carbon-intensity constraint.',
          achieved: 'Portfolio-level esgMin and carbonMax constraints are both implemented and enforced via penalty gradients — see the "meets min" / "within max" badges. Gap: the tiltTargets input (for directional over/under-weight tilts beyond a simple floor/ceiling) is accepted by the API but not yet applied inside the optimizer.' },
        { fr: 'FR-ES-04', priority: 'Must Have', status: 'full', selector: '#m-uc6-te',
          requirement: 'Optimise subject to ESG constraints while controlling tracking error to a benchmark.',
          achieved: '"Tracking Error vs Benchmark" is penalised during the same optimisation pass as the ESG/carbon constraints — all three are enforced together, not solved as separate sequential steps.' },
        { fr: 'FR-ES-05', priority: 'Must Have', status: 'full', selector: '#panel-uc6-comparison',
          requirement: 'Report ESG/carbon exposure of the resulting portfolio vs benchmark and vs the unconstrained optimum.',
          achieved: 'This table runs all three portfolios (ESG-constrained, benchmark, and a fresh unconstrained M4-UC3-style optimum) side by side for direct comparison.' },
        { fr: 'FR-ES-06', priority: 'Should Have', status: 'partial', selector: '#m-uc6-cost',
          requirement: 'Quantify the return/risk cost of ESG constraints (ESG efficient-frontier shift).',
          achieved: '"Return Cost of ESG" quantifies the expected-return gap between the unconstrained and ESG-constrained optimum — a single-point cost measure. Gap: the spec\'s phrase "efficient-frontier shift" implies comparing full frontiers (like M4-UC3\'s chart) under both regimes; this prototype reports one scalar rather than two overlaid frontiers.' },
      ],
      render(container, data) {
        container.innerHTML = '';
        const r = data.esgCarbonReport;
        const metrics = el('div', 'metric-row');
        const esgCard = metricCard('Portfolio ESG Score', r.portfolioEsg, r.esgConstraintMet ? 'meets min ' + r.esgMinConstraint : 'below min ' + r.esgMinConstraint,
          'Weighted-average ESG score of the optimized portfolio: Σ(weight × security ESG score) (FR-ES-01), checked against your esgMin constraint (FR-ES-03). Scores are illustrative sample data, not a licensed ESG provider feed.');
        esgCard.id = 'm-uc6-esg';
        metrics.appendChild(esgCard);
        metrics.appendChild(metricCard('Portfolio Carbon Intensity', r.portfolioCarbon, r.carbonConstraintMet ? 'within max ' + r.carbonMaxConstraint : 'exceeds max ' + r.carbonMaxConstraint,
          'Weighted-average carbon intensity of the optimized portfolio, checked against your carbonMax constraint — the optimizer penalises any solution that breaches this cap (FR-ES-03).'));
        const teCard = metricCard('Tracking Error vs Benchmark', fmtPct(data.trackingError), null,
          '√((w − w_benchmark)ᵀ Σ (w − w_benchmark)) — how far the ESG-constrained portfolio\'s risk profile deviates from the benchmark, capped by your teMax input (FR-ES-04).');
        teCard.id = 'm-uc6-te';
        metrics.appendChild(teCard);
        const costCard = metricCard('Return Cost of ESG', fmtPct(data.esgReturnCost), null,
          'Expected return of the unconstrained (return-only) optimum minus the expected return of the ESG-constrained optimum — the return you give up, at comparable risk, to satisfy the ESG/exclusion constraints (FR-ES-06).');
        costCard.id = 'm-uc6-cost';
        metrics.appendChild(costCard);
        container.appendChild(metrics);

        const two = el('div', 'two-col');
        const p1 = el('div', 'panel');
        p1.id = 'panel-uc6-weights';
        p1.appendChild(panelTitle('ESG-Constrained Weights',
          'The optimizer\'s solution after applying exclusions (zero weight, see below) plus the ESG-score, carbon-intensity and tracking-error constraints together — not the same weights as the plain M4-UC3 optimum.'));
        const cw = el('div', 'chart-wrap');
        p1.appendChild(cw);
        two.appendChild(p1);
        barChart(cw, data.esgWeights.filter((w) => w.weight > 0.001).map((w) => ({ label: w.security, value: w.weight })), { valueFormatter: fmtPct });

        const p2 = el('div', 'panel');
        p2.id = 'panel-uc6-comparison';
        p2.appendChild(panelTitle('ESG vs Benchmark vs Unconstrained',
          'Three separate computations side by side: this ESG-constrained portfolio, the sample benchmark\'s own weighted ESG/carbon, and what M4-UC3\'s unconstrained optimizer would pick with no ESG limits at all (FR-ES-05) — lets you see exactly what the constraints changed.'));
        p2.appendChild(table(['Metric', 'ESG Portfolio', 'Benchmark', 'Unconstrained'], [
          ['ESG score', r.portfolioEsg, r.benchmarkEsg, r.unconstrainedEsg],
          ['Carbon intensity', r.portfolioCarbon, r.benchmarkCarbon, r.unconstrainedCarbon],
          ['Expected return', fmtPct(data.comparison.esgConstrained.return), '-', fmtPct(data.comparison.unconstrained.return)],
        ]));
        two.appendChild(p2);
        container.appendChild(two);

        const p3 = el('div', 'panel');
        p3.id = 'panel-uc6-exclusion';
        p3.appendChild(panelTitle('Exclusion Compliance',
          'Confirms every security on your exclusions list received exactly zero weight in the optimizer\'s solution (FR-ES-02) — a hard constraint, not a preference the optimizer can trade off.'));
        p3.appendChild(el('p', null, `Excluded: ${data.exclusionCompliance.excludedNames.join(', ') || 'none'} — all zero-weight: ${data.exclusionCompliance.allZeroWeight ? tag('YES', 'ok') : tag('NO', 'breach')}`));
        container.appendChild(p3);

        const p4 = el('div', 'panel');
        p4.appendChild(panelTitle('Residual Sector Tilts vs Benchmark',
          'ESG portfolio\'s sector weight minus the benchmark\'s sector weight, per sector — surfaces unintended sector bets caused by exclusions/ESG tilts rather than a deliberate view (e.g. excluding a name can concentrate the remainder in its sector peers).'));
        p4.appendChild(table(['Sector', 'Tilt'], Object.entries(data.residualTilts).map(([k, v]) => [k, fmtPct(v)])));
        container.appendChild(p4);
      },
    },

    {
      key: 'uc7', tag: 'M4-UC7', title: 'Robo-Advisory Engine', api: '/api/uc7',
      objective: 'Automate risk profiling, model-portfolio assignment, SIP setup, rebalancing and goal tracking end-to-end; output a risk profile, model recommendation, rebalancing alerts and a goal dashboard.',
      frs: ['FR-RA-01 Risk scoring (Must)', 'FR-RA-02 Model assignment (Must)', 'FR-RA-03 SIP/funding plan (Must)', 'FR-RA-04 Orchestrated rebalancing (Must)', 'FR-RA-05 Goal/health tracking (Must)', 'FR-RA-06 Suitability audit trail (Must)', 'FR-RA-07 RM override (Should)'],
      tour: [
        { fr: 'FR-RA-01', priority: 'Must Have', status: 'full', selector: '#panel-uc7-profile',
          requirement: 'Score a risk profile from a questionnaire combining risk tolerance and capacity into a risk category.',
          achieved: 'Tolerance and Capacity are each averaged from your questionnaire responses; Final Category = min(tolerance, capacity) rounded to a 1–5 band, so low actual capacity caps an aggressive tolerance score rather than being overridden by it.' },
        { fr: 'FR-RA-02', priority: 'Must Have', status: 'partial', selector: '#m-uc7-model',
          requirement: 'Assign a model portfolio matching risk category and goals from a governed model-portfolio set.',
          achieved: 'The assigned model is looked up from a governed, versioned library keyed by risk category. Gap: the lookup is by risk category only — the spec also says "and goals", but goal characteristics (e.g. a very short-horizon goal) don\'t yet influence which model is assigned.' },
        { fr: 'FR-RA-03', priority: 'Must Have', status: 'partial', selector: '#panel-uc7-funding',
          requirement: 'Generate SIP schedule and initial allocation to reach goals; support step-up SIPs.',
          achieved: 'Required SIP per goal is solved via the same goal-seek engine as M4-UC1 (reused, not reimplemented). Gap: "Suggested Step-up" is a flat illustrative 10%/year figure rather than a solved or configurable step-up schedule.' },
        { fr: 'FR-RA-04', priority: 'Must Have', status: 'partial', selector: '#panel-uc7-rebalance',
          requirement: 'Orchestrate periodic rebalancing (via M4-UC4) and drift/goal alerts.',
          achieved: 'This panel is produced by calling the real M4-UC4 rebalancing engine, not a separate copy of the logic — the orchestration wiring is real. Gap: without an explicit target-weight input for this client, the check compares holdings against their own current weights as a placeholder baseline, so it will rarely show a breach; supply real targetWeights for a meaningful check. "Periodic" scheduling is also not implemented — this fires on demand only.' },
        { fr: 'FR-RA-05', priority: 'Must Have', status: 'full', selector: '#panel-uc7-dashboard',
          requirement: 'Track goal progress and portfolio health; surface actions when off-track.',
          achieved: 'Each row\'s Status (ON-TRACK/OFF-TRACK) and Action are computed directly from the goal\'s probability-of-success versus your target — off-track goals get an explicit "increase SIP to ₹X" recommendation.' },
        { fr: 'FR-RA-06', priority: 'Must Have', status: 'partial', selector: '#panel-uc7-audit',
          requirement: 'Provide suitability & risk disclosures and an audit trail of recommendations.',
          achieved: 'Every recommendation step is timestamped and logged in this audit trail. Gap: this is request-scoped (lost when the process restarts) rather than durably persisted, and the actual suitability disclosure content / Module 9 integration referenced by the spec is out of this module\'s scope and not implemented here.' },
        { fr: 'FR-RA-07', priority: 'Should Have', status: 'full', selector: '#m-uc7-risk',
          requirement: 'Support RM-assisted override with logged rationale.',
          achieved: 'Passing rmOverride: {category, rationale} in the input overrides the system-scored category — try it in the JSON editor — and logs the override with its rationale as a distinct audit-trail entry.' },
      ],
      render(container, data) {
        container.innerHTML = '';
        const rp = data.riskProfile, mr = data.modelRecommendation;
        const metrics = el('div', 'metric-row');
        const riskCard = metricCard('Risk Category', rp.finalCategory + ' / 5', rp.overridden ? 'RM overridden' : 'system-scored',
          'min(average tolerance score, average capacity score) from your questionnaire responses, rounded to the nearest 1–5 band — capacity caps tolerance so an aggressive-minded client with low actual capacity is not over-allocated to risk (FR-RA-01).');
        riskCard.id = 'm-uc7-risk';
        metrics.appendChild(riskCard);
        const modelCard = metricCard('Assigned Model', mr.modelName, null,
          'The governed model portfolio mapped to this risk category (FR-RA-02) — see the weights chart below. This is a fixed library lookup, not re-optimized per client.');
        modelCard.id = 'm-uc7-model';
        metrics.appendChild(modelCard);
        metrics.appendChild(metricCard('Goals Tracked', data.goalDashboard.goals.length, null,
          'Number of goals from your input, each run through the M4-UC1 goal-allocation model to produce the funding plan and dashboard rows below (FR-RA-03).'));
        metrics.appendChild(metricCard('Rebalancing Alerts', data.rebalancingAlerts.length, null,
          'Count of securities flagged by the orchestrated M4-UC4 rebalancing check (FR-RA-04) — 0 means every held security is within its drift band against the current-weight baseline used for this check.'));
        container.appendChild(metrics);

        const two = el('div', 'two-col');
        const p1 = el('div', 'panel');
        p1.appendChild(panelTitle('Model Portfolio Weights (personalised)',
          'The assigned governed model\'s asset-class weights (FR-RA-02) — "personalised" here means matched to this client\'s risk category, not re-solved per client; a bespoke allocation would come from M4-UC1/UC3 directly.'));
        const cw = el('div', 'chart-wrap');
        p1.appendChild(cw);
        two.appendChild(p1);
        barChart(cw, Object.entries(mr.personalisedWeights).map(([k, v]) => ({ label: k, value: v })), { valueFormatter: fmtPct, max: 1 });

        const p2 = el('div', 'panel');
        p2.id = 'panel-uc7-profile';
        p2.appendChild(panelTitle('Risk Profile',
          'Tolerance = average of your questionnaire "tolerance" answers; Capacity = average of the "capacity" answers; Final Category = min(the two), rounded (FR-RA-01).'));
        p2.appendChild(table(['Metric', 'Score'], [
          ['Tolerance', rp.tolerance], ['Capacity', rp.capacity], ['Final Category', rp.finalCategory],
        ]));
        two.appendChild(p2);
        container.appendChild(two);

        const p3 = el('div', 'panel');
        p3.id = 'panel-uc7-funding';
        p3.appendChild(panelTitle('Funding Plan (via UC1 goal-seek)',
          'Required SIP is solved by the same M4-UC1 goal-seek engine used standalone — reused here as a component, not reimplemented (FR-RA-03). Suggested step-up is illustrative: 10% of the required SIP, annually.'));
        p3.appendChild(table(['Goal', 'Horizon', 'Required Corpus', 'Required SIP', 'Suggested Step-up'], data.fundingPlan.map((f) => [
          f.goalName, f.horizonBucket, '₹' + fmtCompact(f.requiredCorpus), '₹' + fmtCompact(f.requiredMonthlySip) + '/mo', '₹' + fmtCompact(f.stepUpSuggested) + '/yr',
        ])));
        container.appendChild(p3);

        const p4 = el('div', 'panel');
        p4.id = 'panel-uc7-dashboard';
        p4.appendChild(panelTitle('Goal Dashboard',
          'Funded Ratio = current portfolio value ÷ required corpus at the goal\'s target date — it is normal for this to look small for long-horizon goals, because the required corpus already includes decades of assumed inflation, not today\'s cost. P(success) and Health are the same probability-of-success and attainment score computed in M4-UC1.'));
        p4.appendChild(table(['Goal', 'Funded Ratio', 'P(success)', 'Health', 'Status', 'Action'], data.goalDashboard.goals.map((g) => [
          g.goalName, fmtPct(g.fundedRatio), fmtPct(g.probability), g.healthScore + '/100',
          g.status === 'ON-TRACK' ? tag(g.status, 'ok') : tag(g.status, 'breach'), g.recommendedAction,
        ])));
        container.appendChild(p4);

        const p5 = el('div', 'panel');
        p5.id = 'panel-uc7-rebalance';
        p5.appendChild(panelTitle('Rebalancing Alerts (via UC4)',
          'Drift alerts from the orchestrated M4-UC4 check, filtered to breaches only. This demo check compares held securities against their own current weight as a baseline (no separate target-weight input was supplied here) — pass explicit targetWeights for a real drift check.'));
        if (data.rebalancingAlerts.length) {
          p5.appendChild(table(['Security', 'Drift', 'Recommended Action'], data.rebalancingAlerts.map((a) => [a.security, fmtPct(a.drift), a.recommendedAction])));
        } else {
          p5.appendChild(el('div', 'empty-hint', 'No drift alerts'));
        }
        container.appendChild(p5);

        const p6 = el('div', 'panel');
        p6.id = 'panel-uc7-audit';
        p6.appendChild(panelTitle('Audit Trail',
          'Every recommendation step logged with a timestamp and the inputs/outputs behind it — required for SEBI Research Analyst suitability and audit-trail obligations (FR-RA-06). In this prototype the trail is request-scoped; production must persist it durably.'));
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
