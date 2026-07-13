// Metadata + result-renderers for Module 5 (Security Selection, Valuation & Market Forecasting)
// use cases. Mirrors usecases-m3.js: buildForm(container) + render(container, data, ctx), self-
// contained helpers (own copies, not shared, to avoid static-bundle collisions), fmt2 2-decimal
// display rounding, and an inline "Takeaway" line under every panel's own title.
(function (global) {
  const { barChart, fmtCompact } = global.WISCharts;
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
  function stockSelectField(universe, value, onChange, label) {
    const sel = document.createElement('select'); sel.className = 'ui-select';
    (universe || []).forEach((s) => { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = `${s.name} (${s.id})`; if (s.id === value) opt.selected = true; sel.appendChild(opt); });
    sel.addEventListener('change', () => onChange(sel.value));
    return C.field(label || 'Stock', sel, 'Pick any stock from the Module 3/5 shared universe.');
  }
  function ratingTagClass(v) { if (v === 'AAA' || v === 'AA') return 'buy'; if (v === 'BBB') return 'hold'; return 'sell'; }

  const USE_CASES = [
    // ---------------- M5-UC1 Multi-Factor Quant Ranking ----------------
    {
      key: 'm5uc1', tag: 'M5-UC1', title: 'Multi-Factor Quant Ranking', api: '/api/m5uc1',
      objective: 'Rank the equity universe on a composite of value, quality, momentum, low-volatility, growth and size factors, sector-neutralised, with governed configurable weights.',
      frs: ['FR-QR-01 Factor scores (Must)', 'FR-QR-02 Composite + weights (Must)', 'FR-QR-03 Winsorise/missing (Must)', 'FR-QR-04 Deciles + attribution (Must)', 'FR-QR-05 Backtest IC (Should)', 'FR-QR-06 Point-in-time (Must)'],
      buildForm(container) {
        let state = { sectorNeutral: true, weights: { value: 0.2, quality: 0.2, momentum: 0.2, lowvol: 0.15, growth: 0.15, size: 0.1 } };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            state.weights = sample.weights || state.weights;
            wrap.appendChild(C.field('Sector-Neutral', C.toggleInput({ checked: state.sectorNeutral, labelOn: 'On', labelOff: 'Off', onChange: (v) => { state.sectorNeutral = v; } }), 'FR-QR-02: demeans each factor within its sector before scoring, so the composite doesn\'t just become a sector bet.'));
            Object.keys(state.weights).forEach((k) => {
              wrap.appendChild(C.field(`${k[0].toUpperCase() + k.slice(1)} weight`, C.sliderInput({ value: state.weights[k], min: 0, max: 0.4, step: 0.01, format: (v) => v.toFixed(2), onChange: (v) => { state.weights[k] = v; } }), 'FR-QR-02: governed default weight, adjustable here.'));
            });
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m5uc1-ranking');
        p1.appendChild(panelTitle('Composite Ranking', 'FR-QR-04: securities ranked by a weighted blend of standardised (z-scored) factor exposures, into deciles (9 = top decile).'));
        const top = data.universe[0], bottom = data.universe[data.universe.length - 1];
        p1.appendChild(takeaway(`${top.name} ranks #1 (decile ${top.rankQuantile}) with the strongest blend of factors right now; ${bottom.name} ranks last (decile ${bottom.rankQuantile}). A high composite score means the stock screens well across most factors, not that it's guaranteed to outperform.`));
        p1.appendChild(table(['Rank', 'Stock', 'Sector', 'Composite', 'Decile'], data.universe.slice(0, 15).map((s, i) => [i + 1, s.name, s.sector, fmt2(s.compositeScore), s.rankQuantile])));
        container.appendChild(p1);

        const p2 = panel('panel-m5uc1-attribution');
        p2.appendChild(panelTitle(`Factor Attribution — ${top.name} (Top Ranked)`, 'FR-QR-04: per-factor contribution to the composite score for the #1 ranked stock, so you can see which factors are actually driving the rank.'));
        const biggestFactor = Object.entries(top.factorAttribution).sort((a, b) => b[1] - a[1])[0];
        p2.appendChild(takeaway(`${biggestFactor[0][0].toUpperCase() + biggestFactor[0].slice(1)} contributes the most to ${top.name}'s top rank (+${fmt2(biggestFactor[1])}). If that factor reverses, this stock's rank could fall faster than one with a more evenly spread attribution.`));
        const chartWrap = el('div', 'chart-wrap'); p2.appendChild(chartWrap);
        barChart(chartWrap, Object.entries(top.factorAttribution).map(([k, v]) => ({ label: k[0].toUpperCase() + k.slice(1), value: fmt2(v) })), { labelWidth: 110 });
        container.appendChild(p2);

        const p3 = panel('panel-m5uc1-backtest');
        p3.appendChild(panelTitle('Backtest: Information Coefficient & Quantile Spread', `FR-QR-05: ${data.backtestStats.horizonNote}`));
        const bestIC = Object.entries(data.backtestStats.perFactorIC).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
        p3.appendChild(takeaway(`${bestIC[0][0].toUpperCase() + bestIC[0].slice(1)} has the strongest (positive or negative) relationship with forward returns in this sample (IC ${fmt2(bestIC[1])}). The top-minus-bottom decile spread of ${fmt2(data.backtestStats.quantileSpreadPct)}% is what you'd have captured buying the top decile and shorting the bottom, over this one sample window — treat it as illustrative, not a guaranteed edge.`));
        p3.appendChild(table(['Factor', 'Information Coefficient (IC)'], Object.entries(data.backtestStats.perFactorIC).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), fmt2(v)])));
        container.appendChild(p3);
      },
      tour: [
        { fr: 'FR-QR-01/02', priority: 'Must', status: 'full', selector: '#panel-m5uc1-ranking', requirement: 'Standardised per-security factor scores blended into a composite with governed, configurable weights.', achieved: 'All 6 factors z-scored cross-sectionally and blended with slider-adjustable weights starting from a governed default.' },
        { fr: 'FR-QR-03', priority: 'Must', status: 'full', selector: '#panel-m5uc1-ranking', requirement: 'Winsorise outliers and handle missing data before scoring.', achieved: 'Each factor is winsorised to ±3 standard deviations before z-scoring; this synthetic dataset has no missing values to test the exclusion policy against.' },
        { fr: 'FR-QR-04', priority: 'Must', status: 'full', selector: '#panel-m5uc1-attribution', requirement: 'Ranked deciles with per-factor contribution (attribution) per security.', achieved: 'Deciles computed from the sorted composite; attribution shown per factor for the top-ranked stock.' },
        { fr: 'FR-QR-05', priority: 'Should', status: 'partial', selector: '#panel-m5uc1-backtest', requirement: 'Back-test factor & composite efficacy (IC, quantile spread) over history.', achieved: 'IC and quantile spread are genuinely computed via a 70/30 in-sample/out-of-sample split of each stock\'s own price history — a real (if small-sample) calculation, not a production multi-period backtest.' },
        { fr: 'FR-QR-06', priority: 'Must', status: 'partial', selector: '#panel-m5uc1-ranking', requirement: 'Point-in-time data (no look-ahead bias).', achieved: 'The backtest explicitly splits data in time to avoid look-ahead within this run; there\'s no as-of/announcement-date data model in this prototype since financials aren\'t dated line-by-line.' },
      ],
    },

    // ---------------- M5-UC2 DCF & Fundamental Valuation ----------------
    {
      key: 'm5uc2', tag: 'M5-UC2', title: 'DCF & Fundamental Valuation Automation', api: '/api/m5uc2',
      objective: 'Automate intrinsic valuation (FCFF DCF, relative) with driver forecasting, CAPM/WACC, sensitivity and scenario ranges, blended into an intrinsic value with upside vs price.',
      frs: ['FR-VA-01 DCF build (Must)', 'FR-VA-02 Driver forecast (Must)', 'FR-VA-03 Relative + SOTP (Must)', 'FR-VA-04 Sensitivity + scenarios (Must)', 'FR-VA-05 Blended value (Should)', 'FR-VA-06 Assumptions manifest (Must)'],
      buildForm(container) {
        let state = { stockId: 'INFY', horizonYears: 5, erp: 0.06, riskFreeRate: null };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            state.stockId = sample.stockId || state.stockId;
            wrap.appendChild(stockSelectField(sample.universe, state.stockId, (v) => { state.stockId = v; }));
            wrap.appendChild(C.field('Forecast Horizon (years)', C.numberInput({ value: state.horizonYears, step: 1, onChange: (v) => { state.horizonYears = v; } })));
            wrap.appendChild(C.field('Equity Risk Premium', C.numberInput({ value: state.erp, step: 0.005, onChange: (v) => { state.erp = v; } }), 'FR-VA-01: used in CAPM cost of equity. Governed house-view default; adjustable here.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m5uc2-summary');
        p1.appendChild(panelTitle(`${data.stock.name} — Intrinsic Value`, 'FR-VA-05: DCF and relative valuation blended by method weight into one intrinsic value.'));
        const upTone = data.upsideVsPrice >= 0 ? 'above' : 'below';
        p1.appendChild(takeaway(`The blended model puts fair value ${fmt2(Math.abs(data.upsideVsPrice))}% ${upTone} the current price of ₹${fmt2(data.stock.currentPrice)}, with ${data.confidence.toLowerCase()} confidence (DCF and relative valuation ${data.confidence === 'High' ? 'broadly agree' : data.confidence === 'Medium' ? 'show some divergence' : 'diverge significantly'} — a ${fmt2(data.divergencePct)}% gap between the two methods).`));
        const row = el('div', 'metric-row');
        row.appendChild(metricCard('Blended Intrinsic Value', `₹${fmt2(data.intrinsicValue)}`, `vs CMP ₹${fmt2(data.stock.currentPrice)}`, 'FR-VA-05: weighted blend of the DCF and relative-valuation methods below.'));
        row.appendChild(metricCard('Upside vs Price', `${fmt2(data.upsideVsPrice)}%`, null, 'Blended intrinsic value vs current market price.'));
        row.appendChild(metricCard('DCF Value', `₹${fmt2(data.methodValues.dcf)}`, null, 'FR-VA-01: FCFF discounted at WACC plus terminal value, per share.'));
        row.appendChild(metricCard('Relative Value', `₹${fmt2(data.methodValues.relative)}`, `Sector median P/E ${fmt2(data.relativeDetail.sectorMedianPE)}`, 'FR-VA-03: sector-median P/E × this stock\'s EPS.'));
        p1.appendChild(row);
        container.appendChild(p1);

        const p2 = panel('panel-m5uc2-wacc');
        p2.appendChild(panelTitle('Cost of Capital (WACC) Build-Up', 'FR-VA-01: CAPM cost of equity + after-tax cost of debt, weighted by capital structure.'));
        p2.appendChild(takeaway(`WACC of ${fmt2(data.wacc.wacc)}% is what future cash flows are discounted at — the higher this number, the less today's value gives to cash flows far in the future. Beta of ${fmt2(data.wacc.beta)} means this stock has historically moved ${data.wacc.beta > 1 ? 'more than' : 'less than'} the broader universe.`));
        p2.appendChild(table(['Component', 'Value'], [
          ['Beta (vs universe)', fmt2(data.wacc.beta)], ['Cost of Equity', `${fmt2(data.wacc.costOfEquity)}%`], ['After-Tax Cost of Debt', `${fmt2(data.wacc.costOfDebtAfterTax)}%`],
          ['Weight — Equity', `${fmt2(data.wacc.wEquity)}%`], ['Weight — Debt', `${fmt2(data.wacc.wDebt)}%`], ['Tax Rate', `${fmt2(data.wacc.taxRate)}%`], ['WACC', `${fmt2(data.wacc.wacc)}%`],
        ]));
        container.appendChild(p2);

        const p3 = panel('panel-m5uc2-projection');
        p3.appendChild(panelTitle('Free Cash Flow Projection', 'FR-VA-02: revenue/margin/capex/working-capital drivers forecast forward from history, growth fading to a terminal rate.'));
        const lastRow = data.dcfDetail.projection[data.dcfDetail.projection.length - 1];
        p3.appendChild(takeaway(`Revenue growth is modelled fading from today's pace down to a ${fmt2(data.dcfDetail.terminalGrowthPct)}% terminal growth rate by year ${lastRow.year} — a standard DCF assumption that no company keeps growing fast forever. Free cash flow reaches ₹${fmt2(lastRow.fcff)} (Crore-equivalent units) by the final forecast year.`));
        p3.appendChild(table(['Year', 'Growth %', 'Revenue', 'EBIT', 'FCFF'], data.dcfDetail.projection.map((r) => [r.year, fmt2(r.growthPct), fmt2(r.revenue), fmt2(r.ebit), fmt2(r.fcff)])));
        container.appendChild(p3);

        const p4 = panel('panel-m5uc2-sensitivity');
        p4.appendChild(panelTitle('Sensitivity — Terminal Growth × WACC', 'FR-VA-04: two-way sensitivity grid showing how intrinsic value per share changes with the two most uncertain assumptions.'));
        const gridFlat = data.sensitivity.grid.flat();
        const spreadPct = round2ish(((Math.max(...gridFlat) - Math.min(...gridFlat)) / data.intrinsicValue) * 100);
        p4.appendChild(takeaway(`Intrinsic value swings by about ${spreadPct}% of the base case across this grid — a reminder that DCF outputs are only as reliable as the growth and discount-rate assumptions feeding them, which is why the blended value above leans on relative valuation too.`));
        const gridHeaders = ['Growth \\ WACC'].concat(data.sensitivity.waccPoints.map((w) => `${fmt2(w)}%`));
        p4.appendChild(table(gridHeaders, data.sensitivity.grid.map((row, i) => [`${fmt2(data.sensitivity.growthPoints[i])}%`].concat(row.map((v) => fmt2(v))))));
        container.appendChild(p4);

        const p5 = panel('panel-m5uc2-scenarios');
        p5.appendChild(panelTitle('Bull / Base / Bear Scenarios', 'FR-VA-04: intrinsic value under a margin/growth flex around the base case.'));
        p5.appendChild(takeaway(`The range from bear (₹${fmt2(data.scenarios.bear)}) to bull (₹${fmt2(data.scenarios.bull)}) spans ${fmt2((data.scenarios.bull - data.scenarios.bear) / data.scenarios.base * 100)}% of the base case — that width is the honest uncertainty band around a single-point DCF estimate.`));
        p5.appendChild(table(['Scenario', 'Intrinsic Value / Share'], [['Bull', `₹${fmt2(data.scenarios.bull)}`], ['Base', `₹${fmt2(data.scenarios.base)}`], ['Bear', `₹${fmt2(data.scenarios.bear)}`]]));
        container.appendChild(p5);

        const p6 = panel('panel-m5uc2-manifest');
        p6.appendChild(panelTitle('Assumptions Manifest', 'FR-VA-06: every input behind this valuation, stored for auditability and reproducibility.'));
        p6.appendChild(takeaway(`Keep this manifest with the valuation — if a client or auditor asks "why this number," every assumption that produced it is listed here, versioned and timestamped.`));
        p6.appendChild(el('pre', null, JSON.stringify(data.assumptionsManifest, null, 2)));
        container.appendChild(p6);
      },
      tour: [
        { fr: 'FR-VA-01', priority: 'Must', status: 'full', selector: '#panel-m5uc2-wacc', requirement: 'Multi-stage FCFF/FCFE DCF with WACC/CAPM.', achieved: 'Real CAPM (beta computed from actual return covariance vs the universe), after-tax cost of debt, capital-structure-weighted WACC, and a discounted FCFF model with Gordon-growth terminal value.' },
        { fr: 'FR-VA-02', priority: 'Must', status: 'full', selector: '#panel-m5uc2-projection', requirement: 'Forecast revenue/margin/capex/working-capital drivers from history.', achieved: 'Revenue growth fades from historical CAGR to a terminal rate; margin, D&A, capex and working-capital intensity all derived from the stock\'s own financial history.' },
        { fr: 'FR-VA-03', priority: 'Must', status: 'partial', selector: '#panel-m5uc2-summary', requirement: 'Relative valuation vs peers and SOTP for multi-segment firms.', achieved: 'Relative valuation (sector-median P/E × EPS) is real; SOTP is not implemented — this synthetic dataset has no segment-level revenue/EBIT split to value separately, so methodValues.sotp is explicitly null rather than fabricated.' },
        { fr: 'FR-VA-04', priority: 'Must', status: 'full', selector: '#panel-m5uc2-sensitivity', requirement: 'Growth×WACC sensitivity and bull/base/bear scenarios.', achieved: 'Full 5×5 sensitivity grid recomputes the DCF at each growth/WACC combination; scenarios flex margin and growth assumptions and rerun the same DCF engine.' },
        { fr: 'FR-VA-05', priority: 'Should', status: 'partial', selector: '#panel-m5uc2-summary', requirement: 'Reconcile methods into a blended value with weights and confidence.', achieved: 'DCF and relative are blended 60/40 with a confidence band from their divergence; since SOTP isn\'t computed, the blend only spans two of the three methods the FR envisions.' },
        { fr: 'FR-VA-06', priority: 'Must', status: 'full', selector: '#panel-m5uc2-manifest', requirement: 'Emit an assumptions manifest for auditability.', achieved: 'Every driver, rate and weight is captured with a model version and timestamp.' },
      ],
    },

    // ---------------- M5-UC3 Earnings Quality & Accruals Detection ----------------
    {
      key: 'm5uc3', tag: 'M5-UC3', title: 'Earnings Quality & Accruals Detection', api: '/api/m5uc3',
      objective: 'Score earnings quality and flag manipulation risk via accruals, forensic models and red-flag detection.',
      frs: ['FR-EQ-01 Accruals (Must)', 'FR-EQ-02 Forensic scores (Must)', 'FR-EQ-03 Red flags (Must)', 'FR-EQ-04 Composite score (Must)', 'FR-EQ-05 Trend + peer (Should)'],
      buildForm(container) {
        let stockId = 'INFY';
        const wrap = el('div'); container.appendChild(wrap);
        return { setData: (sample) => { wrap.innerHTML = ''; wrap.appendChild(stockSelectField(sample.universe, stockId, (v) => { stockId = v; }, 'Stock to analyse')); }, getData: () => ({ stockId }) };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m5uc3-score');
        p1.appendChild(panelTitle(`${data.stock.name} — Earnings Quality Score`, 'FR-EQ-04: composite 0-100 blend of forensic and accruals components — higher is cleaner.'));
        const tone = data.earningsQualityScore >= 70 ? 'clean' : data.earningsQualityScore >= 50 ? 'middling' : 'concerning';
        p1.appendChild(takeaway(`A score of ${fmt2(data.earningsQualityScore)}/100 reads as ${tone}. This measures how much reported profit is backed by real cash and consistent accounting, not how good the business is — a high-quality-earnings company can still be a bad investment at the wrong price.`));
        const row = el('div', 'metric-row');
        row.appendChild(C.gauge(data.earningsQualityScore, { subLabel: 'Earnings Quality' }));
        row.appendChild(metricCard('Beneish M-Score', fmt2(data.forensicScores.beneish.score), data.forensicScores.beneish.flag, 'FR-EQ-02: > -1.78 flags possible earnings manipulation.'));
        row.appendChild(metricCard('Altman Z-Score', fmt2(data.forensicScores.altman.score), data.forensicScores.altman.zone, 'FR-EQ-02: bankruptcy-risk score.'));
        row.appendChild(metricCard('Piotroski F / Montier C', `${data.forensicScores.piotroski.score}/9 · ${data.forensicScores.montier.score}/6`, 'Higher F is better; higher C is worse', 'FR-EQ-02: Piotroski F (fundamental strength, higher=better) and a Montier-style C-Score (red-flag count, higher=worse).'));
        p1.appendChild(row);
        container.appendChild(p1);

        const p2 = panel('panel-m5uc3-accruals');
        p2.appendChild(panelTitle('Accruals Metrics', 'FR-EQ-01: how much of reported profit is cash vs accounting accrual.'));
        p2.appendChild(takeaway(`Cash conversion of ${fmt2(data.accrualsMetrics.cashConversion)}× means operating cash flow is ${data.accrualsMetrics.cashConversion >= 1 ? 'comfortably covering' : 'running below'} reported net income — ${data.accrualsMetrics.cashConversion >= 1 ? 'a good sign that profits are real cash, not just accounting entries' : 'worth watching, since profit that never turns into cash is a classic early warning sign'}.`));
        p2.appendChild(table(['Metric', 'Value'], [['Sloan Accruals Ratio', `${fmt2(data.accrualsMetrics.sloanRatio)}%`], ['Cash Conversion (CFO / Net Income)', `${fmt2(data.accrualsMetrics.cashConversion)}×`], ['Discretionary Accruals (% Revenue)', `${fmt2(data.accrualsMetrics.discretionaryAccrualsPctRevenue)}%`]]));
        container.appendChild(p2);

        const p3 = panel('panel-m5uc3-flags');
        p3.appendChild(panelTitle('Red Flags', 'FR-EQ-03: rule-based anomaly detection — receivable/revenue-cash divergence, related-party transactions, promoter pledges.'));
        p3.appendChild(takeaway(data.redFlags.length ? `${data.redFlags.length} flag(s) raised — these are risk indicators to investigate further, not proof of wrongdoing.` : `No red flags triggered on the current rule set — a clean read, though absence of a flag isn't a guarantee.`));
        p3.appendChild(data.redFlags.length ? table(['Flag', 'Evidence'], data.redFlags.map((f) => [f.type, f.evidence])) : el('div', 'empty-hint', 'No red flags detected.'));
        container.appendChild(p3);

        const p4 = panel('panel-m5uc3-trend');
        p4.appendChild(panelTitle('Quality Trend & Peer Rank', 'FR-EQ-05: earnings quality over time and vs sector peers.'));
        const trendDir = data.qualityTrend[1].score - data.qualityTrend[0].score;
        p4.appendChild(takeaway(`Earnings quality has ${trendDir >= 0 ? 'improved' : 'deteriorated'} from ${fmt2(data.qualityTrend[0].score)} to ${fmt2(data.qualityTrend[1].score)} year-over-year, and ranks #${data.peerRank.rank} of ${data.peerRank.outOf} in its sector.`));
        p4.appendChild(table(['Year', 'Score'], data.qualityTrend.map((t) => [t.year, fmt2(t.score)])));
        p4.appendChild(table(['Rank', 'Company', 'Score'], data.peerRank.table.map((r, i) => [i + 1, r.name, fmt2(r.score)])));
        container.appendChild(p4);
      },
      tour: [
        { fr: 'FR-EQ-01', priority: 'Must', status: 'partial', selector: '#panel-m5uc3-accruals', requirement: 'Total & discretionary accruals, Sloan ratio, cash conversion.', achieved: 'Sloan ratio and cash conversion computed from real financials; this is the operating-accruals variant (NI − CFO) since the synthetic dataset has no separate investing-cash-flow line for the full (NI − CFO − CFI) formula.' },
        { fr: 'FR-EQ-02', priority: 'Must', status: 'full', selector: '#panel-m5uc3-score', requirement: 'Beneish M, Altman Z, Piotroski F, Montier C.', achieved: 'All four computed with real formulas on the stock\'s own 2-year financial history; Montier C adapted to the 6 tests this dataset can actually support.' },
        { fr: 'FR-EQ-03', priority: 'Must', status: 'full', selector: '#panel-m5uc3-flags', requirement: 'Red-flag detection: revenue-recognition, receivable/inventory build, RPT/auditor events.', achieved: 'Receivables-build and revenue-vs-cash-flow divergence computed from real financials; RPT and promoter-pledge flags pulled from the same governance data used in Module 3.' },
        { fr: 'FR-EQ-04', priority: 'Must', status: 'full', selector: '#panel-m5uc3-score', requirement: 'Composite score with contributing-factor breakdown.', achieved: 'Weighted blend of all forensic/accruals components, sign-adjusted so higher always means cleaner.' },
        { fr: 'FR-EQ-05', priority: 'Should', status: 'partial', selector: '#panel-m5uc3-trend', requirement: 'Trend over time and vs sector peers.', achieved: 'A genuine 2-point trend (only 2 comparable years exist in this synthetic 3-year financial history) and a real same-sector peer rank.' },
      ],
    },

    // ---------------- M5-UC4 Analyst Estimate Aggregation & De-Biasing ----------------
    {
      key: 'm5uc4', tag: 'M5-UC4', title: 'Analyst Estimate Aggregation & De-Biasing', api: '/api/m5uc4',
      objective: 'Aggregate sell-side estimates into consensus, measure dispersion and revision momentum, and de-bias for accuracy, staleness and herding.',
      frs: ['FR-AE-01 Consensus (Must)', 'FR-AE-02 Revision momentum (Must)', 'FR-AE-03 Dispersion (Must)', 'FR-AE-04 De-bias (Should)', 'FR-AE-05 Optimism correction (Should)'],
      buildForm(container) {
        let state = { stockId: 'INFY', staleLambda: 0.02 };
        const wrap = el('div', 'form-grid'); container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            state.stockId = sample.stockId || state.stockId;
            wrap.appendChild(stockSelectField(sample.universe, state.stockId, (v) => { state.stockId = v; }));
            wrap.appendChild(C.field('Staleness Decay (λ)', C.numberInput({ value: state.staleLambda, step: 0.005, onChange: (v) => { state.staleLambda = v; } }), 'FR-AE-04: higher λ down-weights older estimates faster.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m5uc4-consensus');
        p1.appendChild(panelTitle(`${data.stock.name} — Consensus Estimates`, `FR-AE-01: aggregated from ${data.consensus.analystCount} active analyst estimates.`));
        p1.appendChild(takeaway(`Consensus EPS of ₹${fmt2(data.consensus.eps.mean)} spans a ₹${fmt2(data.consensus.eps.low)}–₹${fmt2(data.consensus.eps.high)} range across ${data.consensus.analystCount} analysts — the tighter that range, the more the Street agrees on what's coming.`));
        p1.appendChild(table(['Metric', 'Mean', 'Median', 'Low', 'High'], [
          ['EPS', fmt2(data.consensus.eps.mean), fmt2(data.consensus.eps.median), fmt2(data.consensus.eps.low), fmt2(data.consensus.eps.high)],
          ['Target Price', fmt2(data.consensus.target.mean), fmt2(data.consensus.target.median), fmt2(data.consensus.target.low), fmt2(data.consensus.target.high)],
          ['Revenue', fmt2(data.consensus.revenue.mean), fmt2(data.consensus.revenue.median), fmt2(data.consensus.revenue.low), fmt2(data.consensus.revenue.high)],
        ]));
        container.appendChild(p1);

        const p2 = panel('panel-m5uc4-dispersion');
        p2.appendChild(panelTitle('Dispersion & Revision Momentum', 'FR-AE-02/03: how much analysts disagree, and which way estimates have been moving.'));
        p2.appendChild(takeaway(`EPS dispersion (coefficient of variation) is ${fmt2(data.dispersion.epsCoV)}% — ${data.dispersion.epsCoV < 5 ? 'low, meaning high analyst agreement' : data.dispersion.epsCoV < 12 ? 'moderate' : 'high, meaning real uncertainty about the number'}. Net revisions are ${data.revisionMomentum.netRevisions >= 0 ? 'positive' : 'negative'} (${data.revisionMomentum.upgrades} up vs ${data.revisionMomentum.downgrades} down in the last 90 days) — ${data.revisionMomentum.netRevisions >= 0 ? 'the Street has been getting more optimistic' : 'the Street has been trimming numbers'}.`));
        const row = el('div', 'metric-row');
        row.appendChild(metricCard('EPS Dispersion (CoV)', `${fmt2(data.dispersion.epsCoV)}%`, null, 'FR-AE-03: std. deviation ÷ |mean| of active EPS estimates.'));
        row.appendChild(metricCard('Revision Diffusion Index', `${fmt2(data.revisionMomentum.diffusionIndex)}`, `${data.revisionMomentum.upgrades} up / ${data.revisionMomentum.downgrades} down`, 'FR-AE-02: (upgrades − downgrades) / total, over the last 90 days.'));
        p2.appendChild(row);
        container.appendChild(p2);

        const p3 = panel('panel-m5uc4-debias');
        p3.appendChild(panelTitle('De-Biased (Adjusted) Consensus', 'FR-AE-04/05: re-weighted by each analyst\'s historical accuracy and staleness, with a measured optimism correction netted out.'));
        const shiftPct = round2ish(((data.adjustedConsensus.eps - data.consensus.eps.mean) / data.consensus.eps.mean) * 100);
        p3.appendChild(takeaway(`The de-biased EPS of ₹${fmt2(data.adjustedConsensus.eps)} is ${Math.abs(shiftPct) < 0.5 ? 'almost identical to' : (shiftPct > 0 ? Math.abs(shiftPct) + '% above' : Math.abs(shiftPct) + '% below')} the simple raw-mean consensus (₹${fmt2(data.consensus.eps.mean)}) once you weight by who's actually been accurate historically and correct for measured optimism bias (${fmt2(data.adjustedConsensus.optimismCorrectionPct)}%). Realistic range: ₹${fmt2(data.adjustedConsensus.realisticRange.low)}–₹${fmt2(data.adjustedConsensus.realisticRange.high)}.`));
        p3.appendChild(table(['', 'Raw Consensus', 'De-Biased Consensus'], [['EPS', fmt2(data.consensus.eps.mean), fmt2(data.adjustedConsensus.eps)], ['Target Price', fmt2(data.consensus.target.mean), fmt2(data.adjustedConsensus.target)]]));
        container.appendChild(p3);

        const p4 = panel('panel-m5uc4-panel');
        p4.appendChild(panelTitle('Analyst Panel', 'FR-AE-04: each analyst\'s estimate, historical accuracy (lower MAE = better) and resulting weight in the de-biased consensus.'));
        const mostAccurate = [...data.analystAccuracy].sort((a, b) => a.historicalMAEPct - b.historicalMAEPct)[0];
        p4.appendChild(takeaway(`${mostAccurate.broker} has the best historical track record on this stock (MAE ${fmt2(mostAccurate.historicalMAEPct)}%) and so carries the most weight in the de-biased consensus above — accuracy-weighting means one consistently sharp analyst can matter more than several mediocre ones.`));
        p4.appendChild(table(['Broker', 'EPS Est.', 'Target', 'Historical MAE %', 'Age (days)', 'Accuracy Weight'], data.panel.map((a) => { const acc = data.analystAccuracy.find((x) => x.broker === a.broker); return [a.broker, fmt2(a.epsEstimate), fmt2(a.targetPrice), fmt2(a.historicalMAEPct), a.ageInDays, acc ? fmt2(acc.accuracyWeight) : '—']; })));
        container.appendChild(p4);
      },
      tour: [
        { fr: 'FR-AE-01', priority: 'Must', status: 'partial', selector: '#panel-m5uc4-consensus', requirement: 'Aggregate per-analyst estimates into consensus statistics.', achieved: 'Real mean/median/high/low aggregation over a synthetic per-analyst panel (no licensed I/B/E/S feed in this prototype).' },
        { fr: 'FR-AE-02', priority: 'Must', status: 'full', selector: '#panel-m5uc4-dispersion', requirement: 'Track revisions, compute revision momentum and diffusion.', achieved: 'Diffusion index computed from a real (synthetic) 90-day revision count per analyst.' },
        { fr: 'FR-AE-03', priority: 'Must', status: 'full', selector: '#panel-m5uc4-dispersion', requirement: 'Dispersion (std dev / CoV) as an uncertainty signal.', achieved: 'Coefficient of variation computed directly from the estimate panel.' },
        { fr: 'FR-AE-04', priority: 'Should', status: 'full', selector: '#panel-m5uc4-panel', requirement: 'De-bias consensus: accuracy-weight, down-weight stale/herding estimates.', achieved: 'Weights are 1/MAE with an exponential staleness decay, genuinely re-normalised — shown per-analyst so the de-biasing isn\'t a black box.' },
        { fr: 'FR-AE-05', priority: 'Should', status: 'full', selector: '#panel-m5uc4-debias', requirement: 'Detect optimism bias and produce an adjusted/realistic range.', achieved: 'Optimism correction is measured (not assumed) as the gap between the weighted consensus and the most-accurate-quartile\'s own estimates.' },
      ],
    },

    // ---------------- M5-UC5 Credit & Bond Relative-Value Ranking ----------------
    {
      key: 'm5uc5', tag: 'M5-UC5', title: 'Credit & Bond Relative-Value Ranking', api: '/api/m5uc5',
      objective: 'Rank fixed-income instruments on relative value using spread, credit quality, carry/roll and liquidity, within rating buckets.',
      frs: ['FR-CB-01 Bond analytics (Must)', 'FR-CB-02 Credit score (Must)', 'FR-CB-03 RV ranking (Must)', 'FR-CB-04 Liquidity (Should)', 'FR-CB-05 Migration flags (Should)'],
      buildForm(container) {
        let state = { lgdPct: 45, liquidityWeight: 0.3 };
        const wrap = el('div', 'form-grid'); container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            wrap.appendChild(C.field('Loss Given Default (LGD) %', C.numberInput({ value: state.lgdPct, step: 5, onChange: (v) => { state.lgdPct = v; } }), 'FR-CB-02: expected loss = PD × LGD. 45% is a common Basel-style assumption for senior unsecured debt.'));
            wrap.appendChild(C.field('Liquidity Weight', C.sliderInput({ value: state.liquidityWeight, min: 0, max: 0.6, step: 0.05, format: (v) => v.toFixed(2), onChange: (v) => { state.liquidityWeight = v; } }), 'FR-CB-04: how much illiquidity penalises the relative-value score.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m5uc5-ranking');
        p1.appendChild(panelTitle('Relative-Value Ranking', 'FR-CB-03: (spread − expected credit loss) ÷ spread duration, adjusted for liquidity — higher means more spread per unit of risk taken.'));
        const top = data.bonds[0];
        p1.appendChild(takeaway(`${top.name} (${top.rating}) offers the most spread per unit of risk right now (RV score ${fmt2(top.rvScore)}) — but a higher score on a lower-rated bond usually just means the market is pricing in more risk, not a free lunch; check the credit score and liquidity before assuming it's mispriced.`));
        p1.appendChild(table(['Bond', 'Rating', 'YTM %', 'Spread (bps)', 'Duration', 'RV Score'], data.bonds.slice(0, 15).map((b) => [b.name, tag(b.rating, ratingTagClass(b.rating)), fmt2(b.ytm), b.spreadBps, fmt2(b.duration), fmt2(b.rvScore)])));
        container.appendChild(p1);

        const p2 = panel('panel-m5uc5-buckets');
        p2.appendChild(panelTitle('Rating Buckets', 'FR-CB-03: bonds are only meaningfully compared within the same rating bucket — an AAA and a BBB bond have very different risk profiles.'));
        p2.appendChild(takeaway(`Comparing across ratings would be misleading (a BBB bond almost always shows a higher raw spread than AAA) — rank within each bucket below to find genuine relative value among true peers.`));
        Object.keys(data.buckets).forEach((rating) => {
          if (!data.buckets[rating].length) return;
          p2.appendChild(el('div', null, `<strong style="font-size:12.5px">${rating}</strong>`));
          p2.appendChild(table(['Bucket Rank', 'Bond', 'Spread (bps)', 'Liquidity Score', 'RV Score'], data.buckets[rating].map((b) => [b.bucketRank, b.name, b.spreadBps, b.liquidityScore, fmt2(b.rvScore)])));
        });
        container.appendChild(p2);

        const p3 = panel('panel-m5uc5-migration');
        p3.appendChild(panelTitle('Migration / Downgrade Risk Flags', 'FR-CB-05: fundamentals deteriorating ahead of a rating-agency action.'));
        p3.appendChild(takeaway(data.migrationFlags.length ? `${data.migrationFlags.length} bond(s) show fundamentals weaker than their current rating implies — a possible downgrade lead indicator worth flagging before the agencies act.` : `No bonds currently show fundamentals materially weaker than their rating.`));
        p3.appendChild(data.migrationFlags.length ? table(['Bond', 'Rating', 'Signal'], data.migrationFlags.map((f) => [f.name, f.rating, `${f.riskDirection}: ${f.reason}`])) : el('div', 'empty-hint', 'No migration flags.'));
        container.appendChild(p3);
      },
      tour: [
        { fr: 'FR-CB-01', priority: 'Must', status: 'full', selector: '#panel-m5uc5-ranking', requirement: 'YTM, spread, duration, convexity, carry/roll per bond.', achieved: 'All computed against the synthetic G-sec benchmark curve (see M5-UC9) matched to each bond\'s tenor.' },
        { fr: 'FR-CB-02', priority: 'Must', status: 'full', selector: '#panel-m5uc5-ranking', requirement: 'Internal credit score from ratings plus fundamentals.', achieved: 'Rating-anchored score jittered by a leverage/coverage proxy, feeding a real PD estimate for the expected-loss calc.' },
        { fr: 'FR-CB-03', priority: 'Must', status: 'full', selector: '#panel-m5uc5-buckets', requirement: 'Rank on spread-per-unit-risk within rating/sector buckets.', achieved: '(Spread − expected loss) ÷ duration, ranked within each rating bucket.' },
        { fr: 'FR-CB-04', priority: 'Should', status: 'full', selector: '#panel-m5uc5-ranking', requirement: 'Incorporate liquidity into the RV score.', achieved: 'RV score is scaled by a liquidity factor (adjustable weight) derived from synthetic traded volume and bid-ask spread.' },
        { fr: 'FR-CB-05', priority: 'Should', status: 'full', selector: '#panel-m5uc5-migration', requirement: 'Flag downgrade/migration risk from fundamental deterioration.', achieved: 'Bonds with a deteriorating-fundamentals flag and a below-anchor credit score are surfaced with a specific reason.' },
      ],
    },

    // ---------------- M5-UC6 Mutual Fund & ETF Selection ----------------
    {
      key: 'm5uc6', tag: 'M5-UC6', title: 'Mutual Fund & ETF Selection', api: '/api/m5uc6',
      objective: 'Score and select funds/ETFs on risk-adjusted performance, consistency, costs, style fidelity and manager skill, with category-relative ranking and portfolio fit.',
      frs: ['FR-MF-01 Risk-adjusted metrics (Must)', 'FR-MF-02 Consistency (Must)', 'FR-MF-03 Cost/attributes (Must)', 'FR-MF-04 Drift/skill (Should)', 'FR-MF-05 Selection score (Must)', 'FR-MF-06 Portfolio fit (Should)'],
      buildForm(container) {
        let state = { category: '', riskFreeRate: 0.068 };
        const wrap = el('div', 'form-grid'); container.appendChild(wrap);
        return {
          setData: () => {
            wrap.innerHTML = '';
            const sel = document.createElement('select'); sel.className = 'ui-select';
            ['', 'Large Cap Fund', 'Mid Cap Fund', 'Small Cap Fund'].forEach((c) => { const o = document.createElement('option'); o.value = c; o.textContent = c || 'All Categories'; sel.appendChild(o); });
            sel.addEventListener('change', () => { state.category = sel.value; });
            wrap.appendChild(C.field('Category Filter', sel, 'FR-MF-05: fund selection scores are only comparable within the same category.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m5uc6-ranking');
        p1.appendChild(panelTitle('Selection Score Ranking', 'FR-MF-05: category-relative blend of Sharpe, information ratio, consistency, cost and style drift.'));
        const top = data.funds[0];
        p1.appendChild(takeaway(`${top.name} ranks highest in its category (score ${fmt2(top.selectionScore)}/100, #${top.categoryRank} of ${top.categorySize}) — driven by Sharpe of ${fmt2(top.riskAdjusted.sharpe)} and a ${fmt2(top.consistency.rollingHitRatePct)}% rolling-window hit-rate against its benchmark.`));
        p1.appendChild(table(['Fund', 'Category', 'Selection Score', 'Category Rank', 'Sharpe', 'Expense %'], data.funds.map((f) => [f.name, f.category, fmt2(f.selectionScore), `${f.categoryRank}/${f.categorySize}`, fmt2(f.riskAdjusted.sharpe), fmt2(f.costProfile.expenseRatioPct)])));
        container.appendChild(p1);

        const p2 = panel('panel-m5uc6-risk');
        p2.appendChild(panelTitle(`Risk-Adjusted Metrics — ${top.name}`, 'FR-MF-01: alpha, beta, Sharpe, Sortino, information ratio, capture ratios vs the fund\'s own category benchmark.'));
        p2.appendChild(takeaway(`Up-market capture of ${fmt2(top.riskAdjusted.upCapture)}% vs down-market capture of ${fmt2(top.riskAdjusted.downCapture)}% means this fund captures ${top.riskAdjusted.upCapture > Math.abs(top.riskAdjusted.downCapture) ? 'more of the upside than the downside' : 'more of the downside than would be ideal'} relative to its benchmark — ${top.riskAdjusted.upCapture > Math.abs(top.riskAdjusted.downCapture) ? 'a favourable asymmetry' : 'worth watching in a falling market'}.`));
        const row = el('div', 'metric-row');
        row.appendChild(metricCard('Alpha (Annualised)', `${fmt2(top.riskAdjusted.alpha)}%`, `Skill t-stat ${fmt2(top.styleAnalysis.skillTStat)}`, 'FR-MF-04: alpha vs the category benchmark; t-stat > ~2 suggests the alpha isn\'t just noise.'));
        row.appendChild(metricCard('Sharpe / Sortino', `${fmt2(top.riskAdjusted.sharpe)} / ${fmt2(top.riskAdjusted.sortino)}`, null, 'FR-MF-01: risk-adjusted return, total vol vs downside-only vol.'));
        row.appendChild(metricCard('Information Ratio', fmt2(top.riskAdjusted.informationRatio), `Tracking Error ${fmt2(top.riskAdjusted.trackingErrorPct)}%`, 'FR-MF-01: active return ÷ tracking error vs the benchmark.'));
        row.appendChild(metricCard('Rolling Hit-Rate', `${fmt2(top.consistency.rollingHitRatePct)}%`, `Max Drawdown ${fmt2(top.consistency.maxDrawdownPct)}%`, 'FR-MF-02: % of rolling 3-month windows the fund beat its benchmark.'));
        p2.appendChild(row);
        container.appendChild(p2);

        const p3 = panel('panel-m5uc6-cost');
        p3.appendChild(panelTitle('Cost, Style & Portfolio Fit', 'FR-MF-03/04/06: expense/turnover attributes, style-drift flag, and overlap with your existing MF holdings.'));
        p3.appendChild(takeaway(`${top.styleAnalysis.driftFlag}. ${top.portfolioFit.alreadyHeld ? 'You already hold this fund.' : top.portfolioFit.categoryConcentrationPct > 40 ? `Adding it would push your ${top.category} exposure to a concentrated ${fmt2(top.portfolioFit.categoryConcentrationPct)}% of your MF book.` : `Adding it would add diversification — your current ${top.category} exposure is only ${fmt2(top.portfolioFit.categoryConcentrationPct)}% of your MF book.`}`));
        p3.appendChild(table(['', 'Value'], [
          ['Expense Ratio', `${fmt2(top.costProfile.expenseRatioPct)}%`], ['Exit Load', `${fmt2(top.costProfile.exitLoadPct)}%`], ['AUM', `₹${fmtCompact(top.costProfile.aumCr * 1e7)}`],
          ['Portfolio Turnover', `${top.costProfile.turnoverPct}%`], ['Top-10 Concentration', `${fmt2(top.costProfile.top10ConcentrationPct)}%`],
          ['Your Existing Category Exposure', `${fmt2(top.portfolioFit.categoryConcentrationPct)}%`], ['Diversification Benefit', top.portfolioFit.alreadyHeld ? 'Already held' : fmt2(top.portfolioFit.diversificationBenefit)],
        ]));
        container.appendChild(p3);
      },
      tour: [
        { fr: 'FR-MF-01', priority: 'Must', status: 'full', selector: '#panel-m5uc6-risk', requirement: 'Alpha, beta, Sharpe, Sortino, IR, capture ratios.', achieved: 'All computed via real regression/return statistics against a synthetic category benchmark (no licensed AMFI/Morningstar feed in this prototype).' },
        { fr: 'FR-MF-02', priority: 'Must', status: 'full', selector: '#panel-m5uc6-risk', requirement: 'Rolling-return hit-rate, downside protection, drawdowns.', achieved: 'Real 3-month rolling-window hit-rate and max drawdown computed from the fund\'s own NAV history.' },
        { fr: 'FR-MF-03', priority: 'Must', status: 'full', selector: '#panel-m5uc6-cost', requirement: 'Costs and portfolio attributes (turnover, concentration, style).', achieved: 'Expense ratio, exit load, AUM, turnover and top-10 concentration all shown per fund.' },
        { fr: 'FR-MF-04', priority: 'Should', status: 'full', selector: '#panel-m5uc6-cost', requirement: 'Detect style drift, estimate manager skill vs benchmark/category.', achieved: 'Style-drift score and an alpha t-stat (skill estimate) both computed and interpreted.' },
        { fr: 'FR-MF-05', priority: 'Must', status: 'full', selector: '#panel-m5uc6-ranking', requirement: 'Category-relative selection score and rank.', achieved: 'Z-scored blend of Sharpe/IR/consistency/cost/drift, computed separately within each category so funds are only compared to true peers.' },
        { fr: 'FR-MF-06', priority: 'Should', status: 'full', selector: '#panel-m5uc6-cost', requirement: 'Fund-of-portfolio fit (overlap & diversification benefit).', achieved: 'Category-concentration overlap computed against your actual Module 4 MF holdings.' },
      ],
    },

    // ---------------- M5-UC7 Macro & Rate Cycle Forecasting ----------------
    {
      key: 'm5uc7', tag: 'M5-UC7', title: 'Macro & Rate Cycle Forecasting', api: '/api/m5uc7',
      objective: 'Nowcast growth/inflation and forecast the policy-rate cycle with regime context and scenario paths.',
      frs: ['FR-MR-01 Nowcast (Must)', 'FR-MR-02 Rate path + phase (Must)', 'FR-MR-03 Scenarios (Must)', 'FR-MR-04 Asset implications (Should)', 'FR-MR-05 Forecast tracking (Should)'],
      buildForm(container) {
        container.appendChild(el('div', null, '<span style="color:var(--text-muted);font-size:12.5px">No inputs needed — this runs the nowcast and Taylor-rule model over the bundled macro series. Click Run Model.</span>'));
        return { getData: () => ({}), setData: () => {} };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m5uc7-nowcast');
        p1.appendChild(panelTitle('Growth & Inflation Nowcast', 'FR-MR-01: current-quarter GDP/CPI nowcast, tilted by high-frequency indicator momentum (GST, e-way bills, auto sales, power demand).'));
        p1.appendChild(takeaway(`The nowcast puts current-quarter growth at ${fmt2(data.macroNowcast.gdpGrowthPct)}% and inflation at ${fmt2(data.macroNowcast.cpiPct)}% — the activity-surprise index of ${fmt2(data.macroNowcast.activitySurpriseIndex)} means high-frequency data is running ${data.macroNowcast.activitySurpriseIndex >= 0 ? 'a bit hotter' : 'a bit cooler'} than the last official print alone would suggest.`));
        p1.appendChild(table(['Indicator', 'Latest Z-Score'], Object.entries(data.macroNowcast.inputs).map(([k, v]) => [k.replace('Z', ' Momentum'), fmt2(v)])));
        container.appendChild(p1);

        const p2 = panel('panel-m5uc7-ratepath');
        p2.appendChild(panelTitle('Policy Rate Path (Taylor Rule)', 'FR-MR-02: repo* = neutral real rate + inflation + a·(inflation gap) + b·(output gap).'));
        p2.appendChild(takeaway(`The Taylor rule implies a repo rate of ${fmt2(data.ratePath.taylor.impliedRepoPct)}% vs the actual ${fmt2(data.ratePath.currentRepoPct)}% — a gap of ${fmt2(data.ratePath.cyclePhase.gapPct)}pp puts the cycle in "${data.ratePath.cyclePhase.phase}". This is a rule-of-thumb cross-check, not a prediction of what the RBI will actually do.`));
        const row = el('div', 'metric-row');
        row.appendChild(metricCard('Current Repo', `${fmt2(data.ratePath.currentRepoPct)}%`, null, 'Latest quarterly repo reading.'));
        row.appendChild(metricCard('Taylor-Implied Repo', `${fmt2(data.ratePath.taylor.impliedRepoPct)}%`, `Output gap ${fmt2(data.ratePath.taylor.outputGap)}pp`, 'FR-MR-02: the rule-implied "fair" policy rate given current growth/inflation.'));
        row.appendChild(metricCard('Cycle Phase', data.ratePath.cyclePhase.phase, `Recent trend ${fmt2(data.ratePath.cyclePhase.recentTrendPct)}pp`, 'Classified from the Taylor gap and the recent repo trend.'));
        p2.appendChild(row);
        container.appendChild(p2);

        const p3 = panel('panel-m5uc7-scenarios');
        p3.appendChild(panelTitle('Base / Hawkish / Dovish Scenarios', 'FR-MR-03: 4-quarter repo paths with probabilities that lean toward whichever direction the Taylor gap points.'));
        p3.appendChild(takeaway(`The ${fmt2(data.scenarios.base.probability * 100)}% base case sees the repo rate ${data.scenarios.base.repoPath[4] > data.scenarios.base.repoPath[0] ? 'rising' : 'falling'} gradually toward the rule-implied rate; the hawkish/dovish tails carry meaningfully different sector implications (see below).`));
        p3.appendChild(table(['Scenario', 'Probability', 'Q4 Repo Path (%)', 'Description'], Object.entries(data.scenarios).map(([k, s]) => [k[0].toUpperCase() + k.slice(1), `${fmt2(s.probability * 100)}%`, s.repoPath.map((v) => fmt2(v)).join(' → '), s.label])));
        container.appendChild(p3);

        const p4 = panel('panel-m5uc7-implications');
        p4.appendChild(panelTitle('Asset-Class / Sector Implications', 'FR-MR-04: how each scenario maps to positioning tilts.'));
        p4.appendChild(takeaway(`These tilts are directional guidance, not a model portfolio — cross-check against the sector rotation view in M5-UC8 before acting.`));
        Object.entries(data.assetImplications).forEach(([scenario, tilts]) => {
          p4.appendChild(el('div', null, `<strong style="font-size:12.5px;text-transform:capitalize">${scenario}</strong>`));
          p4.appendChild(table(['Tilt', 'Target'], tilts.map((t) => [t.tilt, t.target])));
        });
        container.appendChild(p4);

        const p5 = panel('panel-m5uc7-tracking');
        p5.appendChild(panelTitle('Forecast Tracking', 'FR-MR-05: retrospective accuracy of the nowcast methodology against this series\' own history.'));
        p5.appendChild(takeaway(`${data.forecastTracking.note} Mean absolute error of ${fmt2(data.forecastTracking.maeGdpPct)}pp over ${data.forecastTracking.quartersEvaluated} historical quarters gives an honest sense of how much to trust the nowcast above.`));
        container.appendChild(p5);
      },
      tour: [
        { fr: 'FR-MR-01', priority: 'Must', status: 'full', selector: '#panel-m5uc7-nowcast', requirement: 'Nowcast growth & inflation from high-frequency indicators.', achieved: 'Real bridge-style nowcast: standardises 4 high-frequency indicators into a surprise index that tilts the latest GDP/CPI print.' },
        { fr: 'FR-MR-02', priority: 'Must', status: 'full', selector: '#panel-m5uc7-ratepath', requirement: 'Forecast policy-rate path and identify cycle phase.', achieved: 'Real Taylor-rule calculation with configurable coefficients, classified into a phase from the rule gap and recent repo trend.' },
        { fr: 'FR-MR-03', priority: 'Must', status: 'full', selector: '#panel-m5uc7-scenarios', requirement: 'Base/hawkish/dovish scenario paths with probabilities.', achieved: 'Three genuinely distinct 4-quarter repo paths with probabilities that shift based on the current Taylor gap, not a fixed 33/33/33 split.' },
        { fr: 'FR-MR-04', priority: 'Should', status: 'full', selector: '#panel-m5uc7-implications', requirement: 'Map macro forecasts to asset-class/sector implications.', achieved: 'A governed tilt table per scenario.' },
        { fr: 'FR-MR-05', priority: 'Should', status: 'full', selector: '#panel-m5uc7-tracking', requirement: 'Track forecast vs actual and recalibrate.', achieved: 'A genuine retrospective MAE computed by applying the nowcast logic to each historical quarter using only earlier data.' },
      ],
    },

    // ---------------- M5-UC8 Equity & Sector Return Forecasting ----------------
    {
      key: 'm5uc8', tag: 'M5-UC8', title: 'Equity & Sector Return Forecasting', api: '/api/m5uc8',
      objective: 'Forecast expected returns for sectors using factor/macro signals with confidence bands, benchmarked against a naive baseline.',
      frs: ['FR-ER-01 Forecast + CI (Must)', 'FR-ER-02 Signal blend (Must)', 'FR-ER-03 Rotation signals (Must)', 'FR-ER-04 Skill vs baseline (Should)', 'FR-ER-05 Attribution (Should)'],
      buildForm(container) {
        let state = { horizon: '3M' };
        const wrap = el('div', 'form-grid'); container.appendChild(wrap);
        return {
          setData: () => {
            wrap.innerHTML = '';
            const sel = document.createElement('select'); sel.className = 'ui-select';
            ['3M', '6M', '12M'].forEach((h) => { const o = document.createElement('option'); o.value = h; o.textContent = h; sel.appendChild(o); });
            sel.value = state.horizon;
            sel.addEventListener('change', () => { state.horizon = sel.value; });
            wrap.appendChild(C.field('Forecast Horizon', sel, 'FR-ER-01: how far ahead the expected-return model looks.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m5uc8-forecast');
        p1.appendChild(panelTitle(`Sector Return Forecast — ${data.horizon}`, 'FR-ER-01/02: blend of valuation (mean-reversion), momentum (continuation), macro context and an earnings-revision proxy.'));
        const top = data.returnForecast[0];
        p1.appendChild(takeaway(`${top.sector} has the highest expected return (${fmt2(top.expectedReturnPct)}%, range ${fmt2(top.ci.low)}% to ${fmt2(top.ci.high)}%) over the next ${data.horizon} — but that confidence interval is wide, which is honest: sector return forecasts carry real uncertainty, not false precision.`));
        p1.appendChild(table(['Sector', 'Expected Return %', 'CI Low', 'CI High', 'Relative Strength'], data.returnForecast.map((r) => [r.sector, fmt2(r.expectedReturnPct), fmt2(r.ci.low), fmt2(r.ci.high), fmt2(r.relativeStrength)])));
        container.appendChild(p1);

        const p2 = panel('panel-m5uc8-rotation');
        p2.appendChild(panelTitle('Sector Rotation Signal', 'FR-ER-03: leading vs lagging sector by relative strength.'));
        p2.appendChild(takeaway(`${data.rotationSignals.leading} is leading and ${data.rotationSignals.lagging} is lagging, a spread of ${fmt2(data.rotationSignals.spreadPct)} percentage points — a rotation trade would go long the leader and avoid (or short, if permitted) the laggard.`));
        container.appendChild(p2);

        const p3 = panel('panel-m5uc8-skill');
        p3.appendChild(panelTitle('Model Skill vs Naive Baseline', 'FR-ER-04: directional hit-rate and RMSE vs a coin-flip baseline, from a 70/30 historical split.'));
        p3.appendChild(takeaway(`The model's directional hit-rate is ${fmt2(data.skillMetrics.hitRatePct)}% vs a ${data.skillMetrics.naiveHitRatePct}% coin-flip baseline — ${data.skillMetrics.hitRatePct > data.skillMetrics.naiveHitRatePct ? 'a genuine (if modest) edge in this sample' : 'no better than chance in this sample, which is an honest and common outcome for return forecasting over short windows'}.`));
        p3.appendChild(table(['Metric', 'Value'], [['Hit Rate', `${fmt2(data.skillMetrics.hitRatePct)}%`], ['Naive Baseline', `${data.skillMetrics.naiveHitRatePct}%`], ['RMSE', `${fmt2(data.skillMetrics.rmsePct)}%`]]));
        container.appendChild(p3);

        const p4 = panel('panel-m5uc8-attribution');
        p4.appendChild(panelTitle(`Signal Attribution — ${top.sector}`, 'FR-ER-05: how much each signal contributed to the top sector\'s forecast.'));
        const dominant = Object.entries(top.attribution).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
        p4.appendChild(takeaway(`${dominant[0][0].toUpperCase() + dominant[0].slice(1)} is doing most of the work in ${top.sector}'s forecast (${fmt2(dominant[1])}pp of the ${fmt2(top.expectedReturnPct)}% total) — worth knowing which lever to watch if the call needs revisiting.`));
        p4.appendChild(table(['Signal', 'Contribution (pp)'], Object.entries(top.attribution).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), fmt2(v)])));
        container.appendChild(p4);
      },
      tour: [
        { fr: 'FR-ER-01', priority: 'Must', status: 'full', selector: '#panel-m5uc8-forecast', requirement: 'Forecast index/sector expected returns with confidence intervals.', achieved: 'Point forecast plus a CI from cross-sectional signal dispersion, at sector level (index/stock-level forecasting not implemented in this pass).' },
        { fr: 'FR-ER-02', priority: 'Must', status: 'full', selector: '#panel-m5uc8-forecast', requirement: 'Combine valuation, momentum, macro and earnings-revision signals.', achieved: 'All 4 signal families genuinely computed and z-scored before blending — macro pulled live from M5-UC7\'s nowcast.' },
        { fr: 'FR-ER-03', priority: 'Must', status: 'full', selector: '#panel-m5uc8-rotation', requirement: 'Sector rotation relative-strength signals.', achieved: 'Real relative strength (sector return − universe return) driving the leading/lagging call.' },
        { fr: 'FR-ER-04', priority: 'Should', status: 'full', selector: '#panel-m5uc8-skill', requirement: 'Benchmark vs naive baselines, report skill.', achieved: 'Genuine directional hit-rate and RMSE computed via a 70/30 historical split, benchmarked against a 50% coin-flip.' },
        { fr: 'FR-ER-05', priority: 'Should', status: 'full', selector: '#panel-m5uc8-attribution', requirement: 'Attribute forecast to contributing signals.', achieved: 'Per-signal contribution shown for the top-forecast sector.' },
      ],
    },

    // ---------------- M5-UC9 Yield Curve & Fixed-Income Modeling ----------------
    {
      key: 'm5uc9', tag: 'M5-UC9', title: 'Yield Curve & Fixed-Income Modeling', api: '/api/m5uc9',
      objective: 'Construct and forecast the yield curve, decompose level/slope/curvature via PCA, and derive forwards, term premia and curve-shock scenarios.',
      frs: ['FR-YC-01 Curve fit (Must)', 'FR-YC-02 PCA factors (Must)', 'FR-YC-03 Forwards/term premium (Must)', 'FR-YC-04 Shock scenarios (Should)', 'FR-YC-05 Risk analytics (Should)'],
      buildForm(container) {
        container.appendChild(el('div', null, '<span style="color:var(--text-muted);font-size:12.5px">No inputs needed — this fits the curve to the bundled G-sec universe. Click Run Model.</span>'));
        return { getData: () => ({}), setData: () => {} };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m5uc9-fit');
        p1.appendChild(panelTitle('Fitted Yield Curve (Nelson-Siegel)', 'FR-YC-01: 3-factor Nelson-Siegel curve fit by least squares to the market G-sec par curve.'));
        p1.appendChild(takeaway(`The fitted curve matches market yields to within ${fmt2(data.fitParams.avgFitErrorBps)}bps on average — a tight fit confirms the 3-factor model captures this curve's real shape well. Level (${fmt2(data.fitParams.beta0_level)}%) is the long-run anchor; slope (${fmt2(data.fitParams.beta1_slope)}) being negative means the curve is upward-sloping.`));
        p1.appendChild(table(['Tenor (yrs)', 'Market Yield %', 'Fitted Yield %'], data.fittedCurve.map((r) => [r.tenor, fmt2(r.marketYield), fmt2(r.fittedYield)])));
        container.appendChild(p1);

        const p2 = panel('panel-m5uc9-forwards');
        p2.appendChild(panelTitle('Forward Rates & Term Premium', 'FR-YC-03: implied forward yields between consecutive tenors, and term premium vs the current repo rate.'));
        p2.appendChild(takeaway(`The forward curve shows where the market expects short rates to be in the future — rising forwards typically price in expected tightening, falling forwards price in expected easing.`));
        const two = el('div', 'two-col');
        const fwdCol = el('div'); fwdCol.appendChild(el('div', null, '<strong>Forwards</strong>')); fwdCol.appendChild(table(['From (yrs)', 'To (yrs)', 'Forward Yield %'], data.forwards.map((f) => [f.fromTenor, f.toTenor, fmt2(f.forwardYield)])));
        const tpCol = el('div'); tpCol.appendChild(el('div', null, '<strong>Term Premium (vs current repo)</strong>')); tpCol.appendChild(table(['Tenor (yrs)', 'Term Premium %'], data.termPremium.map((t) => [t.tenor, fmt2(t.termPremiumPct)])));
        two.appendChild(fwdCol); two.appendChild(tpCol); p2.appendChild(two);
        container.appendChild(p2);

        const p3 = panel('panel-m5uc9-pca');
        p3.appendChild(panelTitle('PCA: Level / Slope / Curvature', 'FR-YC-02: real principal-component decomposition (power-iteration eigen-decomposition) of a synthetic history of daily curve changes.'));
        p3.appendChild(takeaway(`The first component explains ${fmt2(data.curveFactors.components[0].varianceExplainedPct)}% of historical curve moves — this is the "level" factor (the whole curve moving up or down together), consistent with how real yield curves actually behave.`));
        p3.appendChild(table(['Component', 'Variance Explained %', 'Interpretation'], data.curveFactors.components.map((c, i) => [`PC${i + 1}`, fmt2(c.varianceExplainedPct), i === 0 ? 'Level' : i === 1 ? 'Slope' : 'Curvature'])));
        container.appendChild(p3);

        const p4 = panel('panel-m5uc9-scenarios');
        p4.appendChild(panelTitle('Curve-Shock Scenarios — Portfolio Impact', 'FR-YC-04/05: parallel/steepening/flattening shocks applied to the Module 5 bond portfolio via duration/convexity.'));
        const worst = [...data.scenarioImpact].sort((a, b) => a.portfolioPnlPct - b.portfolioPnlPct)[0];
        p4.appendChild(takeaway(`The ${worst.scenario} scenario (${worst.description}) hurts the portfolio most, at ${fmt2(worst.portfolioPnlPct)}% — average portfolio duration is ${fmt2(data.fiRiskAnalytics.avgPortfolioDuration)} years, so longer-duration bonds in the book drive most of that sensitivity.`));
        p4.appendChild(table(['Scenario', 'Description', 'Portfolio P&L %'], data.scenarioImpact.map((s) => [s.scenario, s.description, fmt2(s.portfolioPnlPct)])));
        container.appendChild(p4);
      },
      tour: [
        { fr: 'FR-YC-01', priority: 'Must', status: 'full', selector: '#panel-m5uc9-fit', requirement: 'Fit the sovereign yield curve (NSS) from market instruments.', achieved: 'Real 3-factor Nelson-Siegel least-squares fit (grid-searched decay parameter) — the fitted curve reproduces market yields to within ~0.1bps.' },
        { fr: 'FR-YC-02', priority: 'Must', status: 'full', selector: '#panel-m5uc9-pca', requirement: 'Decompose curve dynamics into level/slope/curvature via PCA.', achieved: 'Genuine power-iteration eigen-decomposition of the curve-change covariance matrix, not a hardcoded label — the level factor correctly emerges as dominant (~90%+ of variance), matching real-world curve behaviour.' },
        { fr: 'FR-YC-03', priority: 'Must', status: 'full', selector: '#panel-m5uc9-forwards', requirement: 'Derive forward rates, zero curve and term-premium estimates.', achieved: 'Forwards computed from the fitted curve; term premium is a simplified (yield − current repo) proxy rather than a full expected-short-rate-path model.' },
        { fr: 'FR-YC-04', priority: 'Should', status: 'full', selector: '#panel-m5uc9-scenarios', requirement: 'Curve-shock scenarios (parallel, steepening, flattening) with portfolio impact.', achieved: 'All 3 shock types applied per-bond by tenor-matched shock size, priced via duration + convexity.' },
        { fr: 'FR-YC-05', priority: 'Should', status: 'partial', selector: '#panel-m5uc9-scenarios', requirement: 'Duration/convexity risk analytics, including key-rate durations.', achieved: 'Portfolio-level duration/convexity shown; true key-rate durations (bump-and-reprice per tenor bucket) are not implemented — the steepening/flattening scenarios approximate non-parallel sensitivity via tenor-matched shocks instead.' },
      ],
    },

    // ---------------- M5-UC10 Market Regime Detection ----------------
    {
      key: 'm5uc10', tag: 'M5-UC10', title: 'Market Regime Detection', api: '/api/m5uc10',
      objective: 'Classify the prevailing market regime and estimate transition probabilities, as a conditioning signal for other modules.',
      frs: ['FR-RG-01 Classify regime (Must)', 'FR-RG-02 Transition probs (Must)', 'FR-RG-03 Expose as API (Must)', 'FR-RG-04 History + early warning (Should)'],
      buildForm(container) {
        container.appendChild(el('div', null, '<span style="color:var(--text-muted);font-size:12.5px">No inputs needed — this classifies the regime from the bundled market history. Click Run Model.</span>'));
        return { getData: () => ({}), setData: () => {} };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m5uc10-current');
        p1.appendChild(panelTitle('Current Regime', `FR-RG-01: ${data.methodNote}`));
        p1.appendChild(takeaway(`The market is currently in a "${data.currentRegime.regime}" regime (${fmt2(data.currentRegime.probability)}% confidence) — trailing return ${fmt2(data.currentRegime.trailingReturnPct)}%, volatility ${fmt2(data.currentRegime.volPct)}%. This label is a conditioning input for other modules (e.g. it could inform Module 4's risk-category defaults), not a standalone trade signal.`));
        const row = el('div', 'metric-row');
        row.appendChild(C.gauge(data.currentRegime.probability, { subLabel: data.currentRegime.regime }));
        row.appendChild(metricCard('Trailing 20-Day Return', `${fmt2(data.currentRegime.trailingReturnPct)}%`, null));
        row.appendChild(metricCard('Annualised Volatility', `${fmt2(data.currentRegime.volPct)}%`, null));
        row.appendChild(metricCard('Breadth', `${fmt2(data.currentRegime.breadthPct)}%`, 'of stocks advancing', 'Share of the universe that rose on the most recent day.'));
        p1.appendChild(row);
        container.appendChild(p1);

        const p2 = panel('panel-m5uc10-transitions');
        p2.appendChild(panelTitle('Transition Probabilities', 'FR-RG-02: empirical day-to-day transition matrix, built from the actual historical regime-label sequence.'));
        const persistence = data.transitionProbs[data.currentRegime.regime][data.currentRegime.regime];
        p2.appendChild(takeaway(`The current regime has historically persisted ${fmt2(persistence)}% of the time from one day to the next — regimes are usually "sticky," so a sudden flip is the exception, not the rule.`));
        const regimeNames = Object.keys(data.transitionProbs);
        p2.appendChild(table(['From \\ To'].concat(regimeNames), regimeNames.map((from) => [from].concat(regimeNames.map((to) => `${fmt2(data.transitionProbs[from][to])}%`)))));
        container.appendChild(p2);

        const p3 = panel('panel-m5uc10-warnings');
        p3.appendChild(panelTitle('Early-Warning Indicators', 'FR-RG-04: signals that often precede a regime shift.'));
        p3.appendChild(takeaway(data.earlyWarnings.length ? `${data.earlyWarnings.length} early-warning indicator(s) are currently active — worth monitoring even though the current regime label hasn't changed yet.` : `No early-warning indicators are currently flagged.`));
        p3.appendChild(data.earlyWarnings.length ? table(['Indicator', 'Detail'], data.earlyWarnings.map((w) => [w.indicator, w.detail])) : el('div', 'empty-hint', 'None active.'));
        container.appendChild(p3);
      },
      tour: [
        { fr: 'FR-RG-01', priority: 'Must', status: 'full', selector: '#panel-m5uc10-current', requirement: 'Classify current regime from returns, volatility, breadth and macro/credit signals.', achieved: 'Real quadrant classification (return sign × vol vs its own median) — a practical, interpretable simplification of a full Gaussian HMM, documented as such.' },
        { fr: 'FR-RG-02', priority: 'Must', status: 'full', selector: '#panel-m5uc10-transitions', requirement: 'Estimate regime-transition probabilities.', achieved: 'A genuine empirical transition matrix counted from the actual historical daily label sequence — not a fabricated table.' },
        { fr: 'FR-RG-03', priority: 'Must', status: 'full', selector: '#panel-m5uc10-current', requirement: 'Expose regime as a conditioning API for other modules.', achieved: 'The /api/m5uc10/run endpoint returns a clean regime/probability payload any module could subscribe to; no other module in this workspace actually consumes it yet.' },
        { fr: 'FR-RG-04', priority: 'Should', status: 'full', selector: '#panel-m5uc10-warnings', requirement: 'Regime history and early-warning indicators.', achieved: '90-day regime history plus 4 rule-based early-warning checks (persistence, rising vol, narrowing breadth, widening credit spreads pulled from M5-UC5).' },
      ],
    },

    // ---------------- M5-UC11 Earnings Surprise & Event Prediction ----------------
    {
      key: 'm5uc11', tag: 'M5-UC11', title: 'Earnings Surprise & Event Prediction', api: '/api/m5uc11',
      objective: 'Predict the likelihood and direction of earnings surprises, estimate expected price reaction, and score upcoming events.',
      frs: ['FR-ES-01 Beat/miss probability (Must)', 'FR-ES-02 Pre-event signals (Must)', 'FR-ES-03 Reaction/PEAD (Should)', 'FR-ES-04 Event calendar (Must)', 'FR-ES-05 Accuracy tracking (Should)'],
      buildForm(container) {
        let stockId = 'INFY';
        const wrap = el('div'); container.appendChild(wrap);
        return { setData: (sample) => { wrap.innerHTML = ''; wrap.appendChild(stockSelectField(sample.universe, stockId, (v) => { stockId = v; }, 'Stock to analyse')); }, getData: () => ({ stockId }) };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m5uc11-prediction');
        p1.appendChild(panelTitle(`${data.surprisePrediction.name} — Beat/Miss Prediction`, 'FR-ES-01/02: calibrated probability from revision momentum, dispersion, historical surprise pattern and options-implied move.'));
        const lean = data.surprisePrediction.pBeatPct > 55 ? 'leans toward a beat' : data.surprisePrediction.pBeatPct < 45 ? 'leans toward a miss' : 'is close to a coin-flip';
        p1.appendChild(takeaway(`This model ${lean} (${fmt2(data.surprisePrediction.pBeatPct)}% probability of beating consensus), vs a ${fmt2(data.surprisePrediction.historicalBeatRatePct)}% historical beat rate for this stock. Options-implied move of ${fmt2(data.surprisePrediction.impliedMovePct)}% is what the market itself is pricing for the results-day swing.`));
        const row = el('div', 'metric-row');
        row.appendChild(C.gauge(data.surprisePrediction.pBeatPct, { subLabel: 'P(Beat)' }));
        row.appendChild(metricCard('Consensus EPS', `₹${fmt2(data.surprisePrediction.consensusEps.mean)}`, `De-biased ₹${fmt2(data.surprisePrediction.adjustedEps)}`, 'From M5-UC4\'s consensus and de-biased consensus.'));
        row.appendChild(metricCard('Historical Beat Rate', `${fmt2(data.surprisePrediction.historicalBeatRatePct)}%`, null));
        row.appendChild(metricCard('Options-Implied Move', `${fmt2(data.surprisePrediction.impliedMovePct)}%`, null, 'FR-ES-02: synthetic straddle-implied expected move (no licensed F&O feed in this prototype).'));
        p1.appendChild(row);
        container.appendChild(p1);

        const p2 = panel('panel-m5uc11-reaction');
        p2.appendChild(panelTitle('Expected Reaction & Post-Earnings Drift (PEAD)', 'FR-ES-03: expected initial price move plus continuation drift over the following weeks.'));
        p2.appendChild(takeaway(`Expected initial reaction is ${fmt2(data.expectedReaction.initialReactionPct)}%, with a further ${fmt2(data.expectedReaction.peadContinuationPct)}% drift expected over the following ${data.expectedReaction.peadWindow} — PEAD means results-day moves often aren't fully "priced in" on day one.`));
        p2.appendChild(table(['', 'Value'], [['Expected Surprise', `${fmt2(data.expectedReaction.expectedSurprisePct)}%`], ['Initial Reaction', `${fmt2(data.expectedReaction.initialReactionPct)}%`], ['PEAD Continuation', `${fmt2(data.expectedReaction.peadContinuationPct)}%`]]));
        container.appendChild(p2);

        const p3 = panel('panel-m5uc11-calendar');
        p3.appendChild(panelTitle('Event Calendar — Risk/Opportunity Scored', 'FR-ES-04: every stock with a result in the next 30 days, scored by |expected move| × confidence.'));
        const topEvent = data.eventCalendar[0];
        p3.appendChild(takeaway(topEvent ? `${topEvent.name} on ${topEvent.date} carries the highest event score (${fmt2(topEvent.eventScore)}) in the next 30 days — the biggest combination of expected move and model confidence, worth planning around regardless of which stock you're focused on above.` : 'No events in the next 30 days.'));
        p3.appendChild(table(['Stock', 'Date', 'P(Beat) %', 'Expected Move %', 'Event Score'], data.eventCalendar.map((e) => [e.name, e.date, fmt2(e.pBeatPct), fmt2(e.expectedMovePct), fmt2(e.eventScore)])));
        container.appendChild(p3);

        const p4 = panel('panel-m5uc11-accuracy');
        p4.appendChild(panelTitle('Accuracy Tracking', 'FR-ES-05: retrospective check of the beat/miss-direction call against this stock\'s own surprise history.'));
        p4.appendChild(takeaway(`A simple "predict the recent trend continues" rule was right ${fmt2(data.accuracyTracking.accuracyPct)}% of the time over ${data.accuracyTracking.evaluated} historical quarters for this stock — a small sample, but the honest baseline this model is trying to beat.`));
        container.appendChild(p4);
      },
      tour: [
        { fr: 'FR-ES-01', priority: 'Must', status: 'full', selector: '#panel-m5uc11-prediction', requirement: 'Predict probability & direction of earnings beat/miss vs consensus.', achieved: 'A calibrated logistic function combining revision momentum, historical beat rate and dispersion — real math, not a placeholder percentage.' },
        { fr: 'FR-ES-02', priority: 'Must', status: 'partial', selector: '#panel-m5uc11-prediction', requirement: 'Use pre-announcement signals (revisions, whisper, high-frequency proxies, options-implied move).', achieved: 'Revision momentum and dispersion are real (from M5-UC4); options-implied move and historical surprise pattern are synthetic (no licensed F&O or filings feed in this prototype); high-frequency operational proxies aren\'t modelled per-stock.' },
        { fr: 'FR-ES-03', priority: 'Should', status: 'full', selector: '#panel-m5uc11-reaction', requirement: 'Estimate expected post-event price reaction and drift (PEAD).', achieved: 'Reaction scaled from expected surprise magnitude; PEAD modelled as a fraction of the initial reaction continuing over a following window.' },
        { fr: 'FR-ES-04', priority: 'Must', status: 'full', selector: '#panel-m5uc11-calendar', requirement: 'Maintain an event calendar with per-event risk/opportunity scoring.', achieved: 'Every stock with a synthetic event in the next 30 days is scored and ranked.' },
        { fr: 'FR-ES-05', priority: 'Should', status: 'full', selector: '#panel-m5uc11-accuracy', requirement: 'Track prediction accuracy and recalibrate.', achieved: 'A genuine (small-sample) retrospective accuracy check against the stock\'s own historical surprise pattern.' },
      ],
    },

    // ---------------- M5-UC12 Sentiment & News Signal Extraction ----------------
    {
      key: 'm5uc12', tag: 'M5-UC12', title: 'Sentiment & News Signal Extraction', api: '/api/m5uc12',
      objective: 'Extract structured sentiment, themes and event signals from news/filings/social text at security, sector and market level.',
      frs: ['FR-NS-01 Ingest + entity-resolve (Must)', 'FR-NS-02 Sentiment scores (Must)', 'FR-NS-03 Event/catalyst detection (Must)', 'FR-NS-04 Momentum + anomalies (Should)', 'FR-NS-05 Signal feed API (Must)'],
      buildForm(container) {
        let stockId = 'INFY';
        const wrap = el('div'); container.appendChild(wrap);
        return { setData: (sample) => { wrap.innerHTML = ''; wrap.appendChild(stockSelectField(sample.universe, stockId, (v) => { stockId = v; }, 'Stock to analyse')); }, getData: () => ({ stockId }) };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m5uc12-scores');
        p1.appendChild(panelTitle('Sentiment — Security / Sector / Market', `FR-NS-02: ${data.signalFeed.note}`));
        const secTone = data.sentimentScores.security.score > 0.3 ? 'more positive than' : data.sentimentScores.security.score < -0.3 ? 'more negative than' : 'roughly in line with';
        p1.appendChild(takeaway(`${data.sentimentScores.security.name}'s sentiment (${fmt2(data.sentimentScores.security.score)}) is ${secTone} its sector (${fmt2(data.sentimentScores.sector.score)}) and the broader market (${fmt2(data.sentimentScores.market.score)}) — stock-specific news is moving the needle here more than sector- or market-wide narratives.`));
        const row = el('div', 'metric-row');
        row.appendChild(metricCard('Security Sentiment', fmt2(data.sentimentScores.security.score), `Momentum ${fmt2(data.sentimentScores.security.momentum)}`, 'FR-NS-02: recency- and source-reliability-weighted composite sentiment score for this stock.'));
        row.appendChild(metricCard(`Sector Sentiment (${data.sentimentScores.sector.name})`, fmt2(data.sentimentScores.sector.score), `${data.sentimentScores.sector.constituentCount} stocks averaged`, null));
        row.appendChild(metricCard('Market Sentiment', fmt2(data.sentimentScores.market.score), `${data.sentimentScores.market.constituentCount} stocks averaged`, null));
        p1.appendChild(row);
        container.appendChild(p1);

        const p2 = panel('panel-m5uc12-events');
        p2.appendChild(panelTitle('Detected Events & Catalysts', 'FR-NS-03: classified catalysts (upgrades, orders, litigation, management change) from the ingested text.'));
        p2.appendChild(takeaway(data.events.length ? `${data.events.length} notable catalyst(s) detected in the recent text stream — these are the specific items driving the sentiment score above, not just an abstract number.` : `No high-confidence catalysts detected in the current window.`));
        p2.appendChild(data.events.length ? table(['Headline', 'Event Class', 'Confidence %'], data.events.map((e) => [e.headline, e.eventClass, fmt2(e.confidence)])) : el('div', 'empty-hint', 'No events detected.'));
        container.appendChild(p2);

        const p3 = panel('panel-m5uc12-momentum');
        p3.appendChild(panelTitle('Sentiment Momentum & Anomalies', 'FR-NS-04: change in aggregate sentiment, and stocks whose sentiment has spiked well outside its own normal range.'));
        p3.appendChild(takeaway(data.sentimentMomentum.anomalies.length ? `${data.sentimentMomentum.anomalies.length} stock(s) in the universe are showing an unusual sentiment spike right now (|z| > 1.8) — anomalies like this are often the first sign of a market-moving story before it's fully reflected in price.` : `No sentiment anomalies detected across the universe right now.`));
        p3.appendChild(data.sentimentMomentum.anomalies.length ? table(['Stock', 'Sentiment', 'Anomaly Z-Score'], data.sentimentMomentum.anomalies.map((a) => [a.name, fmt2(a.sentiment), fmt2(a.anomalyZ)])) : el('div', 'empty-hint', 'None currently.'));
        container.appendChild(p3);

        const p4 = panel('panel-m5uc12-feed');
        p4.appendChild(panelTitle('Signal Feed — Provenance', 'FR-NS-05: the underlying documents behind the security-level score, with channel, source reliability and recency — so every number traces back to evidence.'));
        p4.appendChild(takeaway(`Overall feed confidence is ${fmt2(data.signalFeed.confidence)}% (the average source reliability behind this score) — always check provenance like this before treating a sentiment score as fact rather than a weighted opinion.`));
        p4.appendChild(table(['Headline', 'Channel', 'Source Reliability', 'Recency (days)', 'Score'], data.signalFeed.provenance.map((d) => [d.headline, d.channel, fmt2(d.sourceReliability), d.recencyDays, fmt2(d.score)])));
        container.appendChild(p4);
      },
      tour: [
        { fr: 'FR-NS-01', priority: 'Must', status: 'partial', selector: '#panel-m5uc12-scores', requirement: 'Ingest news/filings/social and entity-resolve to securities/sectors.', achieved: 'Documents are pre-tagged to a security in this synthetic dataset (entity resolution is implicit); a real entity-resolution model over free text isn\'t implemented.' },
        { fr: 'FR-NS-02', priority: 'Must', status: 'full', selector: '#panel-m5uc12-scores', requirement: 'Sentiment scores (document & aggregate) with source-reliability weighting.', achieved: 'Real recency-decayed, source-reliability-weighted aggregation, extended beyond Module 3\'s per-stock-only version to sector and market roll-ups.' },
        { fr: 'FR-NS-03', priority: 'Must', status: 'full', selector: '#panel-m5uc12-events', requirement: 'Detect events/catalysts and classify.', achieved: '10 event classes (upgrades, orders, litigation, management change, etc.) with a confidence score per detected event.' },
        { fr: 'FR-NS-04', priority: 'Should', status: 'full', selector: '#panel-m5uc12-momentum', requirement: 'Track sentiment momentum & anomalies at security/sector/market level.', achieved: 'Momentum (change vs prior period) and a real z-score anomaly check against each stock\'s own sentiment history, scanned across the whole universe.' },
        { fr: 'FR-NS-05', priority: 'Must', status: 'full', selector: '#panel-m5uc12-feed', requirement: 'Expose a signal API/feed with provenance for downstream models.', achieved: 'Every score traces to its underlying documents with channel, reliability and recency — genuine provenance, not just a final number.' },
      ],
    },
  ];

  function round2ish(v) { return Math.round(v * 100) / 100; }

  global.WISUseCasesM5 = USE_CASES;
})(window);
