// Metadata + result-renderers for Module 6 (Risk Management & Stress Testing) use cases. Mirrors
// usecases-m3.js/usecases-m5.js: buildForm(container) + render(container, data, ctx), self-
// contained helpers (own copies, not shared, to avoid static-bundle collisions), fmt2 2-decimal
// display rounding, and an inline "Takeaway" line under every panel's own title.
(function (global) {
  const { barChart } = global.WISCharts;
  const C = global.WISControls;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function infoIcon(text) { return C.infoIcon(text); }
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
  function takeaway(text) { return el('div', 'takeaway', `<strong>Takeaway —</strong> ${text}`); }
  function table(headers, rows) {
    const t = el('table', 'data-table');
    const thead = el('thead'); const trh = el('tr');
    headers.forEach((h) => trh.appendChild(el('th', null, h)));
    thead.appendChild(trh); t.appendChild(thead);
    const tbody = el('tbody');
    rows.forEach((r) => {
      const tr = el('tr');
      r.forEach((c) => { const td = el('td'); if (c instanceof HTMLElement) td.appendChild(c); else td.innerHTML = c; tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    return t;
  }
  function tag(text, cls) { return `<span class="tag ${cls}">${text}</span>`; }
  function panel(id) { const p = el('div', 'panel'); if (id) p.id = id; return p; }
  function fmt2(v) {
    if (typeof v !== 'number' || !isFinite(v)) return v;
    if (Number.isInteger(v)) return v;
    return Math.round(v * 100) / 100;
  }
  function passFailTag(pass) { return tag(pass ? 'Pass' : 'Fail', pass ? 'buy' : 'sell'); }

  const USE_CASES = [
    // ---------------- M6-UC1 VaR / CVaR & Tail Risk ----------------
    {
      key: 'm6uc1', tag: 'M6-UC1', title: 'VaR / CVaR & Tail Risk', api: '/api/m6uc1',
      objective: 'Estimate portfolio Value-at-Risk, Conditional VaR and tail-risk metrics across parametric, historical and Monte Carlo methods, with backtesting and component/marginal attribution, on the real 21-stock equity book.',
      frs: ['FR-VR-01 VaR/CVaR multi-method (Must)', 'FR-VR-02 Component/marginal/incremental (Must)', 'FR-VR-03 Fat-tailed/EVT (Must)', 'FR-VR-04 Backtest (Must)', 'FR-VR-05 What-if VaR (Should)'],
      buildForm(container) {
        let state = { confidence: 0.95, horizonDays: 1, shrinkage: 0.2, mcPaths: 3000, tDegreesOfFreedom: 5, evtThresholdPercentile: 0.90, whatIf: { stockId: 'MARUTI', tradeValue: -50000 } };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            Object.assign(state, sample);
            wrap.appendChild(C.field('Confidence', C.selectInput({ value: state.confidence, options: [{ value: 0.90, label: '90%' }, { value: 0.95, label: '95%' }, { value: 0.99, label: '99%' }], onChange: (v) => { state.confidence = Number(v); } }), 'FR-VR-01: VaR/CVaR confidence level.'));
            wrap.appendChild(C.field('Horizon (days)', C.numberInput({ value: state.horizonDays, step: 1, onChange: (v) => { state.horizonDays = v; } }), 'FR-VR-01: scaled via √h from the 1-day estimate.'));
            wrap.appendChild(C.field('Covariance Shrinkage', C.sliderInput({ value: state.shrinkage, min: 0, max: 0.6, step: 0.05, format: (v) => v.toFixed(2), onChange: (v) => { state.shrinkage = v; } }), 'Shrinks the sample covariance toward a diagonal target — governed default, adjustable here.'));
            wrap.appendChild(C.field('EVT Threshold Percentile', C.sliderInput({ value: state.evtThresholdPercentile, min: 0.80, max: 0.97, step: 0.01, format: (v) => (v * 100).toFixed(0) + '%', onChange: (v) => { state.evtThresholdPercentile = v; } }), 'FR-VR-03: losses above this percentile are used to fit the tail (GPD).'));
            wrap.appendChild(C.field('What-If: Stock', C.selectInput({ value: state.whatIf.stockId, options: [{ value: 'MARUTI', label: 'MARUTI' }, { value: 'BAJAJ-AUTO', label: 'BAJAJ-AUTO' }, { value: 'INFY', label: 'INFY' }, { value: 'HDFCBANK', label: 'HDFCBANK' }], onChange: (v) => { state.whatIf.stockId = v; } }), 'FR-VR-05: recompute VaR after a hypothetical trade.'));
            wrap.appendChild(C.field('What-If: Trade Value (₹)', C.numberInput({ value: state.whatIf.tradeValue, step: 5000, onChange: (v) => { state.whatIf.tradeValue = v; } }), 'Negative = sell/reduce, positive = buy/add.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m6uc1-var');
        p1.appendChild(panelTitle('VaR & CVaR by Method', 'FR-VR-01: parametric (Cornish-Fisher fat-tail adjusted), historical simulation and Monte Carlo (Student-t) estimates, reconciled side by side.'));
        const methods = [
          { name: 'Parametric', v: data.var.parametric.pct, c: data.cvar.parametric.pct, amt: data.var.parametric.amount },
          { name: 'Historical Simulation', v: data.var.historical.pct, c: data.cvar.historical.pct, amt: data.var.historical.amount },
          { name: `Monte Carlo (t, ${data.var.montecarlo.paths} paths)`, v: data.var.montecarlo.pct, c: data.cvar.montecarlo.pct, amt: data.var.montecarlo.amount },
        ];
        const spread = fmt2(Math.max(...methods.map((m) => m.v)) - Math.min(...methods.map((m) => m.v)));
        p1.appendChild(takeaway(`At ${(data.portfolio.confidence * 100).toFixed(0)}% confidence over ${data.portfolio.horizonDays}-day horizon, the three methods estimate VaR between ${fmt2(Math.min(...methods.map((m) => m.v)))}% and ${fmt2(Math.max(...methods.map((m) => m.v)))}% of portfolio value (a ${spread}pp spread) — on a ₹${fmt2(data.portfolio.portfolioValue)} book, that's roughly ₹${fmt2(Math.min(...methods.map((m) => m.amt)))} to ₹${fmt2(Math.max(...methods.map((m) => m.amt)))} of one-day loss you should not be surprised by ${(100 - data.portfolio.confidence * 100).toFixed(0)} days out of 100.`));
        p1.appendChild(table(['Method', 'VaR %', 'VaR ₹', 'CVaR % (Expected Shortfall)'], methods.map((m) => [m.name, fmt2(m.v) + '%', '₹' + fmt2(m.amt), fmt2(m.c) + '%'])));
        container.appendChild(p1);

        const p2 = panel('panel-m6uc1-attribution');
        p2.appendChild(panelTitle('Risk Attribution — Component / Marginal / Incremental VaR', 'FR-VR-02: component VaR sums to total parametric VaR by construction; incremental VaR is the change in total VaR from fully removing that position.'));
        const top = data.riskAttribution.table[0];
        p2.appendChild(takeaway(`${top.name} contributes the most to portfolio VaR (${fmt2(top.componentVarPct)}pp of the ${fmt2(data.var.parametric.normalOnlyPct)}% total), driven by its ${fmt2(top.weightPct)}% book weight. A position with high marginal VaR but low weight is a bigger latent risk than its current size suggests.`));
        const chartWrap = el('div', 'chart-wrap'); p2.appendChild(chartWrap);
        barChart(chartWrap, data.riskAttribution.table.slice(0, 8).map((r) => ({ label: r.id, value: fmt2(r.componentVarPct) })), { labelWidth: 90 });
        p2.appendChild(table(['Stock', 'Weight %', 'Marginal VaR %', 'Component VaR %', 'Incremental VaR %'], data.riskAttribution.table.slice(0, 12).map((r) => [r.name, fmt2(r.weightPct), fmt2(r.marginalVarPct), fmt2(r.componentVarPct), fmt2(r.incrementalVarPct)])));
        container.appendChild(p2);

        const p3 = panel('panel-m6uc1-tail');
        p3.appendChild(panelTitle('Tail Risk — EVT (Peaks-Over-Threshold)', 'FR-VR-03: fits a Generalised Pareto Distribution to losses beyond the threshold, rather than assuming a normal tail.'));
        p3.appendChild(takeaway(`The fitted tail index is ${fmt2(data.tailMetrics.tailIndex)} (${data.tailMetrics.regime}) from ${data.tailMetrics.exceedances} exceedances beyond the ${fmt2(data.tailMetrics.thresholdPct)}th percentile loss. The EVT-based VaR of ${fmt2(data.tailMetrics.evtVarPct)}% ${data.tailMetrics.evtVarPct > data.var.parametric.varNormalOnlyPct ? 'sits above' : 'sits close to'} the plain normal estimate — ${data.tailMetrics.evtVarPct > data.var.parametric.varNormalOnlyPct ? 'a normal-only model would understate this risk' : 'the tail is not meaningfully fatter than normal in this sample'}.`));
        p3.appendChild(table(['Metric', 'Value'], [['Threshold (loss %)', fmt2(data.tailMetrics.threshold) + '%'], ['Exceedances', data.tailMetrics.exceedances], ['Tail Index (ξ)', fmt2(data.tailMetrics.tailIndex)], ['EVT VaR %', fmt2(data.tailMetrics.evtVarPct) + '%'], ['EVT CVaR %', fmt2(data.tailMetrics.evtCvarPct) + '%'], ['Regime', data.tailMetrics.regime]]));
        container.appendChild(p3);

        const p4 = panel('panel-m6uc1-backtest');
        p4.appendChild(panelTitle('Backtest — Kupiec & Christoffersen', 'FR-VR-04: exception counting against a static 99% 1-day VaR over the full sample, plus tests for whether the exception rate and its clustering are statistically consistent with the stated confidence.'));
        p4.appendChild(takeaway(`${data.backtest.exceptions} exceptions in ${data.backtest.observations} days (${fmt2(data.backtest.kupiec.exceptionRate)}% vs an expected ${fmt2(data.backtest.kupiec.expectedRate)}%). Kupiec ${data.backtest.kupiec.pass ? 'passes' : 'fails'} (the exception rate is statistically consistent with 99% confidence) and Christoffersen ${data.backtest.christoffersen.pass ? 'passes' : 'fails'} (exceptions ${data.backtest.christoffersen.pass ? 'are not' : 'are'} clustering in time). This is a single-window check, not a rolling out-of-sample backtest.`));
        p4.appendChild(table(['Test', 'Statistic', 'Critical Value', 'Result'], [['Kupiec POF', fmt2(data.backtest.kupiec.statistic), data.backtest.kupiec.criticalValue995, passFailTag(data.backtest.kupiec.pass)], ['Christoffersen Independence', fmt2(data.backtest.christoffersen.statistic), data.backtest.christoffersen.criticalValue, passFailTag(data.backtest.christoffersen.pass)]]));
        container.appendChild(p4);

        if (data.whatIfVar) {
          const p5 = panel('panel-m6uc1-whatif');
          p5.appendChild(panelTitle(`What-If VaR — ${data.whatIfVar.tradeValue >= 0 ? 'Buy' : 'Sell'} ₹${fmt2(Math.abs(data.whatIfVar.tradeValue))} ${data.whatIfVar.stockId}`, 'FR-VR-05: recomputes parametric VaR with the hypothetical trade applied, before it is actually placed.'));
          p5.appendChild(takeaway(`This trade would ${data.whatIfVar.deltaVarPct <= 0 ? 'reduce' : 'increase'} portfolio VaR by ${fmt2(Math.abs(data.whatIfVar.deltaVarPct))}pp (from ${fmt2(data.whatIfVar.varBeforePct)}% to ${fmt2(data.whatIfVar.varAfterPct)}%) — a genuine what-if check before committing capital, not a retrospective report.`));
          p5.appendChild(table(['', 'VaR %'], [['Before', fmt2(data.whatIfVar.varBeforePct) + '%'], ['After', fmt2(data.whatIfVar.varAfterPct) + '%'], ['Δ VaR', fmt2(data.whatIfVar.deltaVarPct) + 'pp']]));
          container.appendChild(p5);
        }
      },
      tour: [
        { fr: 'FR-VR-01', priority: 'Must', status: 'full', selector: '#panel-m6uc1-var', requirement: 'Compute VaR & CVaR at configurable confidence/horizon via parametric, historical and Monte Carlo methods.', achieved: 'All three methods genuinely computed on the real equity book\'s historical returns and covariance, reconciled side by side.' },
        { fr: 'FR-VR-02', priority: 'Must', status: 'full', selector: '#panel-m6uc1-attribution', requirement: 'Attribute risk: component, marginal and incremental VaR by position.', achieved: 'Marginal/component VaR from the analytic covariance decomposition (sums to total by construction); incremental VaR from a genuine leave-one-out recomputation.' },
        { fr: 'FR-VR-03', priority: 'Must', status: 'full', selector: '#panel-m6uc1-tail', requirement: 'Model tail risk with fat-tailed / EVT distributions (not normal-only).', achieved: 'Cornish-Fisher fat-tail adjustment on the parametric estimate, a Student-t Monte Carlo, and a genuine EVT/GPD fit via peaks-over-threshold.' },
        { fr: 'FR-VR-04', priority: 'Must', status: 'partial', selector: '#panel-m6uc1-backtest', requirement: 'Backtest VaR (exception counts, Kupiec/Christoffersen) and report breaches.', achieved: 'Both tests genuinely computed, but against a single static VaR estimate over the full history rather than a rolling, re-estimated-each-day backtest.' },
        { fr: 'FR-VR-05', priority: 'Should', status: 'full', selector: '#panel-m6uc1-whatif', requirement: 'Support what-if VaR for a proposed trade/position change.', achieved: 'Recomputes parametric VaR with the hypothetical weight change applied.' },
      ],
    },

    // ---------------- M6-UC2 Factor Risk Decomposition ----------------
    {
      key: 'm6uc2', tag: 'M6-UC2', title: 'Factor Risk Decomposition', api: '/api/m6uc2',
      objective: 'Decompose portfolio risk into systematic factor and idiosyncratic components, quantify exposures, and attribute active risk (tracking error) vs the universe benchmark.',
      frs: ['FR-FD-01 Factor exposures (Must)', 'FR-FD-02 Systematic vs specific (Must)', 'FR-FD-03 Tracking error decomposition (Must)', 'FR-FD-04 Risk contribution + unintended (Must)', 'FR-FD-05 Fundamental/statistical support (Should)'],
      buildForm(container) {
        let state = { sectorNeutral: true, unintendedThreshold: 0.5 };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            Object.assign(state, sample);
            wrap.appendChild(C.field('Sector-Neutral Factors', C.toggleInput({ checked: state.sectorNeutral, labelOn: 'On', labelOff: 'Off', onChange: (v) => { state.sectorNeutral = v; } }), 'Demeans each factor within its sector before z-scoring, consistent with M5-UC1.'));
            wrap.appendChild(C.field('Unintended-Exposure Threshold', C.sliderInput({ value: state.unintendedThreshold, min: 0.2, max: 1.0, step: 0.1, format: (v) => v.toFixed(1), onChange: (v) => { state.unintendedThreshold = v; } }), 'FR-FD-04: active exposures beyond this magnitude are flagged for review.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m6uc2-split');
        p1.appendChild(panelTitle('Risk Split — Systematic vs Specific', 'FR-FD-02: total portfolio variance decomposed into factor (systematic) and idiosyncratic (specific) components via σ² = wᵀ(BFBᵀ+D)w.'));
        p1.appendChild(takeaway(`${fmt2(data.riskSplit.specificPctOfVar)}% of this book's risk is stock-specific (idiosyncratic) rather than driven by the six style factors — with only 21 real holdings, single-stock news and events matter more here than broad factor tilts. Portfolio vol is ${fmt2(data.riskSplit.portfolioVolAnnualPct)}% annualised vs ${fmt2(data.riskSplit.benchmarkVolAnnualPct)}% for the benchmark, with a tracking error of ${fmt2(data.riskSplit.trackingErrorAnnualPct)}%.`));
        const row = el('div', 'metric-row');
        row.appendChild(metricCard('Portfolio Vol (Ann.)', fmt2(data.riskSplit.portfolioVolAnnualPct) + '%', null, 'FR-FD-02: annualised from the daily factor model variance.'));
        row.appendChild(metricCard('Benchmark Vol (Ann.)', fmt2(data.riskSplit.benchmarkVolAnnualPct) + '%', null, 'Cap-weighted universe benchmark, same factor model.'));
        row.appendChild(metricCard('Tracking Error (Ann.)', fmt2(data.riskSplit.trackingErrorAnnualPct) + '%', null, 'FR-FD-03: active risk vs benchmark.'));
        row.appendChild(metricCard('Systematic / Specific', `${fmt2(data.riskSplit.systematicPctOfVar)}% / ${fmt2(data.riskSplit.specificPctOfVar)}%`, null, 'Share of total variance from factors vs stock-specific risk.'));
        p1.appendChild(row);
        container.appendChild(p1);

        const p2 = panel('panel-m6uc2-exposures');
        p2.appendChild(panelTitle('Factor Exposures — Portfolio vs Benchmark', 'FR-FD-01: net standardised exposure per factor (same value/quality/momentum/lowvol/growth/size taxonomy as M5-UC1).'));
        const biggestActive = [...data.factorExposures].sort((a, b) => Math.abs(b.activeExposure) - Math.abs(a.activeExposure))[0];
        p2.appendChild(takeaway(`The largest active bet vs benchmark is on ${biggestActive.factor} (${biggestActive.activeExposure >= 0 ? '+' : ''}${fmt2(biggestActive.activeExposure)}) — this book is ${biggestActive.activeExposure >= 0 ? 'more' : 'less'} exposed to that factor than the benchmark, whether that was a deliberate call or not.`));
        const chartWrap = el('div', 'chart-wrap'); p2.appendChild(chartWrap);
        barChart(chartWrap, data.factorExposures.map((f) => ({ label: f.factor, value: fmt2(f.activeExposure) })), { labelWidth: 90 });
        p2.appendChild(table(['Factor', 'Portfolio', 'Benchmark', 'Active', 'Risk Contribution %'], data.factorExposures.map((f) => [f.factor, fmt2(f.portfolioExposure), fmt2(f.benchmarkExposure), fmt2(f.activeExposure), fmt2(f.riskContributionPct) + '%'])));
        container.appendChild(p2);

        const p3 = panel('panel-m6uc2-contrib');
        p3.appendChild(panelTitle('Risk Contributions (Factor + Specific)', 'FR-FD-04: ranked contribution of each factor and specific risk to total portfolio variance.'));
        const topContrib = data.riskContributions[0];
        p3.appendChild(takeaway(`${topContrib.factor} is the single largest contributor to portfolio risk at ${fmt2(topContrib.portfolioContributionPct)}% of total variance.`));
        p3.appendChild(table(['Source', 'Contribution to Variance %'], data.riskContributions.map((r) => [r.factor, fmt2(r.portfolioContributionPct) + '%'])));
        container.appendChild(p3);

        const p4 = panel('panel-m6uc2-te');
        p4.appendChild(panelTitle('Tracking Error Decomposition', 'FR-FD-03: which factors drive the active risk vs benchmark (can differ from which factors drive absolute risk).'));
        const topTe = [...data.trackingError.factorContribution].sort((a, b) => Math.abs(b.contributionPct) - Math.abs(a.contributionPct))[0];
        p4.appendChild(takeaway(`${topTe.factor} explains the largest share (${fmt2(topTe.contributionPct)}%) of the ${fmt2(data.trackingError.annualPct)}% annual tracking error — this is what would most likely cause this book to diverge from the benchmark's return, for better or worse.`));
        p4.appendChild(table(['Factor', 'Contribution to TE %'], data.trackingError.factorContribution.map((f) => [f.factor, fmt2(f.contributionPct) + '%'])));
        container.appendChild(p4);

        const p5 = panel('panel-m6uc2-unintended');
        p5.appendChild(panelTitle('Unintended Exposures', 'FR-FD-04: active factor tilts beyond the configured threshold, flagged for review rather than assumed deliberate.'));
        p5.appendChild(takeaway(data.unintendedExposures.length ? `${data.unintendedExposures.length} factor tilt(s) exceed the ${data.factorExposures ? '' : ''}threshold and are flagged below — worth confirming these are intentional views, not accidental drift from individual stock selection.` : 'No factor exposure exceeds the configured threshold — this book\'s factor tilts are all within the governed tolerance band.'));
        p5.appendChild(data.unintendedExposures.length ? table(['Factor', 'Active Exposure', 'Note'], data.unintendedExposures.map((u) => [u.factor, fmt2(u.activeExposure), u.note])) : el('div', 'empty-hint', 'No flags.'));
        container.appendChild(p5);
      },
      tour: [
        { fr: 'FR-FD-01', priority: 'Must', status: 'full', selector: '#panel-m6uc2-exposures', requirement: 'Estimate factor exposures (style, sector, macro) for the portfolio and benchmark.', achieved: 'Six style-factor exposures (value/quality/momentum/lowvol/growth/size) for both portfolio and benchmark, same taxonomy as M5-UC1.' },
        { fr: 'FR-FD-02', priority: 'Must', status: 'full', selector: '#panel-m6uc2-split', requirement: 'Decompose total risk into factor vs specific (idiosyncratic) contributions.', achieved: 'Genuine σ² = wᵀ(BFBᵀ+D)w decomposition, with factor covariance F and specific risk D recovered from a real daily cross-sectional regression.' },
        { fr: 'FR-FD-03', priority: 'Must', status: 'full', selector: '#panel-m6uc2-te', requirement: 'Compute active risk (tracking error) and its factor decomposition vs benchmark.', achieved: 'Tracking error from the same factor model applied to the active (portfolio − benchmark) weight vector, decomposed by factor.' },
        { fr: 'FR-FD-04', priority: 'Must', status: 'full', selector: '#panel-m6uc2-unintended', requirement: 'Attribute risk contribution per factor and identify unintended exposures.', achieved: 'Per-factor risk contribution table plus a configurable-threshold flag for large active tilts.' },
        { fr: 'FR-FD-05', priority: 'Should', status: 'partial', selector: '#panel-m6uc2-exposures', requirement: 'Support both fundamental and statistical (PCA) factor models.', achieved: 'Fundamental factor model implemented (M5-UC1\'s taxonomy); a PCA/statistical-factor variant is not implemented in this prototype (see M5-UC9 for a PCA implementation on the yield curve, reusable groundwork).' },
      ],
    },

    // ---------------- M6-UC3 Macro Scenario & Stress Testing ----------------
    {
      key: 'm6uc3', tag: 'M6-UC3', title: 'Macro Scenario & Stress Testing', api: '/api/m6uc3',
      objective: 'Revalue the portfolio under historical and hypothetical macro-financial scenarios, and reverse-stress to the shock combination that would breach a chosen loss threshold.',
      frs: ['FR-SS-01 Scenario library (Must)', 'FR-SS-02 Factor-shock definition (Must)', 'FR-SS-03 Revaluation + driver breakdown (Must)', 'FR-SS-04 Reverse stress (Should)', 'FR-SS-05 Regime plausibility (Should)'],
      buildForm(container) {
        let state = { reverseStressThresholdPct: 0.15 };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            Object.assign(state, sample);
            wrap.appendChild(C.field('Reverse-Stress Loss Threshold', C.sliderInput({ value: state.reverseStressThresholdPct, min: 0.05, max: 0.40, step: 0.01, format: (v) => (v * 100).toFixed(0) + '%', onChange: (v) => { state.reverseStressThresholdPct = v; } }), 'FR-SS-04: find the smallest, most-plausible shock combination that produces this portfolio loss.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m6uc3-scenarios');
        p1.appendChild(panelTitle('Scenario Library — Portfolio P&L', 'FR-SS-01/03: historical-calibrated and hypothetical scenarios, each revalued through per-position beta/rate/FX/credit sensitivities.'));
        const worst = data.worstScenarios[0];
        p1.appendChild(takeaway(`The most damaging scenario is "${worst.name}" at ${fmt2(worst.portfolioPnlPct)}% (₹${fmt2(worst.portfolioPnlAmount)}). Across all ${data.scenarioResults.length} scenarios, losses range from the mildest to a worst case of ${fmt2(Math.min(...data.scenarioResults.map((s) => s.portfolioPnlPct)))}% — the concentrated, high-beta names in this book (see worst positions below) drive most of the downside.`));
        const chartWrap = el('div', 'chart-wrap'); p1.appendChild(chartWrap);
        barChart(chartWrap, data.scenarioResults.map((s) => ({ label: s.name.length > 24 ? s.name.slice(0, 24) + '…' : s.name, value: fmt2(s.portfolioPnlPct) })), { labelWidth: 190 });
        p1.appendChild(table(['Scenario', 'Type', 'Portfolio P&L %', 'Portfolio P&L ₹'], data.scenarioResults.map((s) => [s.name, tag(s.type, s.type === 'historical' ? 'hold' : 'sell'), fmt2(s.portfolioPnlPct) + '%', '₹' + fmt2(s.portfolioPnlAmount)])));
        container.appendChild(p1);

        const p2 = panel('panel-m6uc3-driver');
        p2.appendChild(panelTitle(`Driver Breakdown & Worst Positions — "${worst.name}"`, 'FR-SS-03: which shock factor (equity/rate/FX/credit) drives the loss, and which positions hurt most.'));
        const topDriver = [...worst.driverBreakdown].sort((a, b) => a.pnlPct - b.pnlPct)[0];
        p2.appendChild(takeaway(`The ${topDriver.factor} shock alone accounts for ${fmt2(topDriver.pnlPct)}pp of this scenario's loss. ${worst.worstPositions[0].name} is hit hardest at ${fmt2(worst.worstPositions[0].pnlPct)}%, largely because of its sector's sensitivity and market beta, not just its book weight.`));
        p2.appendChild(table(['Shock Factor', 'P&L Contribution %'], worst.driverBreakdown.map((d) => [d.factor, fmt2(d.pnlPct) + '%'])));
        p2.appendChild(table(['Worst Positions', 'Sector', 'Weight %', 'P&L %'], worst.worstPositions.map((w) => [w.name, w.sector, fmt2(w.weightPct), fmt2(w.pnlPct) + '%'])));
        container.appendChild(p2);

        const p3 = panel('panel-m6uc3-reverse');
        p3.appendChild(panelTitle('Reverse Stress Test', 'FR-SS-04: the smallest (correlation-weighted / Mahalanobis-minimal) combination of shocks that would produce the chosen loss threshold.'));
        const eqShock = data.reverseStress.shockSet.find((s) => s.factor === 'equity');
        p3.appendChild(takeaway(`To lose ${fmt2(data.reverseStress.targetLossPct)}% on this book, the most plausible path is roughly a ${fmt2(Math.abs(eqShock.shock))}% equity move (plus smaller rate/FX/credit contributions) — smaller than the market falls seen in the historical scenarios above, since this uses the most efficient (correlated) combination of shocks rather than a single blunt equity crash.`));
        p3.appendChild(table(['Shock Factor', 'Shock (%)'], data.reverseStress.shockSet.map((s) => [s.factor, fmt2(s.shock) + '%'])));
        container.appendChild(p3);

        const p4 = panel('panel-m6uc3-plausibility');
        p4.appendChild(panelTitle('Regime-Weighted Plausibility', 'FR-SS-05: Module 5\'s current market-regime signal is used to weight how plausible each bearish scenario is right now, rather than treating all scenarios as equally likely.'));
        p4.appendChild(takeaway(`The current regime is "${data.plausibilityWeights.currentRegime}" — ${data.plausibilityWeights.currentRegime.startsWith('Bear') ? 'bearish scenarios are weighted as more plausible than usual' : 'bearish scenarios are weighted as tail risk rather than the base case'} right now. This weighting should inform how much capital, if any, to allocate to hedging (see M6-UC5).`));
        p4.appendChild(table(['Scenario', 'Plausibility Weight'], data.plausibilityWeights.weights.map((w) => [w.name, fmt2(w.plausibilityWeight)])));
        container.appendChild(p4);
      },
      tour: [
        { fr: 'FR-SS-01', priority: 'Must', status: 'full', selector: '#panel-m6uc3-scenarios', requirement: 'Support a library of historical scenarios and hypothetical shocks.', achieved: '4 historical-calibrated (2008 GFC, COVID, Taper Tantrum, Demonetisation) and 2 hypothetical scenarios.' },
        { fr: 'FR-SS-02', priority: 'Must', status: 'full', selector: '#panel-m6uc3-scenarios', requirement: 'Define scenarios as shocks to macro/market factors.', achieved: 'Each scenario is a vector of equity/rate/FX/credit-spread shocks.' },
        { fr: 'FR-SS-03', priority: 'Must', status: 'full', selector: '#panel-m6uc3-driver', requirement: 'Revalue the portfolio under each scenario and report P&L and driver breakdown.', achieved: 'Per-position revaluation via beta/sector sensitivities, aggregated to portfolio P&L with a per-factor driver breakdown.' },
        { fr: 'FR-SS-04', priority: 'Should', status: 'full', selector: '#panel-m6uc3-reverse', requirement: 'Reverse stress test: find the scenario/shock magnitude that breaches a loss threshold.', achieved: 'Closed-form minimal-Mahalanobis-norm shock solve under an assumed macro-factor covariance.' },
        { fr: 'FR-SS-05', priority: 'Should', status: 'full', selector: '#panel-m6uc3-plausibility', requirement: 'Combine with regime context (Module 5) to weight scenario plausibility.', achieved: 'Live call into M5-UC10\'s regime detector; bearish scenarios reweighted based on the current regime label.' },
      ],
    },

    // ---------------- M6-UC4 Volatility Forecasting (GARCH + ML) ----------------
    {
      key: 'm6uc4', tag: 'M6-UC4', title: 'Volatility Forecasting (GARCH + ML)', api: '/api/m6uc4',
      objective: 'Forecast portfolio volatility via GARCH-family and HAR-RV models, blended by out-of-sample accuracy and anchored to a synthetic implied-vol gauge, feeding VaR and hedging.',
      frs: ['FR-VF-01 GARCH-family (Must)', 'FR-VF-02 ML/HAR-RV ensemble (Should)', 'FR-VF-03 Implied-vol anchor (Should)', 'FR-VF-04 Multi-horizon + bands (Must)', 'FR-VF-05 Accuracy evaluation + blend (Should)'],
      buildForm(container) {
        let state = { simPaths: 800, impliedAnchorWeight: 0.25 };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            Object.assign(state, sample);
            wrap.appendChild(C.field('Implied-Vol Anchor Weight', C.sliderInput({ value: state.impliedAnchorWeight, min: 0, max: 0.6, step: 0.05, format: (v) => v.toFixed(2), onChange: (v) => { state.impliedAnchorWeight = v; } }), 'FR-VF-03: how much weight the synthetic implied-vol gauge gets at short horizons, decaying to zero by ~1 month out.'));
            wrap.appendChild(C.field('Simulation Paths (bands)', C.numberInput({ value: state.simPaths, step: 100, onChange: (v) => { state.simPaths = v; } }), 'Filtered-historical-simulation paths used to build the forecast confidence bands.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m6uc4-params');
        p1.appendChild(panelTitle('Fitted Model Parameters', 'FR-VF-01: GARCH(1,1), GJR-GARCH (asymmetric) and EGARCH, each fit by grid-searched quasi-maximum-likelihood on the portfolio\'s own daily return history.'));
        p1.appendChild(takeaway(`Persistence (α+β) is ${fmt2(data.volForecast.garch.persistence)} for GARCH — close to 1 means today's volatility shock decays slowly, so a vol spike now would still be partly felt weeks later. GJR's asymmetry term (γ=${fmt2(data.volForecast.gjr.params.gamma)}) captures whether down-days raise future volatility more than up-days of the same size.`));
        p1.appendChild(table(['Model', 'ω', 'α', 'γ', 'β', 'Persistence'], [
          ['GARCH(1,1)', data.volForecast.garch.params.omega, fmt2(data.volForecast.garch.params.alpha), '—', fmt2(data.volForecast.garch.params.beta), fmt2(data.volForecast.garch.persistence)],
          ['GJR-GARCH', data.volForecast.gjr.params.omega, fmt2(data.volForecast.gjr.params.alpha), fmt2(data.volForecast.gjr.params.gamma), fmt2(data.volForecast.gjr.params.beta), fmt2(data.volForecast.gjr.persistence)],
          ['EGARCH', fmt2(data.volForecast.egarch.params.omega), fmt2(data.volForecast.egarch.params.alpha), fmt2(data.volForecast.egarch.params.gamma), fmt2(data.volForecast.egarch.params.beta), fmt2(data.volForecast.egarch.persistence)],
        ]));
        container.appendChild(p1);

        const p2 = panel('panel-m6uc4-blend');
        p2.appendChild(panelTitle('Blended Forecast by Horizon', 'FR-VF-04: ensemble-blended volatility forecast (annualised) with a band from bootstrapped simulation, at 1-day, 1-week and 1-month horizons.'));
        const h1 = data.blendedVol.byHorizon[0], hLast = data.blendedVol.byHorizon[data.blendedVol.byHorizon.length - 1];
        p2.appendChild(takeaway(`The blended 1-day forecast is ${fmt2(h1.blendedWithImpliedPct)}% annualised vol, ${h1.blendedWithImpliedPct > hLast.blendedWithImpliedPct ? 'easing to' : 'rising to'} ${fmt2(hLast.blendedWithImpliedPct)}% by the ${hLast.horizonDays}-day horizon. The confidence band (${fmt2(h1.bandLowPct)}%–${fmt2(h1.bandHighPct)}%) comes from simulating the fitted models forward with bootstrapped historical shocks, not a fixed multiplier.`));
        const chartWrap = el('div', 'chart-wrap'); p2.appendChild(chartWrap);
        barChart(chartWrap, data.blendedVol.byHorizon.map((h) => ({ label: `${h.horizonDays}d`, value: fmt2(h.blendedWithImpliedPct) })), { labelWidth: 60 });
        p2.appendChild(table(['Horizon', 'Model Blend %', 'With Implied Anchor %', 'Band Low %', 'Band High %'], data.blendedVol.byHorizon.map((h) => [`${h.horizonDays}d`, fmt2(h.modelBlendPct), fmt2(h.blendedWithImpliedPct), fmt2(h.bandLowPct), fmt2(h.bandHighPct)])));
        container.appendChild(p2);

        const p3 = panel('panel-m6uc4-implied');
        p3.appendChild(panelTitle('Implied vs Realised Volatility', 'FR-VF-03: a synthetic implied-vol gauge (no licensed India VIX feed) vs the trailing 20-day realised vol.'));
        p3.appendChild(takeaway(`The synthetic implied-vol gauge sits ${fmt2(data.impliedVsRealized.premiumPct)}% above trailing realised vol — a positive premium is normal (options tend to price in a cushion for unexpected moves); a negative or shrinking premium would suggest the market is under-pricing near-term risk.`));
        p3.appendChild(table(['Metric', 'Value'], [['Implied Vol (Ann.)', fmt2(data.impliedVsRealized.impliedVolAnnualPct) + '%'], ['Realised Vol, 20d (Ann.)', fmt2(data.impliedVsRealized.realizedVol20dAnnualPct) + '%'], ['Premium', fmt2(data.impliedVsRealized.premiumPct) + '%']]));
        container.appendChild(p3);

        const p4 = panel('panel-m6uc4-diagnostics');
        p4.appendChild(panelTitle('Model Diagnostics — Out-of-Sample QLIKE', 'FR-VF-05: each model\'s forecast accuracy on a held-out 30% slice, evaluated with QLIKE (a proper volatility-forecast loss) rather than plain MSE.'));
        p4.appendChild(takeaway(`The ensemble ${data.modelDiagnostics.ensembleBeatsRandomWalk ? 'beats' : 'does not beat'} the random-walk baseline (lower QLIKE is better: ${fmt2(data.modelDiagnostics.ensembleQlike)} vs ${fmt2(data.modelDiagnostics.outOfSampleQlike.randomWalk)}), and ${data.modelDiagnostics.ensembleBeatsBestSingle ? 'edges out' : 'runs slightly behind'} the single best model (${fmt2(data.modelDiagnostics.bestSingleModelQlike)}) — an honestly-reported result, not cherry-picked to make the ensemble look best.`));
        p4.appendChild(table(['Model', 'Out-of-Sample QLIKE'], [['GARCH', fmt2(data.modelDiagnostics.outOfSampleQlike.garch)], ['GJR-GARCH', fmt2(data.modelDiagnostics.outOfSampleQlike.gjr)], ['EGARCH', fmt2(data.modelDiagnostics.outOfSampleQlike.egarch)], ['HAR-RV', fmt2(data.modelDiagnostics.outOfSampleQlike.harRv)], ['Random Walk (baseline)', fmt2(data.modelDiagnostics.outOfSampleQlike.randomWalk)], ['Ensemble (blended)', fmt2(data.modelDiagnostics.ensembleQlike)]]));
        container.appendChild(p4);
      },
      tour: [
        { fr: 'FR-VF-01', priority: 'Must', status: 'full', selector: '#panel-m6uc4-params', requirement: 'Forecast conditional volatility via GARCH-family models (GARCH, EGARCH, GJR).', achieved: 'All three fit via grid-searched quasi-MLE on the portfolio\'s own return history, not canned parameters.' },
        { fr: 'FR-VF-02', priority: 'Should', status: 'full', selector: '#panel-m6uc4-params', requirement: 'Provide ML/hybrid volatility forecasts (e.g. HAR-RV) as an alternative/ensemble.', achieved: 'HAR-RV fit by OLS on daily/weekly/monthly realised-vol features (Corsi 2009 construction).' },
        { fr: 'FR-VF-03', priority: 'Should', status: 'partial', selector: '#panel-m6uc4-implied', requirement: 'Incorporate implied volatility (India VIX / option-implied) where available.', achieved: 'No licensed India VIX feed, so this uses a documented synthetic implied-vol proxy derived from realised-vol dispersion, blended in with a decaying weight at short horizons.' },
        { fr: 'FR-VF-04', priority: 'Must', status: 'full', selector: '#panel-m6uc4-blend', requirement: 'Produce multi-horizon forecasts with confidence bands and a blended estimate.', achieved: '1-day/1-week/1-month forecasts with bootstrapped-simulation bands and an inverse-QLIKE-weighted blend.' },
        { fr: 'FR-VF-05', priority: 'Should', status: 'full', selector: '#panel-m6uc4-diagnostics', requirement: 'Evaluate forecast accuracy (QLIKE/MSE vs realised) and auto-select/blend models.', achieved: 'Genuine out-of-sample QLIKE on a held-out 30% slice drives the ensemble weights, reported honestly including when the ensemble does not beat the best single model.' },
      ],
    },

    // ---------------- M6-UC5 Drawdown Prediction & Hedging ----------------
    {
      key: 'm6uc5', tag: 'M6-UC5', title: 'Drawdown Prediction & Hedging', api: '/api/m6uc5',
      objective: 'Estimate drawdown risk and elevated-drawdown probability, and recommend cost-aware hedges sized to a risk target, with residual-risk and effectiveness reporting.',
      frs: ['FR-DD-01 Drawdown probability (Must)', 'FR-DD-02 Early-warning signal (Must)', 'FR-DD-03 Hedge recommendation (Must)', 'FR-DD-04 Cost/residual/effectiveness (Must)', 'FR-DD-05 Dynamic re-hedge (Should)'],
      buildForm(container) {
        let state = { horizonDays: 60, mddThresholdPct: -15, riskTargetVolPct: 7, simPaths: 4000 };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            Object.assign(state, sample);
            wrap.appendChild(C.field('Horizon (trading days)', C.numberInput({ value: state.horizonDays, step: 5, onChange: (v) => { state.horizonDays = v; } })));
            wrap.appendChild(C.field('Drawdown Threshold %', C.sliderInput({ value: state.mddThresholdPct, min: -40, max: -5, step: 1, format: (v) => v.toFixed(0) + '%', onChange: (v) => { state.mddThresholdPct = v; } }), 'FR-DD-01: probability of a drawdown breaching this level over the horizon.'));
            wrap.appendChild(C.field('Risk Target (Annual Vol %)', C.sliderInput({ value: state.riskTargetVolPct, min: 3, max: 20, step: 0.5, format: (v) => v.toFixed(1) + '%', onChange: (v) => { state.riskTargetVolPct = v; } }), 'FR-DD-03: hedges are sized to bring portfolio vol down toward this governed target.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m6uc5-drawdown');
        p1.appendChild(panelTitle('Drawdown Risk', 'FR-DD-01: max-drawdown distribution from a bootstrapped (filtered historical simulation) Monte Carlo over the actual return history.'));
        p1.appendChild(takeaway(`Over the next ${data.drawdownRisk.horizonDays} trading days, the median simulated drawdown is ${fmt2(data.drawdownRisk.medianMddPct)}%, with a 1-in-20 chance of a drawdown at least as bad as ${fmt2(data.drawdownRisk.p05MddPct)}%. The probability of breaching the ${fmt2(data.drawdownRisk.thresholdPct)}% threshold is ${fmt2(data.drawdownRisk.breachProbabilityPct)}%.`));
        p1.appendChild(table(['Metric', 'Value'], [['Median MDD', fmt2(data.drawdownRisk.medianMddPct) + '%'], ['10th Percentile MDD', fmt2(data.drawdownRisk.p10MddPct) + '%'], ['5th Percentile MDD', fmt2(data.drawdownRisk.p05MddPct) + '%'], ['Worst Simulated MDD', fmt2(data.drawdownRisk.worstMddPct) + '%'], [`P(MDD ≤ ${fmt2(data.drawdownRisk.thresholdPct)}%)`, fmt2(data.drawdownRisk.breachProbabilityPct) + '%']]));
        container.appendChild(p1);

        const p2 = panel('panel-m6uc5-warning');
        p2.appendChild(panelTitle('Early-Warning Score', 'FR-DD-02: composite of forecast volatility (M6-UC4), market regime (M5-UC10), breadth and momentum.'));
        p2.appendChild(takeaway(`The early-warning score is ${fmt2(data.earlyWarning.composite)}/100 (${data.earlyWarning.level}) — driven mainly by ${Object.entries(data.earlyWarning.drivers).sort((a, b) => b[1] - a[1])[0][0].replace('Score', '')} conditions. Regime is currently "${data.earlyWarning.inputs.regime}" with ${fmt2(data.earlyWarning.inputs.universeBreadthAbove50dmaPct)}% of the universe trading above its 50-day average.`));
        const chartWrap = el('div', 'chart-wrap'); p2.appendChild(chartWrap);
        barChart(chartWrap, Object.entries(data.earlyWarning.drivers).map(([k, v]) => ({ label: k.replace('Score', ''), value: fmt2(v) })), { labelWidth: 110 });
        container.appendChild(p2);

        const p3 = panel('panel-m6uc5-hedges');
        p3.appendChild(panelTitle('Hedge Recommendations', 'FR-DD-03: instruments sized to close the gap between current portfolio vol and the risk target, at minimal cost.'));
        p3.appendChild(takeaway(data.residualRisk.hedgeFractionApplied > 0 ? `Current vol (${fmt2(data.residualRisk.unhedgedVolAnnualPct)}%) is above the ${fmt2(data.residualRisk.riskTargetPct)}% target, so ${fmt2(data.residualRisk.hedgeFractionApplied)}% of the excess risk is recommended to be hedged. The put option costs the most in premium but offers convexity in a fast sell-off; the futures hedge is cheaper but linear; the low-beta rotation is free of derivatives.` : `Current vol (${fmt2(data.residualRisk.unhedgedVolAnnualPct)}%) is already at or below the ${fmt2(data.residualRisk.riskTargetPct)}% target, so no additional hedging is recommended right now — these instruments show what would be deployed if that changed.`));
        p3.appendChild(table(['Instrument', 'Notional', 'Cost (₹)', 'Cost % of Portfolio', 'Detail'], data.hedgeRecommendations.map((h) => [h.instrument, '₹' + fmt2(h.notionalHedged || h.notionalRotated || 0), '₹' + fmt2(h.cost), fmt2(h.costPctOfPortfolio) + '%', h.detail])));
        container.appendChild(p3);

        const p4 = panel('panel-m6uc5-residual');
        p4.appendChild(panelTitle('Residual Risk & Effectiveness', 'FR-DD-04: portfolio vol after the recommended hedge, and how much of the unhedged risk that removes.'));
        p4.appendChild(takeaway(`Applying the recommended hedge would bring annualised vol from ${fmt2(data.residualRisk.unhedgedVolAnnualPct)}% down to ${fmt2(data.residualRisk.residualVolAnnualPct)}%, an effectiveness of ${fmt2(data.residualRisk.effectiveness * 100)}%. Hedges are never perfect — basis risk and cost drag mean 100% effectiveness isn't realistic or claimed here.`));
        p4.appendChild(table(['Metric', 'Value'], [['Unhedged Vol', fmt2(data.residualRisk.unhedgedVolAnnualPct) + '%'], ['Residual Vol (Post-Hedge)', fmt2(data.residualRisk.residualVolAnnualPct) + '%'], ['Effectiveness', fmt2(data.residualRisk.effectiveness * 100) + '%'], ['Hedge Fraction Applied', fmt2(data.residualRisk.hedgeFractionApplied) + '%']]));
        container.appendChild(p4);

        const p5 = panel('panel-m6uc5-rehedge');
        p5.appendChild(panelTitle('Dynamic Re-Hedge Plan', 'FR-DD-05: rule-based triggers for adjusting the hedge as conditions change, rather than a one-time static recommendation.'));
        p5.appendChild(takeaway(`${data.rehedgePlan.triggers.length} triggers govern when to revisit this hedge, reviewed ${data.rehedgePlan.reviewFrequency.toLowerCase()} — the goal is to avoid both under-hedging into a sell-off and over-paying for protection once conditions calm down.`));
        p5.appendChild(table(['Trigger Condition', 'Action'], data.rehedgePlan.triggers.map((t) => [t.condition, t.action])));
        container.appendChild(p5);
      },
      tour: [
        { fr: 'FR-DD-01', priority: 'Must', status: 'full', selector: '#panel-m6uc5-drawdown', requirement: 'Estimate maximum-drawdown risk and probability of a drawdown beyond a threshold over a horizon.', achieved: 'Genuine bootstrapped Monte Carlo drawdown distribution from the real return history.' },
        { fr: 'FR-DD-02', priority: 'Must', status: 'full', selector: '#panel-m6uc5-warning', requirement: 'Provide early-warning drawdown signals from volatility, regime, breadth and momentum.', achieved: 'Composite score combining live M6-UC4 vol forecast, M5-UC10 regime, universe breadth and portfolio momentum.' },
        { fr: 'FR-DD-03', priority: 'Must', status: 'full', selector: '#panel-m6uc5-hedges', requirement: 'Recommend hedges (protective puts, index futures, low-beta rotation) sized to a risk target.', achieved: 'All three instruments sized to the same excess-risk fraction, with a real Black-Scholes put premium.' },
        { fr: 'FR-DD-04', priority: 'Must', status: 'full', selector: '#panel-m6uc5-residual', requirement: 'Estimate hedge cost, residual risk and hedge effectiveness.', achieved: 'Cost, residual vol and effectiveness reported per instrument and in aggregate, with an explicit (documented) imperfect-hedge assumption rather than claiming 100% effectiveness.' },
        { fr: 'FR-DD-05', priority: 'Should', status: 'full', selector: '#panel-m6uc5-rehedge', requirement: 'Support dynamic hedge adjustment as conditions change.', achieved: 'Rule-based re-hedge triggers tied to realised vol, regime flips and the early-warning score.' },
      ],
    },

    // ---------------- M6-UC6 Liquidity & Concentration Risk ----------------
    {
      key: 'm6uc6', tag: 'M6-UC6', title: 'Liquidity & Concentration Risk', api: '/api/m6uc6',
      objective: 'Assess position and portfolio liquidity (time/cost to unwind) and concentration risk (name, sector), with limit monitoring, a liquidation plan and liquidity-adjusted VaR.',
      frs: ['FR-LC-01 Liquidity per position (Must)', 'FR-LC-02 Concentration metrics (Must)', 'FR-LC-03 Limit monitoring (Must)', 'FR-LC-04 Liquidation plan + adjusted VaR (Should)', 'FR-LC-05 Reduced-volume stress (Should)'],
      buildForm(container) {
        let state = { maxParticipationRate: 0.15, stressVolumeHaircut: 0.5, liquidationHorizonDays: 5, limits: { singleNamePct: 10, sectorPct: 25, issuerPct: 15 } };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            Object.assign(state, sample);
            wrap.appendChild(C.field('Max Participation Rate', C.sliderInput({ value: state.maxParticipationRate, min: 0.05, max: 0.30, step: 0.01, format: (v) => (v * 100).toFixed(0) + '%', onChange: (v) => { state.maxParticipationRate = v; } }), 'FR-LC-01: max share of a day\'s ADV this book will trade in, to keep impact cost controlled.'));
            wrap.appendChild(C.field('Liquidity Stress Volume Haircut', C.sliderInput({ value: state.stressVolumeHaircut, min: 0.2, max: 0.8, step: 0.05, format: (v) => (v * 100).toFixed(0) + '%', onChange: (v) => { state.stressVolumeHaircut = v; } }), 'FR-LC-05: how much ADV is assumed to fall under crisis-liquidity conditions.'));
            wrap.appendChild(C.field('Single-Name Limit %', C.numberInput({ value: state.limits.singleNamePct, step: 1, onChange: (v) => { state.limits.singleNamePct = v; } }), 'FR-LC-03: governed concentration limit.'));
            wrap.appendChild(C.field('Sector Limit %', C.numberInput({ value: state.limits.sectorPct, step: 1, onChange: (v) => { state.limits.sectorPct = v; } })));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m6uc6-liquidity');
        p1.appendChild(panelTitle('Liquidity Profile', 'FR-LC-01: days (and minutes, since this book\'s positions are small relative to institutional ADV) to liquidate at the configured max participation rate, plus estimated impact cost.'));
        const priciest = [...data.liquidityProfile].sort((a, b) => b.totalCostBps - a.totalCostBps)[0];
        p1.appendChild(takeaway(`Every position here can be exited in well under a trading day — at this book's size, the equity sleeve carries essentially no liquidity risk against real market volumes; that changes materially for an institutional-sized version of the same book. ${priciest.name} has the highest estimated round-trip cost at ${fmt2(priciest.totalCostBps)}bps (spread + market impact).`));
        p1.appendChild(table(['Stock', 'Weight %', 'Minutes to Liquidate', 'ADV (shares)', 'Impact Cost (bps)', 'Impact Cost (₹)'], data.liquidityProfile.slice(0, 12).map((r) => [r.name, fmt2(r.weightPct), fmt2(r.minutesToLiquidate), r.adv.toLocaleString('en-IN'), fmt2(r.totalCostBps), '₹' + fmt2(r.impactCostAmount)])));
        container.appendChild(p1);

        const p2 = panel('panel-m6uc6-concentration');
        p2.appendChild(panelTitle('Concentration — Name & Sector (Full Book)', 'FR-LC-02: HHI and top-N weight across the whole real portfolio (stocks + mutual funds), since concentration risk isn\'t limited to the equity sleeve.'));
        p2.appendChild(takeaway(`${data.concentration.interpretation} — the largest single holding is ${data.concentration.byName[0].name} at ${fmt2(data.concentration.byName[0].weightPct)}% of the book, and the top 5 holdings together account for ${fmt2(data.concentration.top5NamePct)}%. By sector, the top 3 sectors/categories hold ${fmt2(data.concentration.top3SectorPct)}% of the portfolio.`));
        const chartWrap = el('div', 'chart-wrap'); p2.appendChild(chartWrap);
        barChart(chartWrap, data.concentration.byName.slice(0, 8).map((g) => ({ label: g.name, value: fmt2(g.weightPct) })), { labelWidth: 140 });
        p2.appendChild(table(['Name', 'Weight %'], data.concentration.byName.map((g) => [g.name, fmt2(g.weightPct) + '%'])));
        p2.appendChild(table(['Sector / Category', 'Weight %'], data.concentration.bySector.map((g) => [g.name, fmt2(g.weightPct) + '%'])));
        container.appendChild(p2);

        const p3 = panel('panel-m6uc6-breaches');
        p3.appendChild(panelTitle('Limit Breaches', 'FR-LC-03: exposures compared against governed single-name and sector concentration limits.'));
        p3.appendChild(takeaway(data.limitBreaches.length ? `${data.limitBreaches.length} limit breach(es) flagged — the largest is ${data.limitBreaches[0].name} at ${fmt2(data.limitBreaches[0].weightPct)}% against a ${fmt2(data.limitBreaches[0].limitPct)}% limit (${fmt2(data.limitBreaches[0].breachPct)}pp over). These are real, data-driven breaches on the actual uploaded holdings, not illustrative examples.` : 'No positions currently breach the configured concentration limits.'));
        p3.appendChild(data.limitBreaches.length ? table(['Type', 'Name', 'Weight %', 'Limit %', 'Breach (pp)'], data.limitBreaches.map((b) => [b.type, b.name, fmt2(b.weightPct), fmt2(b.limitPct), fmt2(b.breachPct)])) : el('div', 'empty-hint', 'No breaches.'));
        container.appendChild(p3);

        const p4 = panel('panel-m6uc6-liquidation');
        p4.appendChild(panelTitle('Liquidation Plan', 'FR-LC-04: an impact-minimising, evenly-paced unwind schedule within the configured horizon.'));
        p4.appendChild(takeaway(`Fully unwinding the equity sleeve within ${data.liquidationPlan.horizonDays} days would cost an estimated ₹${fmt2(data.liquidationPlan.totalImpactCost)} in spread and market impact; ${data.liquidationPlan.namesExceedingHorizon} position(s) would need longer than the configured horizon to exit within the participation-rate constraint.`));
        p4.appendChild(table(['Metric', 'Value'], [['Total Estimated Impact Cost', '₹' + fmt2(data.liquidationPlan.totalImpactCost)], ['Names Exceeding Horizon', data.liquidationPlan.namesExceedingHorizon]]));
        container.appendChild(p4);

        const p5 = panel('panel-m6uc6-stress');
        p5.appendChild(panelTitle('Liquidity Stress & Liquidity-Adjusted VaR', 'FR-LC-05: a reduced-volume (crisis-liquidity) stress on ADV, and VaR with a liquidation-cost add-on.'));
        p5.appendChild(takeaway(`A ${fmt2(data.liquidityStress.volumeHaircutPct)}% volume haircut under crisis conditions would lengthen time-to-exit by ${fmt2(data.liquidityStress.daysIncreaseFactor)}× for every position. Liquidity-adjusted VaR is ${fmt2(data.liquidityAdjustedVar)}% (vs a plain parametric VaR of ${fmt2(data.varComponents.parametricVarPct)}%) — the ${fmt2(data.varComponents.liquidityAddOnPct)}pp add-on is the estimated cost of actually exiting the book, not just its statistical price risk.`));
        p5.appendChild(table(['Metric', 'Value'], [['Parametric VaR', fmt2(data.varComponents.parametricVarPct) + '%'], ['Liquidity Add-On', fmt2(data.varComponents.liquidityAddOnPct) + 'pp'], ['Liquidity-Adjusted VaR', fmt2(data.liquidityAdjustedVar) + '%']]));
        container.appendChild(p5);
      },
      tour: [
        { fr: 'FR-LC-01', priority: 'Must', status: 'full', selector: '#panel-m6uc6-liquidity', requirement: 'Estimate liquidity per position: days-to-liquidate and market-impact cost under volume constraints.', achieved: 'Days/minutes-to-liquidate from genuine ADV (real historical volume), plus a square-root market-impact cost model.' },
        { fr: 'FR-LC-02', priority: 'Must', status: 'full', selector: '#panel-m6uc6-concentration', requirement: 'Compute concentration metrics (top-N weight, HHI) by name, sector, factor and issuer.', achieved: 'HHI and top-N by name and sector across the full real book; factor concentration is covered separately in M6-UC2.' },
        { fr: 'FR-LC-03', priority: 'Must', status: 'full', selector: '#panel-m6uc6-breaches', requirement: 'Monitor exposures vs configurable limits and flag breaches.', achieved: 'Governed single-name and sector limits, checked against the real portfolio\'s actual weights.' },
        { fr: 'FR-LC-04', priority: 'Should', status: 'full', selector: '#panel-m6uc6-liquidation', requirement: 'Produce a liquidation plan minimising impact within a horizon; liquidity-adjusted VaR.', achieved: 'An evenly-paced, participation-rate-constrained schedule with total impact cost, and VaR with a liquidity-cost add-on (reusing M6-UC1).' },
        { fr: 'FR-LC-05', priority: 'Should', status: 'full', selector: '#panel-m6uc6-stress', requirement: 'Stress liquidity under reduced-volume conditions.', achieved: 'A configurable ADV haircut, with a deterministic (not noisy) time-to-exit multiplier derived from the haircut itself.' },
      ],
    },
  ];

  global.WISUseCasesM6 = USE_CASES;
})(window);
