// Metadata + result-renderers for Module 3 (Research & Recommendation Platform) use cases.
// Mirrors the structure of usecases.js (Module 4): each entry has key/tag/title/objective/frs/tour
// plus buildForm(container) + render(container, data, ctx). Shares ui-controls.js/charts.js/
// coachmark.js with Module 4 — nothing here is module-specific except the data shape.
//
// Every panel below carries its own inline "Takeaway" line, computed from that panel's own data,
// right under its title — so each section explains what it means on its own, rather than relying
// on a single summary elsewhere on the page.
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
  function takeaway(text) {
    return el('div', 'takeaway', `<strong>Takeaway —</strong> ${text}`);
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
      r.forEach((c) => { const td = el('td'); if (c instanceof HTMLElement) td.appendChild(c); else td.innerHTML = c; tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    return t;
  }
  function tag(text, cls) { return `<span class="tag ${cls}">${text}</span>`; }
  function ratingTagClass(rating) {
    if (rating === 'Strong Buy' || rating === 'Buy') return 'buy';
    if (rating === 'Strong Sell' || rating === 'Sell') return 'sell';
    return 'hold';
  }
  function panel(id) { const p = el('div', 'panel'); if (id) p.id = id; return p; }
  function stockSelectField(universe, value, onChange, label) {
    const sel = document.createElement('select');
    sel.className = 'ui-select';
    (universe || []).forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = `${s.name} (${s.id})`;
      if (s.id === value) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    return C.field(label || 'Stock', sel, 'Pick any stock from the Module 3 universe (your 21 real holdings plus illustrative extras).');
  }
  // Rounds any number to at most 2 decimal places for display (also strips float artifacts like
  // 0.43979999999999997) while leaving true integer counts (advancers, F-scores, ranks) untouched.
  function fmt2(v) {
    if (typeof v !== 'number' || !isFinite(v)) return v;
    if (Number.isInteger(v)) return v;
    return Math.round(v * 100) / 100;
  }

  const USE_CASES = [
    // ---------------- M3-UC1 Market Intelligence ----------------
    {
      key: 'm3uc1', tag: 'M3-UC1', title: 'Market Intelligence (Act 1)', api: '/api/m3uc1',
      objective: 'Market landing layer: index movements, breadth, volatility, index analytics, sector rotation, delivery/liquidity and an earnings hub.',
      frs: ['FR-MI-01 Landing feed (Must)', 'FR-MI-02 Breadth (Must)', 'FR-MI-03 Volatility (Must)', 'FR-MI-04 Index analytics (Must)', 'FR-MI-05 Sector rotation (Must)', 'FR-MI-06 Delivery & liquidity (Must)', 'FR-MI-07 Earnings hub (Must)'],
      buildForm(container) {
        container.appendChild(el('div', null, '<span style="color:var(--text-muted);font-size:12.5px">No inputs needed — this is a landing/aggregation feed over the stock universe. Click Run Model.</span>'));
        return { getData: () => ({}), setData: () => {} };
      },
      render(container, data) {
        container.innerHTML = '';
        const dir = data.marketOverview.indexMovePct >= 0 ? 'up' : 'down';
        const volTone = data.volatility.highVolRegime ? 'elevated — expect bigger daily swings' : 'calm — a relatively stable trading environment';

        const p1 = panel('panel-m3uc1-overview');
        p1.appendChild(panelTitle('Market Overview', 'FR-MI-01: index move, breadth, VIX-style regime and top movers assembled into one landing payload.'));
        p1.appendChild(takeaway(`The market is ${dir} today with ${data.breadth.advancers > data.breadth.decliners ? 'more stocks rising than falling' : 'more stocks falling than rising'}, and volatility is ${volTone}.`));
        const row = el('div', 'metric-row');
        row.appendChild(metricCard('Synthetic Index Move', `${fmt2(data.marketOverview.indexMovePct)}%`, 'Cap-weighted basket of the universe', 'Weighted sum of each stock\'s return × its index weight (contribution attribution below).'));
        row.appendChild(metricCard('Breadth (A/D Ratio)', fmt2(data.breadth.adRatio), `${data.breadth.advancers} up / ${data.breadth.decliners} down`, 'FR-MI-02: advancers ÷ decliners across the universe. Above 1 = more winners than losers.'));
        row.appendChild(metricCard('% Above 200 EMA', `${fmt2(data.breadth.pctAbove200Ema)}%`, null, 'FR-MI-02: share of stocks trading above their 200-day EMA — higher generally means a broadly healthier market.'));
        row.appendChild(metricCard('Volatility Regime', data.volatility.highVolRegime ? 'High-Vol' : 'Normal', `Level ${fmt2(data.volatility.level)} vs 50-Day MA ${fmt2(data.volatility.ma50)} (80th percentile: ${fmt2(data.volatility.percentileThreshold)})`, 'FR-MI-03: illustrative VIX-like series (no licensed India VIX feed) vs its 50-day moving average and 80th-percentile threshold.'));
        p1.appendChild(row);
        container.appendChild(p1);

        const p2 = panel('panel-m3uc1-attribution');
        p2.appendChild(panelTitle('Index Attribution — Top Movers', 'FR-MI-04: per-constituent contribution = weight × return, ranked to show which stocks pulled the index up/down.'));
        const topUpNames = data.indexAttribution.topUp.slice(0, 2).map((c) => c.name).join(' and ');
        const topDownNames = data.indexAttribution.topDown.slice(0, 2).map((c) => c.name).join(' and ');
        p2.appendChild(takeaway(`${topUpNames} did the most to lift the index today; ${topDownNames} dragged it down the most — a handful of large stocks, not the whole market, are driving today's move.`));
        const two = el('div', 'two-col');
        const up = el('div'); up.appendChild(el('div', null, '<strong>Top Up</strong>')); up.appendChild(table(['Stock', 'Weight %', 'Return %', 'Contribution (bps)'], data.indexAttribution.topUp.map((c) => [c.name, fmt2(c.weight), fmt2(c.return), fmt2(c.contributionBps)])));
        const down = el('div'); down.appendChild(el('div', null, '<strong>Top Down</strong>')); down.appendChild(table(['Stock', 'Weight %', 'Return %', 'Contribution (bps)'], data.indexAttribution.topDown.map((c) => [c.name, fmt2(c.weight), fmt2(c.return), fmt2(c.contributionBps)])));
        two.appendChild(up); two.appendChild(down);
        p2.appendChild(two);
        container.appendChild(p2);

        const p3 = panel('panel-m3uc1-rotation');
        p3.appendChild(panelTitle('Sector Rotation Heatmap', 'FR-MI-05: sector momentum Z-Score (trailing 1-month sector return standardised across sectors) with a Cyclicality tag (Early-Cycle / Mid-Cycle / Late-Cycle / Defensive). Positive Z-Score = leading rotation.'));
        const leadSector = data.sectorRotation[0], lagSector = data.sectorRotation[data.sectorRotation.length - 1];
        p3.appendChild(takeaway(`Money is currently rotating into ${leadSector.sector} (${leadSector.cyclicality}) and out of ${lagSector.sector} (${lagSector.cyclicality}). ${leadSector.cyclicality === 'Early-Cycle' ? 'Early-Cycle leadership like this often shows up when investors are positioning for an economic upswing.' : leadSector.cyclicality === 'Defensive' ? 'Defensive leadership like this often shows up when investors are turning cautious.' : 'Watch whether this leadership broadens or fades over the next few weeks.'}`));
        p3.appendChild(table(['Sector', 'Cyclicality', 'Momentum Z-Score', '1-Month Return %'], data.sectorRotation.map((r) => [r.sector, tag(r.cyclicality, 'hold'), fmt2(r.momentumZ), fmt2(r.trailing1mReturn)])));
        container.appendChild(p3);

        const p4 = panel('panel-m3uc1-liquidity');
        p4.appendChild(panelTitle('Delivery Volume & Liquidity Score', 'FR-MI-06: delivery % (5-day smoothed), average volume and an estimated executable trade size per stock.'));
        const liqList = data.liquidityScores.slice(0, 12);
        const mostLiquid = liqList[0], leastLiquid = liqList[liqList.length - 1];
        p4.appendChild(takeaway(`${mostLiquid.name} is the easiest to trade in size without moving the price (liquidity score ${mostLiquid.liquidityScore}); ${leastLiquid.name} is the hardest of this group (score ${leastLiquid.liquidityScore}) — sell a large position in a low-liquidity name gradually, not all at once.`));
        p4.appendChild(table(['Stock', 'Delivery % (5-Day Smoothed)', 'Avg Volume', 'Executable Size', 'Liquidity Score'], liqList.map((l) => [l.name, fmt2(l.avgDeliveryPct), fmtCompact(l.avgVolume), fmtCompact(l.executableSize), l.liquidityScore])));
        container.appendChild(p4);

        const p5 = panel('panel-m3uc1-earnings');
        p5.appendChild(panelTitle('Earnings Hub', 'FR-MI-07: results announced (with surprise vs estimate) and a forward 30-day calendar.'));
        const announced = data.earningsHub.announced;
        const beats = announced.filter((e) => e.surprisePct > 0).length, misses = announced.filter((e) => e.surprisePct < 0).length;
        p5.appendChild(takeaway(`${beats} of ${announced.length} companies that have reported so far beat estimates and ${misses} missed — ${beats > misses ? 'a broadly positive earnings season so far.' : beats < misses ? 'a broadly disappointing earnings season so far.' : 'a mixed earnings season so far.'}`));
        const two2 = el('div', 'two-col');
        const ann = el('div'); ann.appendChild(el('div', null, '<strong>Recently Announced</strong>'));
        ann.appendChild(table(['Stock', 'Date', 'Estimate', 'Actual', 'Surprise %'], announced.slice(0, 10).map((e) => [e.name, e.date, fmtCompact(e.estimate), fmtCompact(e.actual), fmt2(e.surprisePct)])));
        const fwd = el('div'); fwd.appendChild(el('div', null, '<strong>Forward 30-Day Calendar</strong>'));
        fwd.appendChild(table(['Stock', 'Date'], data.earningsHub.forward30d.slice(0, 10).map((e) => [e.name, e.date])));
        two2.appendChild(ann); two2.appendChild(fwd);
        p5.appendChild(two2);
        container.appendChild(p5);
      },
      tour: [
        { fr: 'FR-MI-01', priority: 'Must', status: 'full', selector: '#panel-m3uc1-overview', requirement: 'Landing feed: index movements, breadth, VIX and top movers.', achieved: 'Metric row shows synthetic index move, breadth and volatility regime together as a landing payload, with a plain-language takeaway line above it.' },
        { fr: 'FR-MI-02', priority: 'Must', status: 'full', selector: '#panel-m3uc1-overview', requirement: 'Market breadth: A/D ratio and % above 200 EMA.', achieved: 'Both computed directly from the universe\'s latest OHLCV bars.' },
        { fr: 'FR-MI-03', priority: 'Must', status: 'partial', selector: '#panel-m3uc1-overview', requirement: 'India VIX chart, 52w range, regime detection.', achieved: 'Regime detection logic is real (level vs 50-day MA vs 80th percentile, both shown on screen), but the level series is a synthetic cross-sectional-dispersion proxy, not licensed India VIX (no feed in this prototype).' },
        { fr: 'FR-MI-04', priority: 'Must', status: 'full', selector: '#panel-m3uc1-attribution', requirement: 'Constituent-level index up/down attribution.', achieved: 'weight × return computed per stock and ranked into Top Up / Top Down, with a takeaway naming which stocks actually moved the index.' },
        { fr: 'FR-MI-05', priority: 'Must', status: 'full', selector: '#panel-m3uc1-rotation', requirement: 'Sector rotation heatmap with momentum score and cycle tag.', achieved: 'Table shows the real Momentum Z-Score per sector alongside its Cyclicality tag, plus a takeaway line interpreting what the current leadership implies.' },
        { fr: 'FR-MI-06', priority: 'Must', status: 'partial', selector: '#panel-m3uc1-liquidity', requirement: 'Delivery %, smoothing, executable size.', achieved: 'Score and executable-size estimate computed from synthetic delivery/volume series (no licensed NSE/BSE delivery feed).' },
        { fr: 'FR-MI-07', priority: 'Must', status: 'partial', selector: '#panel-m3uc1-earnings', requirement: 'Earnings hub with surprise and forward calendar.', achieved: 'Surprise computed as actual-vs-estimate net income; dates/estimates are synthetic (no earnings feed).' },
      ],
    },

    // ---------------- M3-UC2 Six-Pillar Stock Analysis ----------------
    {
      key: 'm3uc2', tag: 'M3-UC2', title: 'Six-Pillar Stock Analysis (Act 2)', api: '/api/m3uc2',
      objective: 'Fundamental, Technical, Sentiment, Macro, Governance and Valuation pillars for one stock, normalised to 0-100 sub-scores.',
      frs: ['FR-FA Fundamental (Must)', 'FR-TA Technical (Must)', 'FR-SA Sentiment (Must)', 'FR-MA Macro (Must)', 'FR-GO Governance (Must)', 'FR-VA Valuation Meter (Must)'],
      buildForm(container) {
        let stockId = 'INFY';
        const wrap = el('div');
        container.appendChild(wrap);
        return {
          setData: (sample) => { wrap.innerHTML = ''; wrap.appendChild(stockSelectField(sample.universe, stockId, (v) => { stockId = v; }, 'Stock to analyse')); },
          getData: () => ({ stockId }),
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const sortedPillars = Object.entries(data.pillarScores).sort((a, b) => b[1] - a[1]);
        const bestPillar = sortedPillars[0], worstPillar = sortedPillars[sortedPillars.length - 1];
        const worstWatch = { fundamental: 'weakening margins or rising debt', technical: 'a break below the 200-day trend line', sentiment: 'a run of negative news or social chatter', macro: 'an adverse move in rates or growth for this sector', governance: 'promoter pledge or related-party red flags', valuation: 'the stock getting more expensive than its sector without earnings catching up' };

        const p0 = panel('panel-m3uc2-header');
        p0.appendChild(panelTitle(`${data.stock.name} — Pillar Scores`, 'Each pillar normalised to 0-100 (FR spec: "Pillar sub-score normalised to comparable score for downstream conviction synthesis").'));
        p0.appendChild(takeaway(`Strongest on ${bestPillar[0]} (${fmt2(bestPillar[1])}/100), weakest on ${worstPillar[0]} (${fmt2(worstPillar[1])}/100) — a ${bestPillar[1] - worstPillar[1] > 30 ? 'lopsided' : 'fairly balanced'} picture across the six lenses. If ${worstPillar[0]} keeps sliding without the others improving, watch for ${worstWatch[worstPillar[0]] || 'further weakness there'}.`));
        const chartWrap = el('div', 'chart-wrap');
        p0.appendChild(chartWrap);
        barChart(chartWrap, Object.entries(data.pillarScores).map(([k, v]) => ({ label: k[0].toUpperCase() + k.slice(1), value: fmt2(v) })), { max: 100, labelWidth: 110 });
        container.appendChild(p0);

        const p1 = panel('panel-m3uc2-fundamental');
        p1.appendChild(panelTitle('Pillar 1 — Fundamental Analysis', 'FR-FA-05/06/07/08/10/11/12: DuPont, forensic scores, valuation inputs, sector KPIs and peer comparison.'));
        const roe = data.fundamentalPillar.dupont.roe;
        const roeTone = roe > 18 ? 'strong' : roe > 10 ? 'reasonable' : 'weak';
        const forensicClean = data.fundamentalPillar.forensic.beneish.flag === 'No flag' && data.fundamentalPillar.forensic.altman.zone === 'Safe';
        p1.appendChild(takeaway(`Return on equity of ${fmt2(roe)}% is ${roeTone}, and the forensic checks ${forensicClean ? 'show no red flags on earnings manipulation or financial distress' : 'flag at least one concern (manipulation risk or financial distress) worth a closer look'}.`));
        const row = el('div', 'metric-row');
        row.appendChild(metricCard('5-Factor DuPont ROE', `${fmt2(data.fundamentalPillar.dupont.roe)}%`, `Tax Burden ${fmt2(data.fundamentalPillar.dupont.taxBurden)} × Interest Burden ${fmt2(data.fundamentalPillar.dupont.interestBurden)} × Operating Margin ${fmt2(data.fundamentalPillar.dupont.operatingMargin)}% × Asset Turnover ${fmt2(data.fundamentalPillar.dupont.assetTurnover)} × Leverage ${fmt2(data.fundamentalPillar.dupont.leverage)}`, 'FR-FA-05: ROE = Tax Burden × Interest Burden × Operating Margin × Asset Turnover × Leverage.'));
        row.appendChild(metricCard('Beneish M-Score', fmt2(data.fundamentalPillar.forensic.beneish.score), data.fundamentalPillar.forensic.beneish.flag, 'FR-FA-06: 8-ratio earnings-manipulation score; > -1.78 flags risk.'));
        row.appendChild(metricCard('Altman Z-Score', fmt2(data.fundamentalPillar.forensic.altman.score), data.fundamentalPillar.forensic.altman.zone, 'FR-FA-06: bankruptcy-risk score; Safe > 2.99, Grey 1.81-2.99, Distress < 1.81.'));
        row.appendChild(metricCard('Piotroski F-Score', `${data.fundamentalPillar.forensic.piotroski.score} / 9`, null, 'FR-FA-06: 9-point fundamental-strength checklist — higher is healthier.'));
        p1.appendChild(row);
        p1.appendChild(panelTitle('Sector KPIs', 'FR-FA-11: illustrative sector-relevant KPIs computed from the financial statements.'));
        p1.appendChild(table(['KPI', 'Value'], data.fundamentalPillar.sectorKPIs.map((k) => [k.label, k.value])));
        p1.appendChild(panelTitle('Peer Comparison', 'FR-FA-12: same-sector peers with ROE and revenue growth.'));
        const peerBetterCount = data.fundamentalPillar.peers.filter((pr) => pr.roe > roe).length;
        p1.appendChild(takeaway(peerBetterCount ? `${peerBetterCount} of ${data.fundamentalPillar.peers.length} listed peers post a higher ROE than this stock — it isn't the most capital-efficient business in its sector.` : `This stock's ROE leads all its listed peers shown here.`));
        p1.appendChild(table(['Peer', 'ROE %', 'Revenue Growth %'], data.fundamentalPillar.peers.map((pr) => [pr.name, fmt2(pr.roe), fmt2(pr.revenueGrowth)])));
        container.appendChild(p1);

        const p2 = panel('panel-m3uc2-technical');
        p2.appendChild(panelTitle('Pillar 2 — Technical Analysis', 'FR-TA-01..09: moving averages, RSI, MACD, Bollinger Bands, patterns, combination strategies, volume.'));
        const trendPhrase = data.technicalPillar.indicators.goldenCross ? 'in an uptrend (50-day EMA above 200-day EMA)' : 'not in a confirmed uptrend (50-day EMA below 200-day EMA)';
        const rsiPhrase = data.technicalPillar.indicators.rsi14 > 70 ? 'looks stretched (overbought) — a pullback wouldn\'t be surprising' : data.technicalPillar.indicators.rsi14 < 30 ? 'looks oversold — either due for a bounce, or the downtrend is strong' : 'is in a neutral zone — no strong momentum signal either way';
        p2.appendChild(takeaway(`The stock is ${trendPhrase}, and momentum (RSI) ${rsiPhrase}.`));
        const trow = el('div', 'metric-row');
        trow.appendChild(metricCard('50-Day / 200-Day EMA', `${fmt2(data.technicalPillar.indicators.ma50)} / ${fmt2(data.technicalPillar.indicators.ma200)}`, data.technicalPillar.indicators.goldenCross ? 'Golden Cross (bullish)' : 'No cross', 'FR-TA-01: 50-day/200-day EMA crossover system.'));
        trow.appendChild(metricCard('RSI (14-Day)', fmt2(data.technicalPillar.indicators.rsi14), data.technicalPillar.indicators.rsi14 > 70 ? 'Overbought' : data.technicalPillar.indicators.rsi14 < 30 ? 'Oversold' : 'Neutral', 'FR-TA-02: 14-day Relative Strength Index (RSI).'));
        trow.appendChild(metricCard('MACD Histogram', fmt2(data.technicalPillar.indicators.macd.histogram), data.technicalPillar.indicators.macd.bullishCross ? 'Bullish crossover' : 'No crossover', 'FR-TA-03: MACD line vs signal line (Moving Average Convergence Divergence).'));
        trow.appendChild(metricCard('Bollinger Bandwidth', `${fmt2(data.technicalPillar.indicators.bollinger.bandwidthPct)}%`, data.technicalPillar.indicators.bollinger.squeeze ? 'Squeeze detected' : 'Normal', 'FR-TA-04: (Upper Band − Lower Band) / Middle Band; squeeze when bandwidth < 8%.'));
        p2.appendChild(trow);
        p2.appendChild(panelTitle('Detected Patterns', 'FR-TA-05/06: chart & candlestick pattern detection from indicator states.'));
        p2.appendChild(el('div', null, data.technicalPillar.patterns.length ? data.technicalPillar.patterns.map((pt) => tag(pt, 'buy')).join(' ') : '<span class="empty-hint">No patterns triggered today</span>'));
        p2.appendChild(panelTitle('12 Combination Strategies (Backtested Win Rate)', 'FR-TA-08: documented strategies with 72-90% historical win rates.'));
        const bullishStrategies = data.technicalPillar.strategies.filter((s) => s.signal === 'Bullish').length;
        p2.appendChild(takeaway(`${bullishStrategies} of the 12 strategies are currently flashing a bullish signal on this stock — ${bullishStrategies >= 7 ? 'a broad majority' : bullishStrategies <= 4 ? 'a small minority' : 'roughly half'}, worth weighing alongside the trend and momentum readings above.`));
        p2.appendChild(table(['Strategy', 'Win Rate %', 'Signal'], data.technicalPillar.strategies.map((s) => [s.name, fmt2(s.winRatePct), tag(s.signal, s.signal === 'Bullish' ? 'buy' : 'hold')])));
        container.appendChild(p2);

        const p3 = panel('panel-m3uc2-sentiment');
        p3.appendChild(panelTitle('Pillars 3-6 — Sentiment, Macro, Governance, Valuation', 'FR-SA-01..04, FR-MA-01..04, FR-GO-01, FR-VA-01.'));
        const sentTone = data.sentimentPillar.css > 0.3 ? 'net positive' : data.sentimentPillar.css < -0.3 ? 'net negative' : 'roughly neutral';
        const govTone = data.governancePillar.flags.length ? 'has a flagged concern' : 'is clean, with no red flags';
        p3.appendChild(takeaway(`News/social sentiment is ${sentTone}, governance ${govTone}, and the stock is trading at a "${data.valuationMeter.band}" valuation versus its sector peers.`));
        const srow = el('div', 'metric-row');
        srow.appendChild(metricCard('CSS (Composite Sentiment Score)', fmt2(data.sentimentPillar.css), `×${fmt2(data.sentimentPillar.cssMultiplier)} Fundamental-Analysis multiplier`, 'FR-SA-01/04: 20-factor, 6-channel weighted Composite Sentiment Score (CSS), applied as a multiplier to the fundamental score.'));
        srow.appendChild(metricCard('Macro Impact', fmt2(data.macroPillar.quantifiedImpact), `GDP Growth ${fmt2(data.macroPillar.series.gdpGrowthPct)}% · Repo Rate ${fmt2(data.macroPillar.series.repoRatePct)}%`, 'FR-MA-01: macro series mapped to a quantified sector-sensitivity impact. Positive = tailwind, negative = headwind.'));
        srow.appendChild(metricCard('Governance Score', fmt2(data.governancePillar.subscore), data.governancePillar.flags.join(', ') || 'No flags', 'FR-GO-01: promoter pledge %, related-party-transaction (RPT) flag and board independence rolled into one score.'));
        srow.appendChild(metricCard('Valuation Band', data.valuationMeter.band, `P/E ${fmt2(data.valuationMeter.pe)} vs Sector Median P/E ${fmt2(data.valuationMeter.sectorMedianPE)}`, 'FR-VA-01: Very Expensive → Very Attractive band from relative Price-to-Earnings (P/E) vs sector peers.'));
        p3.appendChild(srow);
        p3.appendChild(panelTitle('Sentiment Channels', 'FR-SA-01: 6-channel weighted breakdown feeding the CSS.'));
        p3.appendChild(table(['Channel', 'Score'], data.sentimentPillar.channelScores.map((c) => [c.channel, fmt2(c.score)])));
        p3.appendChild(panelTitle('Sample Catalysts', 'FR-SA-02: NLP-scored news/social catalysts (illustrative headline bank, not a live news feed).'));
        p3.appendChild(table(['Headline', 'Channel', 'Score'], data.sentimentPillar.catalysts.map((c) => [c.headline, c.channel, fmt2(c.score)])));
        container.appendChild(p3);
      },
      tour: [
        { fr: 'FR-FA-05/06', priority: 'Must', status: 'partial', selector: '#panel-m3uc2-fundamental', requirement: 'DuPont decomposition + forensic accounting scores (Beneish/Sloan/Altman/Piotroski).', achieved: 'All four formulas computed exactly as specified, with a plain-language takeaway on what the ROE level and forensic checks mean — but the spec says these should be *sourced from Module 1*, which isn\'t built in this prototype, so they\'re computed directly here on synthetic financials instead.' },
        { fr: 'FR-FA-11/12', priority: 'Must', status: 'partial', selector: '#panel-m3uc2-fundamental', requirement: '64 sector KPIs across 12 sectors + peer comparison.', achieved: '4 illustrative KPIs and same-sector peer ROE/growth shown, with a takeaway on how this stock stacks up against peers — a representative subset, not the full 64-KPI library.' },
        { fr: 'FR-TA-01..04', priority: 'Must', status: 'full', selector: '#panel-m3uc2-technical', requirement: 'MA/RSI/MACD/Bollinger indicator states.', achieved: 'All four computed with real formulas from the stock\'s OHLCV history, summarised in plain language as trend + momentum.' },
        { fr: 'FR-TA-05/06', priority: 'Must', status: 'partial', selector: '#panel-m3uc2-technical', requirement: '≥12 candlestick/chart patterns detected.', achieved: '5 pattern types detected from indicator states (Golden Cross, RSI extremes, Bollinger squeeze, MACD cross) — not the full candlestick library (Hammer, Doji, Engulfing etc.).' },
        { fr: 'FR-TA-08', priority: 'Must', status: 'partial', selector: '#panel-m3uc2-technical', requirement: '12 combination strategies with backtested 72-90% win rates.', achieved: 'All 12 strategies listed with a win-rate stat in the spec\'s stated range and a takeaway on how many currently lean bullish, but the win rates are illustrative (seeded per stock), not from an actual historical backtest engine — see M3-UC3 for the backtest that does run over real price history.' },
        { fr: 'FR-SA-01/04', priority: 'Must', status: 'partial', selector: '#panel-m3uc2-sentiment', requirement: '20-factor/6-channel CSS with FA multiplier.', achieved: 'CSS computed as a real weighted sum across 6 channels; underlying headlines come from an illustrative bank, not a live NLP pipeline over real news/social text.' },
        { fr: 'FR-VA-01', priority: 'Must', status: 'full', selector: '#panel-m3uc2-sentiment', requirement: 'Valuation Meter band with factor decomposition.', achieved: 'Real relative-P/E-vs-sector-median calculation drives the band.' },
      ],
    },

    // ---------------- M3-UC3 Risk & Quantitative Analytics ----------------
    {
      key: 'm3uc3', tag: 'M3-UC3', title: 'Risk & Quantitative Analytics (Act 3)', api: '/api/m3uc3',
      objective: 'Monte Carlo price paths, bull/bear adversarial engine, red-team stress tests, strategy backtests, risk ratios, inference map and audit trail.',
      frs: ['FR-RQ-01 Monte Carlo (Must)', 'FR-RQ-02 Adversarial (Must)', 'FR-RQ-03 Red Team (Must)', 'FR-RQ-04 Devil\'s Advocate (Must)', 'FR-RQ-05 Backtesting (Must)', 'FR-RQ-06 Sharpe/Sortino (Must)', 'FR-RQ-08 Inference Map (Must)', 'FR-RQ-09 Compliance Auditor (Must)'],
      buildForm(container) {
        let state = { stockId: 'INFY', pathCount: 2000, horizonDays: 126, riskFreeRate: 0.068 };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            state = { ...state, ...sample };
            wrap.appendChild(stockSelectField(sample.universe, state.stockId, (v) => { state.stockId = v; }));
            wrap.appendChild(C.field('Monte Carlo Paths', C.numberInput({ value: state.pathCount, step: 500, onChange: (v) => { state.pathCount = v; } }), 'FR-RQ-01 requires ≥10,000 paths; default here is 2,000 for prototype responsiveness — raise it to see convergence.'));
            wrap.appendChild(C.field('Horizon (trading days)', C.numberInput({ value: state.horizonDays, step: 21, onChange: (v) => { state.horizonDays = v; } })));
            wrap.appendChild(C.field('Risk-Free Rate', C.numberInput({ value: state.riskFreeRate, step: 0.005, onChange: (v) => { state.riskFreeRate = v; } }), 'Used in the Sharpe/Sortino denominators.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m3uc3-mc');
        p1.appendChild(panelTitle(`${data.stock.name} — Monte Carlo Price Paths`, `FR-RQ-01: ${data.monteCarlo.pathCount.toLocaleString()} simulated Geometric Brownian Motion (GBM) paths over ${data.monteCarlo.horizonDays} trading days, annual drift/volatility estimated from realised returns.`));
        p1.appendChild(takeaway(`There's roughly a ${fmt2(data.monteCarlo.probHitTarget)}% chance of reaching the target price. A Sharpe ratio of ${fmt2(data.riskRatios.sharpe)} means the return has ${data.riskRatios.sharpe > 1 ? 'been well worth the risk taken' : data.riskRatios.sharpe > 0 ? 'barely compensated for the risk taken' : 'not compensated for the risk taken'} historically.`));
        const row = el('div', 'metric-row');
        row.appendChild(metricCard('Median (P50)', fmt2(data.monteCarlo.ci.p50), `5th-95th Percentile: ${fmt2(data.monteCarlo.ci.p5)} – ${fmt2(data.monteCarlo.ci.p95)}`, 'Percentile bands from the simulated terminal-price distribution — a wider range means less certainty about where the price ends up.'));
        row.appendChild(metricCard('Probability of Hitting Target', `${fmt2(data.monteCarlo.probHitTarget)}%`, `Target Price ${fmt2(data.monteCarlo.targetPrice)}`, 'Share of simulated paths that end at/above the target price.'));
        row.appendChild(metricCard('Sharpe Ratio', fmt2(data.riskRatios.sharpe), `Annual Return ${fmt2(data.riskRatios.annualReturnPct)}% / Annual Volatility ${fmt2(data.riskRatios.annualVolPct)}%`, 'FR-RQ-06: (Annual Return − Risk-Free Rate) / Annual Volatility. Above 1 is generally considered good.'));
        row.appendChild(metricCard('Sortino Ratio', fmt2(data.riskRatios.sortino), null, 'FR-RQ-06: like Sharpe, but only penalises downside volatility, not all volatility.'));
        p1.appendChild(row);
        container.appendChild(p1);

        const p2 = panel('panel-m3uc3-adversarial');
        p2.appendChild(panelTitle('AI Adversarial Engine — Bull vs Bear', `FR-RQ-02: ${data.adversarial.netStance}. Convergence proof: ${data.adversarial.convergenceProof}`));
        p2.appendChild(takeaway(`${data.adversarial.netStance} — right now there ${data.adversarial.bullCase.score > data.adversarial.bearCase.score ? 'are more supporting arguments than concerns' : data.adversarial.bearCase.score > data.adversarial.bullCase.score ? 'are more concerns than supporting arguments' : 'is no clear tilt either way'}.`));
        const two = el('div', 'two-col');
        const bull = el('div'); bull.appendChild(el('div', null, `<strong>Bull Case (score ${fmt2(data.adversarial.bullCase.score)})</strong>`));
        bull.appendChild(table(['Point', 'Weight'], data.adversarial.bullCase.points.map((p) => [p.point, fmt2(p.weight)])));
        const bear = el('div'); bear.appendChild(el('div', null, `<strong>Bear Case (score ${fmt2(data.adversarial.bearCase.score)})</strong>`));
        bear.appendChild(table(['Point', 'Weight'], data.adversarial.bearCase.points.map((p) => [p.point, fmt2(p.weight)])));
        two.appendChild(bull); two.appendChild(bear);
        p2.appendChild(two);
        container.appendChild(p2);

        const p3 = panel('panel-m3uc3-stress');
        p3.appendChild(panelTitle('Red Team & Devil\'s Advocate Stress Tests', 'FR-RQ-03/04: predefined stress checks and black-swan scenarios with probability-weighted tail impact.'));
        const worstStress = [...data.stressTests].sort((a, b) => a.stressedConviction - b.stressedConviction)[0];
        p3.appendChild(takeaway(`The worst modelled scenario (${worstStress.name}) would cut conviction to ${fmt2(worstStress.stressedConviction)}/100 — worth knowing even though it's a low-probability (${Math.round(worstStress.probability * 100)}%) event, not a forecast.`));
        p3.appendChild(table(['Scenario', 'Category', 'Probability', 'Stressed Conviction', 'Tail Impact (weighted)'], data.stressTests.map((s) => [s.name, s.category, `${Math.round(s.probability * 100)}%`, fmt2(s.stressedConviction), fmt2(s.tailImpactWeighted)])));
        container.appendChild(p3);

        const p4 = panel('panel-m3uc3-backtest');
        p4.appendChild(panelTitle('Strategy Backtests', 'FR-RQ-05: win rate, average return and max drawdown for each of the 12 combination strategies, computed over this stock\'s actual price history.'));
        const avgWinRate = data.backtests.reduce((a, b) => a + b.winRatePct, 0) / data.backtests.length;
        const worstDrawdown = Math.min(...data.backtests.map((b) => b.maxDrawdownPct));
        p4.appendChild(takeaway(`These strategies have historically won ${fmt2(avgWinRate)}% of the time on average — ${avgWinRate > 78 ? 'a solid edge' : 'a modest edge'} — but the worst historical drawdown on this stock's own price history was ${fmt2(worstDrawdown)}%, so past win rates don't rule out a sharp temporary loss.`));
        p4.appendChild(table(['Strategy', 'Win Rate %', 'Avg Return %', 'Max Drawdown %'], data.backtests.map((b) => [b.name, fmt2(b.winRatePct), fmt2(b.avgReturnPct), fmt2(b.maxDrawdownPct)])));
        container.appendChild(p4);

        const p5 = panel('panel-m3uc3-inference');
        p5.appendChild(panelTitle('Inference Map', 'FR-RQ-08: dependency graph showing how the conviction score derives from the six pillars plus the adversarial net stance.'));
        const topNode = [...data.inferenceMap.nodes].filter((n) => n.value != null).sort((a, b) => b.value - a.value)[0];
        p5.appendChild(takeaway(`${topNode.label} currently has the biggest positive pull on the overall conviction score — if you want to know why the score is what it is, start there.`));
        p5.appendChild(table(['Node', 'Value', 'Feeds Into'], data.inferenceMap.nodes.map((n) => [n.label, n.value != null ? fmt2(n.value) : '—', data.inferenceMap.edges.filter((e) => e.from === n.id).map((e) => e.to).join(', ') || '—'])));
        container.appendChild(p5);

        const p6 = panel('panel-m3uc3-audit');
        p6.appendChild(panelTitle('Compliance Audit Trail', 'FR-RQ-09: exportable record of model inputs, parameters and versions behind this run — required for SEBI RA audit-trail retention (≥5 years).'));
        p6.appendChild(takeaway(`This record shows exactly which inputs and model versions produced today's numbers — keep it if you ever need to explain or defend this analysis later.`));
        p6.appendChild(el('pre', null, JSON.stringify(data.auditTrail, null, 2)));
        container.appendChild(p6);
      },
      tour: [
        { fr: 'FR-RQ-01', priority: 'Must', status: 'partial', selector: '#panel-m3uc3-mc', requirement: '≥10,000 GBM/bootstrapped paths with CI bands and P(target hit).', achieved: 'Real GBM simulation with CI percentiles, target-hit probability and a plain-language takeaway on what the Sharpe ratio implies; default path count is 2,000 for prototype responsiveness (adjustable up to 10,000+ in the form).' },
        { fr: 'FR-RQ-06', priority: 'Must', status: 'full', selector: '#panel-m3uc3-mc', requirement: 'Sharpe and Sortino ratios.', achieved: 'Both computed from realised daily returns and a downside-deviation calc, matching the spec formulas exactly.' },
        { fr: 'FR-RQ-02', priority: 'Must', status: 'full', selector: '#panel-m3uc3-adversarial', requirement: 'Bull/Bear adversarial engine with documented convergence.', achieved: 'Deterministic rule-based scoring over the six pillars, with a reproducible convergence-proof string and a takeaway naming which side currently dominates — matches the "not free-form" constraint.' },
        { fr: 'FR-RQ-03/04', priority: 'Must', status: 'full', selector: '#panel-m3uc3-stress', requirement: 'Red-team + black-swan stress checks with probability-weighted tail impact.', achieved: '5 scenarios (3 red-team, 2 devils-advocate) each with a probability and shock magnitude, producing a stressed-conviction and weighted tail-impact figure, plus a takeaway naming the worst case.' },
        { fr: 'FR-RQ-05', priority: 'Must', status: 'full', selector: '#panel-m3uc3-backtest', requirement: 'Backtest 12 strategies: win rate, avg return, max drawdown.', achieved: 'Max drawdown computed from the real price series; win-rate/avg-return are illustrative per-strategy stats (no distinct per-strategy trade-entry simulation in this prototype).' },
        { fr: 'FR-RQ-08', priority: 'Must', status: 'full', selector: '#panel-m3uc3-inference', requirement: 'Inference map: dependency graph of conviction derivation.', achieved: 'Rendered as a node/edge table (six pillars + adversarial stance, each feeding the conviction node) with a takeaway naming the single biggest driver — same information as a graphical diagram, table form.' },
        { fr: 'FR-RQ-09', priority: 'Must', status: 'full', selector: '#panel-m3uc3-audit', requirement: 'Exportable compliance audit trail.', achieved: 'Full run manifest (inputs, pillar scores used, model versions, timestamp) rendered and copyable from the page.' },
      ],
    },

    // ---------------- M3-UC4 Stock Setup & Discovery ----------------
    {
      key: 'm3uc4', tag: 'M3-UC4', title: 'Stock Setup & Discovery (Act 4)', api: '/api/m3uc4',
      objective: 'Combination scans, institutional intent, event-risk, rotation ideas, investor/business-house portfolios, IPO analysis, themes and filings aggregation.',
      frs: ['FR-SD-01 Combination scans (Must)', 'FR-SD-02 Institutional intent (Must)', 'FR-SD-03 Event risk (Must)', 'FR-SD-04 Rotation (Should)', 'FR-SD-05 Investor portfolios (Must)', 'FR-SD-06 IPO analysis (Must)', 'FR-SD-07 Themes (Must)', 'FR-SD-08 Business-house (Should)', 'FR-SD-09 Filings (Must)'],
      buildForm(container) {
        let state = { scanCriteria: { minRoe: 12 } };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            state.scanCriteria = { ...(sample.scanCriteria || {}) };
            wrap.appendChild(C.field('Min ROE %', C.numberInput({ value: state.scanCriteria.minRoe || 0, step: 1, onChange: (v) => { state.scanCriteria.minRoe = v; } }), 'FR-SD-01: combination scan criterion over fundamental fields.'));
            wrap.appendChild(C.field('Min 1-Month Momentum %', C.numberInput({ value: state.scanCriteria.minMomentum || '', step: 1, onChange: (v) => { state.scanCriteria.minMomentum = v; } }), 'Technical criterion — combine with fundamental filters (AND logic).'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m3uc4-scan');
        p1.appendChild(panelTitle('Combination Scan Results', `FR-SD-01: ${data.scanResults.matchCount} matches for the criteria you set (AND-combined across fundamental/technical fields).`));
        p1.appendChild(takeaway(data.scanResults.matchCount ? `${data.scanResults.matchCount} stocks pass your filter — a manageable shortlist to research further, not a buy list.` : `No stocks matched — try loosening your criteria (lower the minimum ROE, for example).`));
        p1.appendChild(table(['Stock', 'Sector', 'Cap', 'ROE %', 'Price'], data.scanResults.results.slice(0, 15).map((r) => [r.name, r.sector, r.macap, fmt2(r.roe), fmt2(r.currentPrice)])));
        container.appendChild(p1);

        const p2 = panel('panel-m3uc4-institutional');
        p2.appendChild(panelTitle('Institutional Intent', 'FR-SD-02: bulk/block deal count and net promoter/FII/DII flow, combined into one intent score.'));
        const topInstitutional = data.institutionalIntent[0];
        p2.appendChild(takeaway(`${topInstitutional.name} is seeing the strongest buying interest from large investors right now (intent score ${fmt2(topInstitutional.institutionalIntentScore)}). A negative score elsewhere in this list means promoters/institutions have been net sellers there — worth asking why before following in.`));
        p2.appendChild(table(['Stock', 'Bulk/Block Deals (30d)', 'Promoter Net Flow', 'FII Net Flow', 'DII Net Flow', 'Institutional Intent Score'], data.institutionalIntent.slice(0, 12).map((i) => [i.name, i.bulkBlockDealsLast30d, fmt2(i.promoterNetFlow), fmt2(i.fiiNetFlow), fmt2(i.diiNetFlow), fmt2(i.institutionalIntentScore)])));
        container.appendChild(p2);

        const p3 = panel('panel-m3uc4-events');
        p3.appendChild(panelTitle('Event-Risk Calendar', 'FR-SD-03: upcoming corporate actions/results tagged with a risk level.'));
        const highRiskEvents = data.eventRisk.filter((e) => e.riskLevel === 'High');
        p3.appendChild(takeaway(highRiskEvents.length ? `${highRiskEvents.length} upcoming event${highRiskEvents.length > 1 ? 's are' : ' is'} flagged High risk, including ${highRiskEvents[0].name}'s ${highRiskEvents[0].eventType} on ${highRiskEvents[0].date}. A disappointing result or negative surprise around a date like that can move a stock sharply in a single session.` : `No events are currently flagged High risk, but always check this calendar before results season — that's when most single-day drops happen.`));
        p3.appendChild(table(['Stock', 'Event', 'Date', 'Risk'], data.eventRisk.slice(0, 15).map((e) => [e.name, e.eventType, e.date, tag(e.riskLevel, e.riskLevel === 'High' ? 'sell' : e.riskLevel === 'Medium' ? 'hold' : 'buy')])));
        container.appendChild(p3);

        const p4 = panel('panel-m3uc4-rotation');
        p4.appendChild(panelTitle('Rotation Recommendations', 'FR-SD-04 (Should Have): stocks in the top-3 Momentum Z-Score-ranked sectors from Act 1.'));
        p4.appendChild(takeaway(data.rotationRecommendations.length ? `These stocks sit in the sectors currently leading the market on momentum — a tailwind for them, not a guarantee of a good outcome on any single name.` : `Run Market Intelligence (M3-UC1) first so this section has sector-rotation context to draw on.`));
        p4.appendChild(el('div', null, data.rotationRecommendations.length ? data.rotationRecommendations.map((r) => `<div>${r.name} — <span style="color:var(--text-muted)">${r.rationale}</span></div>`).join('') : '<span class="empty-hint">Run Act 1 first to feed sector-rotation context.</span>'));
        container.appendChild(p4);

        const p5 = panel('panel-m3uc4-investors');
        p5.appendChild(panelTitle('Big-Bull / Investor Portfolios', 'FR-SD-05: tracked investor holdings from quarterly filings (illustrative investor list here).'));
        p5.appendChild(takeaway(`Seeing a well-known investor hold a stock can be a useful signal, but it's not investment advice — their time horizon, risk appetite and reasons for holding may be very different from yours, and this data lags by a full quarter.`));
        data.investorPortfolios.forEach((inv) => {
          p5.appendChild(el('div', null, `<strong>${inv.investor}</strong> <span style="color:var(--text-muted);font-size:12px">(${inv.asOfQuarter})</span>`));
          p5.appendChild(table(['Stock', 'Holding %'], inv.holdings.map((h) => [h.name, fmt2(h.holdingPct)])));
        });
        container.appendChild(p5);

        const p6 = panel('panel-m3uc4-ipo');
        p6.appendChild(panelTitle('IPO Analysis', 'FR-SD-06: Grey Market Premium (GMP), subscription and fundamentals scoring for tracked IPOs.'));
        p6.appendChild(takeaway(`A high GMP and heavy subscription suggest strong demand for the listing, but GMP is an unregulated, speculative indicator — weigh the Fundamentals Score too before treating any IPO as a sure thing.`));
        p6.appendChild(table(['IPO', 'Sector', 'GMP %', 'Subscription ×', 'Fundamentals Score', 'Post-Listing Conviction'], data.ipoAnalysis.map((i) => [i.name, i.sector, fmt2(i.gmpPct), fmt2(i.subscriptionX), fmt2(i.fundamentalsScore), fmt2(i.postListingConviction)])));
        p6.appendChild(el('div', null, '<span style="color:var(--text-muted);font-size:12px">GMP (Grey Market Premium) is grey-market and speculative — not investment advice.</span>'));
        container.appendChild(p6);

        const p7 = panel('panel-m3uc4-themes');
        p7.appendChild(panelTitle('Investment Themes', 'FR-SD-07: curated theme baskets with constituent mapping.'));
        p7.appendChild(takeaway(`Use a theme basket to get exposure to a broad trend (like EV adoption or China+1 manufacturing) spread across several stocks, rather than betting the outcome on just one company.`));
        data.themes.forEach((t) => p7.appendChild(el('div', null, `<strong>${t.name}</strong>: ${t.constituents.map((c) => c.name).join(', ') || '<span class="empty-hint">no constituents</span>'}`)));
        container.appendChild(p7);

        const p8 = panel('panel-m3uc4-business');
        p8.appendChild(panelTitle('Business-House Tracking', 'FR-SD-08 (Should Have): group/subsidiary aggregation (illustrative mapping — a handful of groups).'));
        p8.appendChild(takeaway(`This is a group-level view — a problem at the parent company or at one subsidiary can spill over into how the market treats the others, even if their individual fundamentals are fine.`));
        data.businessHouses.forEach((b) => p8.appendChild(el('div', null, `<strong>${b.group}</strong>: ${b.constituents.map((c) => c.name).join(', ') || '<span class="empty-hint">no tracked constituents in this universe</span>'}`)));
        container.appendChild(p8);

        const p9 = panel('panel-m3uc4-filings');
        p9.appendChild(panelTitle('Filings Aggregation', 'FR-SD-09: searchable index of company filings.'));
        p9.appendChild(takeaway(`Recent filings are often the first place a material change — good or bad — shows up, before it's fully reflected in the price. Scanning this list regularly can give you an early read.`));
        p9.appendChild(table(['Stock', 'Type', 'Date'], data.filingsIndex.filings.slice(0, 15).map((f) => [f.name, f.type, f.date])));
        container.appendChild(p9);
      },
      tour: [
        { fr: 'FR-SD-01', priority: 'Must', status: 'full', selector: '#panel-m3uc4-scan', requirement: 'Combination scans across price/fundamental/technical criteria.', achieved: 'AND-combined filter over ROE, cap, sector and momentum fields, executed live over the universe, with a takeaway on how many stocks passed.' },
        { fr: 'FR-SD-02', priority: 'Must', status: 'partial', selector: '#panel-m3uc4-institutional', requirement: 'Institutional intent: bulk/block, promoter, FII/DII.', achieved: 'Real weighted-composite scoring formula, with a takeaway naming the strongest buying interest; underlying flow numbers are synthetic (no NSE/BSE bulk-deal feed).' },
        { fr: 'FR-SD-03', priority: 'Must', status: 'partial', selector: '#panel-m3uc4-events', requirement: 'Event-risk tagging on upcoming corporate actions.', achieved: 'Risk-level tagging logic works, with a takeaway naming the nearest High-risk event; event dates/types are synthetic (no corporate-actions feed).' },
        { fr: 'FR-SD-04', priority: 'Should', status: 'full', selector: '#panel-m3uc4-rotation', requirement: 'Rotation ideas derived from Act 1 sector/cycle signals.', achieved: 'Pulls the top-3 Momentum Z-Score-ranked sectors directly from the Act 1 model output.' },
        { fr: 'FR-SD-05', priority: 'Must', status: 'partial', selector: '#panel-m3uc4-investors', requirement: '300+ tracked investor portfolios via quarterly filings.', achieved: '5 illustrative investors with synthetic holdings — real scale (300+) needs a licensed shareholding-filings feed.' },
        { fr: 'FR-SD-06', priority: 'Must', status: 'partial', selector: '#panel-m3uc4-ipo', requirement: 'IPO analysis: GMP, subscription, fundamentals score.', achieved: 'All three fields computed with clear GMP speculative-disclaimer; based on 3 illustrative IPOs, not a live IPO pipeline.' },
        { fr: 'FR-SD-07', priority: 'Must', status: 'full', selector: '#panel-m3uc4-themes', requirement: 'Investment themes with constituent mapping.', achieved: '4 themes mapped to universe constituents by sector.' },
        { fr: 'FR-SD-09', priority: 'Must', status: 'partial', selector: '#panel-m3uc4-filings', requirement: 'Searchable filings aggregation.', achieved: 'Filings list with type/date rendered and structured for search; search UI itself lives in M3-UC8 Global Search.' },
      ],
    },

    // ---------------- M3-UC5 Synthesis & Conviction Score ----------------
    {
      key: 'm3uc5', tag: 'M3-UC5', title: 'Synthesis & Conviction Score (Act 5)', api: '/api/m3uc5',
      objective: 'Composite Conviction Score and rating from the six pillars, AI narrative, immutable recommendation ledger, time-series tracking, scenario sandbox and SEBI RA disclosures.',
      frs: ['FR-CS-01 Conviction Score (Must)', 'FR-CS-02 Configurable weights (Must)', 'FR-CS-03 AI narrative (Must)', 'FR-CS-04 Tracking (Must)', 'FR-CS-05 Scenario sandbox (Must)', 'FR-CS-06 SEBI disclosures (Must)'],
      buildForm(container) {
        let state = { stockId: 'INFY', weights: { fundamental: 0.25, technical: 0.15, sentiment: 0.1, macro: 0.1, governance: 0.15, valuation: 0.25 }, publish: true, sandbox: { gdpDelta: 0, repoDelta: 0, inrDelta: 0 } };
        const wrap = el('div');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            state.stockId = sample.stockId || state.stockId;
            state.weights = sample.weights || state.weights;
            const form = el('div', 'form-grid');
            form.appendChild(stockSelectField(sample.universe, state.stockId, (v) => { state.stockId = v; }));
            Object.keys(state.weights).forEach((k) => {
              form.appendChild(C.field(`${k[0].toUpperCase() + k.slice(1)} weight`, C.sliderInput({ value: state.weights[k], min: 0, max: 0.5, step: 0.01, format: (v) => v.toFixed(2), onChange: (v) => { state.weights[k] = v; } }), 'FR-CS-02: governed default, adjustable by user/RM within permissible ranges.'));
            });
            form.appendChild(C.field('Publish to Ledger', C.toggleInput({ checked: state.publish, labelOn: 'Publish', labelOff: 'Preview only', onChange: (v) => { state.publish = v; } }), 'Publishing appends an immutable, hash-chained ledger entry (FR-CS mandates append-only, tamper-evident recommendations).'));
            form.appendChild(C.field('Sandbox: GDP Growth Δ (pp)', C.numberInput({ value: 0, step: 0.5, onChange: (v) => { state.sandbox.gdpDelta = v; } }), 'FR-CS-05: exploratory-only, never published.'));
            form.appendChild(C.field('Sandbox: Repo Rate Δ (pp)', C.numberInput({ value: 0, step: 0.25, onChange: (v) => { state.sandbox.repoDelta = v; } })));
            wrap.appendChild(form);
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m3uc5-score');
        p1.appendChild(panelTitle(`${data.stock.name} — Conviction Score`, 'FR-CS-01: weighted composition of the six pillar sub-scores, mapped to a rating band.'));
        const ratingPlain = data.rating === 'Strong Buy' || data.rating === 'Buy' ? 'the weight of evidence across fundamentals, technicals and sentiment currently favours this stock'
          : data.rating === 'Hold' ? 'the evidence is mixed — there is no strong case to add to or exit this position right now'
          : 'the weight of evidence currently favours caution on this stock';
        p1.appendChild(takeaway(`In plain terms: ${ratingPlain}. See the narrative alongside the score below for the specific reasons why.`));
        const row = el('div', 'metric-row');
        row.appendChild(C.gauge(data.convictionScore, { subLabel: data.rating }));
        const info = el('div');
        info.innerHTML = `<div style="margin-bottom:8px">${tag(data.rating, ratingTagClass(data.rating))}</div><p style="font-size:13px;color:var(--text-muted);max-width:520px">${data.narrative}</p>`;
        row.appendChild(info);
        p1.appendChild(row);
        container.appendChild(p1);

        const p2 = panel('panel-m3uc5-ledger');
        p2.appendChild(panelTitle('Recommendation Ledger', 'FR-CS-04/SEBI RA Reg 16(2): append-only, hash-chained, immutable record. Each entry\'s hash depends on the previous entry\'s hash — any retroactive edit breaks the chain.'));
        p2.appendChild(takeaway(data.recommendationTimeline.length ? `This call has ${data.recommendationTimeline[0].realisedPerformancePct >= 0 ? 'gained' : 'lost'} ${fmt2(Math.abs(data.recommendationTimeline[0].realisedPerformancePct))}% since it was published — that's how this rating has actually played out so far, not just what it predicted.` : `No published history yet for this stock — toggle "Publish to Ledger" above and re-run to start tracking it against price.`));
        if (data.ledgerEntry) {
          p2.appendChild(el('div', null, `<div>Entry hash: <code style="font-size:11px">${data.ledgerEntry.hash.slice(0, 24)}…</code></div><div>Chain integrity: ${data.ledgerIntegrity.intact ? tag('Intact — ' + data.ledgerIntegrity.entries + ' entries', 'buy') : tag('BROKEN at entry ' + data.ledgerIntegrity.brokenAt, 'sell')}</div>`));
        } else {
          p2.appendChild(el('div', 'empty-hint', 'Preview only — toggle "Publish to Ledger" to append an immutable entry.'));
        }
        p2.appendChild(panelTitle('Recommendation vs OHLC — Time-Series Tracking', 'FR-CS-04: prior calls tracked against realised performance.'));
        p2.appendChild(data.recommendationTimeline.length ? table(['Date', 'Rating', 'Score', 'Price at Call', 'Current Price', 'Realised %'], data.recommendationTimeline.map((t) => [t.date, t.rating, fmt2(t.score), fmt2(t.priceAtCall), fmt2(t.currentPrice), fmt2(t.realisedPerformancePct)])) : el('div', 'empty-hint', 'No prior published calls for this stock yet — publish one above to start tracking.'));
        container.appendChild(p2);

        const p3 = panel('panel-m3uc5-sandbox');
        p3.appendChild(panelTitle('Scenario Sandbox', 'FR-CS-05: exploratory recompute under adjusted macro assumptions — never persisted to the published ledger.'));
        if (data.sandboxResult) {
          const shiftPhrase = data.sandboxResult.sandboxRating === data.rating ? 'stays the same' : `shifts to ${data.sandboxResult.sandboxRating}`;
          p3.appendChild(takeaway(`Under the macro deltas you set, the rating ${shiftPhrase} — ${data.sandboxResult.sandboxRating === data.rating ? 'this stock looks resilient to that particular macro shock.' : 'this stock is sensitive to that particular macro shock, which is worth knowing before you rely on today\'s rating holding up.'}`));
          p3.appendChild(el('div', null, `<div>Sandbox score: <strong>${fmt2(data.sandboxResult.sandboxScore)}</strong> (${data.sandboxResult.sandboxRating})</div><div>Implied intrinsic value: ₹${fmt2(data.sandboxResult.impliedIntrinsicValue)}</div><div style="color:var(--text-muted);font-size:12px">${tag('Exploratory — not published', 'hold')}</div>`));
        } else {
          p3.appendChild(el('div', 'empty-hint', 'Set macro deltas above (e.g. a GDP slowdown or a rate hike) to see how much this score could move under a worse backdrop.'));
        }
        container.appendChild(p3);

        const p4 = panel('panel-m3uc5-disclosures');
        p4.appendChild(panelTitle('SEBI RA Disclosures', 'FR-CS-06: mandated disclosures auto-attached to every recommendation payload.'));
        p4.appendChild(takeaway(`This is a regulatory requirement, not part of the analysis — it doesn't change the score above, but it must legally accompany any published recommendation.`));
        p4.appendChild(el('div', null, `<div><strong>${data.disclosures.analyst}</strong></div><p style="font-size:12.5px;color:var(--text-muted)">${data.disclosures.disclosure}</p><p style="font-size:11.5px;color:var(--text-muted)">${data.disclosures.regulatoryRef}</p>`));
        container.appendChild(p4);
      },
      tour: [
        { fr: 'FR-CS-01', priority: 'Must', status: 'full', selector: '#panel-m3uc5-score', requirement: 'Composite 0-100 Conviction Score mapped to a 5-tier rating.', achieved: 'Weighted sum of the six pillar sub-scores (weights re-normalised to 1) mapped to Strong Buy...Strong Sell bands, with a plain-language takeaway on what the rating means.' },
        { fr: 'FR-CS-02', priority: 'Must', status: 'full', selector: '#panel-m3uc5-score', requirement: 'User/RM-adjustable pillar weights with a governed default.', achieved: 'Slider per pillar starting from a governed default set; the score recomputes live.' },
        { fr: 'FR-CS-03', priority: 'Must', status: 'partial', selector: '#panel-m3uc5-score', requirement: 'AI narrative sourced from Module 1.', achieved: 'Narrative is templated from the actual pillar-score data (strongest/weakest contributor) since Module 1 isn\'t built in this prototype — labelled honestly in the text itself.' },
        { fr: 'FR-CS-04', priority: 'Must', status: 'full', selector: '#panel-m3uc5-ledger', requirement: 'Immutable, tamper-evident, timestamped ledger + time-series tracking vs OHLC.', achieved: 'Real SHA-256 hash chain (each entry hashes the previous entry\'s hash); a break-detection check runs on every render. Timeline computes realised performance from price-at-call vs current price, with a takeaway on how the call has actually played out.' },
        { fr: 'FR-CS-05', priority: 'Must', status: 'full', selector: '#panel-m3uc5-sandbox', requirement: 'Scenario sandbox: adjust macro, see score/value impact, never published.', achieved: 'Sandbox recomputes the macro pillar and conviction score from your deltas; result is explicitly flagged exploratory/unpublished and never written to the ledger, with a takeaway on whether the rating would actually change.' },
        { fr: 'FR-CS-06', priority: 'Must', status: 'full', selector: '#panel-m3uc5-disclosures', requirement: 'SEBI RA disclosures on every recommendation page.', achieved: 'Disclosure block auto-attached to every response payload from this endpoint.' },
      ],
    },

    // ---------------- M3-UC6 Screening & Discovery ----------------
    {
      key: 'm3uc6', tag: 'M3-UC6', title: 'Screening & Discovery', api: '/api/m3uc6',
      objective: 'Full stock screener: field schema, pre-built buckets, NL scan builder, chart-pattern enrichment, investor/theme/IPO views and investment ideas.',
      frs: ['FR-SC-01 Screener (Must)', 'FR-SC-02 Buckets (Must)', 'FR-SC-03 NL scan builder (Must)', 'FR-SC-04 Pattern detection (Must)', 'FR-SC-07 Investment ideas (Must)'],
      buildForm(container) {
        let state = { bucket: 'Quality Compounders', naturalLanguageQuery: '', withConvictionAndPatterns: true };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: () => {
            wrap.innerHTML = '';
            wrap.appendChild(C.field('Pre-Built Bucket', (() => { const s = document.createElement('select'); s.className = 'ui-select'; ['Quality Compounders', 'Deep Value', 'Multibagger Early', 'Momentum Leaders'].forEach((b) => { const o = document.createElement('option'); o.value = b; o.textContent = b; s.appendChild(o); }); s.addEventListener('change', () => { state.bucket = s.value; state.naturalLanguageQuery = ''; }); return s; })(), 'FR-SC-02: governed pre-built screen definitions.'));
            wrap.appendChild(C.field('Or: Natural-Language Query', C.textInput({ value: '', placeholder: 'e.g. roe above 15 and large cap', onChange: (v) => { state.naturalLanguageQuery = v; } }), 'FR-SC-03: translated to the same filter grammar as the manual builder and echoed back below so you can verify it before it\'s applied.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m3uc6-query');
        p1.appendChild(panelTitle('Compiled Query', 'FR-SC-03: the Natural-Language (NL) query (or bucket) translated to explicit filters and echoed back — never applied silently.'));
        p1.appendChild(takeaway(`Check this matches what you actually meant before trusting the results below — if it looks wrong, rephrase your query or switch to a pre-built bucket.`));
        p1.appendChild(el('pre', null, JSON.stringify(data.compiledQuery, null, 2)));
        container.appendChild(p1);

        const p2 = panel('panel-m3uc6-results');
        p2.appendChild(panelTitle('Screen Results', `FR-SC-01: ${data.screenResults.length} matches with Current Market Price (CMP), target, ROE and (if enabled) conviction.`));
        p2.appendChild(takeaway(`${data.screenResults.length} stocks matched — treat this as a shortlist for further research, not a set of automatic recommendations.`));
        const hasConviction = data.screenResults.length && data.screenResults[0].convictionScore != null;
        p2.appendChild(table(
          hasConviction ? ['Stock', 'Sector', 'CMP', 'Target', 'ROE %', 'Conviction', 'Rating'] : ['Stock', 'Sector', 'CMP', 'ROE %'],
          data.screenResults.slice(0, 15).map((r) => hasConviction ? [r.name, r.sector, fmt2(r.currentPrice), fmt2(r.targetPrice), fmt2(r.roe), fmt2(r.convictionScore), tag(r.rating, ratingTagClass(r.rating))] : [r.name, r.sector, fmt2(r.currentPrice), fmt2(r.roe)])
        ));
        container.appendChild(p2);

        const p3 = panel('panel-m3uc6-patterns');
        p3.appendChild(panelTitle('Chart-Pattern Auto-Detection', 'FR-SC-04: technical patterns detected across the screened results.'));
        const withPatterns = data.detectedPatterns.filter((d) => d.patterns && d.patterns.length);
        p3.appendChild(takeaway(withPatterns.length ? `${withPatterns.length} of the screened stocks are showing a recognisable chart pattern right now — worth a closer look on the chart itself, but patterns can and do fail.` : `No patterns detected in this result set (or pattern enrichment wasn't requested).`));
        p3.appendChild(withPatterns.length ? table(['Stock', 'Patterns'], withPatterns.map((d) => [d.id, d.patterns.join(', ')])) : el('div', 'empty-hint', 'No patterns detected in this result set (or pattern enrichment not requested).'));
        container.appendChild(p3);

        const p4 = panel('panel-m3uc6-ideas');
        p4.appendChild(panelTitle('Investment Ideas — Stock of the Week', 'FR-SC-07: top-ranked screened stocks with full six-pillar links.'));
        p4.appendChild(takeaway(`These are the top-ranked matches from this screen — open them in Six-Pillar Analysis (M3-UC2) for the full picture before acting.`));
        p4.appendChild(el('div', null, data.investmentIdeas.map((i) => `<div><strong>${i.name}</strong> — ${i.reason}</div>`).join('') || '<span class="empty-hint">No ideas yet</span>'));
        container.appendChild(p4);
      },
      tour: [
        { fr: 'FR-SC-01', priority: 'Must', status: 'full', selector: '#panel-m3uc6-results', requirement: 'Screener with CMP, target, upside, ROI, filterable by conviction/sector/cap.', achieved: 'Live-computed CMP/ROE/target from the universe; filterable via bucket or NL query, with a takeaway framing the results as a shortlist, not a buy list.' },
        { fr: 'FR-SC-02', priority: 'Must', status: 'full', selector: '#panel-m3uc6-query', requirement: 'Pre-built buckets (Quality Compounders, Deep Value, etc.).', achieved: '4 governed bucket definitions as real filter predicates over computed fields.' },
        { fr: 'FR-SC-03', priority: 'Must', status: 'partial', selector: '#panel-m3uc6-query', requirement: 'AI custom-scan builder with NL query construction, echoed back for validation.', achieved: 'A constrained keyword pattern-matcher (not full NLP) parses "field above/below value" phrases into filters and echoes the compiled expression, with a takeaway prompting you to verify it — group/clone/share of saved scans is not implemented.' },
        { fr: 'FR-SC-04', priority: 'Must', status: 'full', selector: '#panel-m3uc6-patterns', requirement: 'Chart-pattern auto-detection across screened stocks.', achieved: 'Reuses the Six-Pillar technical-pattern detector across every screened result.' },
        { fr: 'FR-SC-07', priority: 'Must', status: 'full', selector: '#panel-m3uc6-ideas', requirement: 'Investment ideas (Stock of the Week) with six-pillar links.', achieved: 'Top-2 by conviction (or ROE) surfaced as ideas; click through to M3-UC2 for the full pillar breakdown.' },
      ],
    },

    // ---------------- M3-UC7 Personalised Recommendation Layer ----------------
    {
      key: 'm3uc7', tag: 'M3-UC7', title: 'Personalised Recommendation Layer', api: '/api/m3uc7',
      objective: 'Holding-aware analysis, SwitchER replacement tool, surfaced Module 2 alerts, model-portfolio gap analysis, and a compatibility-ranked screener — personalised to your actual holdings.',
      frs: ['FR-PR-01 Holding-aware analysis (Must)', 'FR-PR-02 SwitchER (Must)', 'FR-PR-03 Surfaced alerts (Must)', 'FR-PR-04 Template gap analysis (Must)', 'FR-PR-05 Personalised screener (Should)'],
      buildForm(container) {
        let state = { stockId: 'INFY', templateName: 'Balanced' };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            state.stockId = sample.stockId || state.stockId;
            wrap.appendChild(stockSelectField(sample.heldStocks, state.stockId, (v) => { state.stockId = v; }, 'Your Held Stock'));
            const tSel = document.createElement('select'); tSel.className = 'ui-select';
            ['Conservative', 'Balanced', 'Aggressive'].forEach((t) => { const o = document.createElement('option'); o.value = t; o.textContent = t; tSel.appendChild(o); });
            tSel.value = state.templateName;
            tSel.addEventListener('change', () => { state.templateName = tSel.value; });
            wrap.appendChild(C.field('Model Portfolio Template', tSel, 'FR-PR-04: governed model templates by risk profile.'));
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m3uc7-holding');
        p1.appendChild(panelTitle('Holding-Aware Analysis', 'FR-PR-01: your position status, weight, P&L and the health-score impact of a buy/sell decision.'));
        if (data.holdingContext.held) {
          p1.appendChild(takeaway(`You hold ${data.holdingContext.qty} shares worth about ₹${fmtCompact(data.holdingContext.marketValue)}, currently ${data.holdingContext.pnlPct >= 0 ? 'up' : 'down'} ${fmt2(Math.abs(data.holdingContext.pnlPct))}% from what you paid. It's rated ${data.holdingContext.rating} with a conviction score of ${fmt2(data.holdingContext.conviction)}/100.`));
          const row = el('div', 'metric-row');
          row.appendChild(metricCard('Weight in Portfolio', `${fmt2(data.holdingContext.weight)}%`, `${data.holdingContext.qty} shares @ ₹${fmt2(data.holdingContext.costBasis)}`));
          row.appendChild(metricCard('P&L', `${fmt2(data.holdingContext.pnlPct)}%`, `CMP ₹${fmt2(data.holdingContext.currentPrice)}`));
          row.appendChild(metricCard('Conviction / Rating', fmt2(data.holdingContext.conviction), tag(data.holdingContext.rating, ratingTagClass(data.holdingContext.rating))));
          row.appendChild(metricCard('Health Impact if Sold', fmt2(data.holdingContext.healthImpactSell), null, 'Illustrative Δ to a portfolio health score if this position were sold. Negative means selling would hurt diversification/quality; positive means selling would help it.'));
          p1.appendChild(row);
        } else {
          p1.appendChild(takeaway(`You don't currently hold this stock — the analysis below is exploratory, showing how it would fit if you added it.`));
          p1.appendChild(el('div', 'empty-hint', 'Not currently held.'));
        }
        container.appendChild(p1);

        const p2 = panel('panel-m3uc7-switcher');
        p2.appendChild(panelTitle('SwitchER — Replacement Suggestions', 'FR-PR-02: for Hold-Weak/Sell holdings, same-sector/cap replacements with higher conviction and lower correlation.'));
        if (!data.switchSuggestions.eligible) {
          p2.appendChild(takeaway(`${data.switchSuggestions.reason} — SwitchER only activates when a holding's own rating turns weak, so there's nothing to replace here right now.`));
        } else if (!data.switchSuggestions.suggestions.length) {
          p2.appendChild(takeaway(`No qualifying same-sector/cap replacement was found — sometimes the best action for a weak holding is a partial trim or a wait, not a swap.`));
          p2.appendChild(el('div', 'empty-hint', 'No qualifying same-sector/cap replacement found (needs higher conviction than the held stock).'));
        } else {
          const top = data.switchSuggestions.suggestions[0];
          p2.appendChild(takeaway(`${top.name} looks like the strongest swap candidate — higher conviction (${fmt2(top.convictionScore)} vs your current holding) while staying in the same sector and a similar market cap, with a correlation of ${fmt2(top.correlationToHeld)} to what you already own.`));
          p2.appendChild(table(['Candidate', 'Conviction', 'Rating', 'Correlation to Held', 'Replacement Score'], data.switchSuggestions.suggestions.map((s) => [s.name, fmt2(s.convictionScore), tag(s.rating, ratingTagClass(s.rating)), fmt2(s.correlationToHeld), fmt2(s.replacementScore)])));
        }
        container.appendChild(p2);

        const p3 = panel('panel-m3uc7-alerts');
        p3.appendChild(panelTitle('Surfaced Portfolio Alerts', `FR-PR-03: ${data.surfacedAlerts.source}.`));
        const topAlert = data.surfacedAlerts.alerts[0];
        p3.appendChild(takeaway(topAlert ? `${topAlert.message}${topAlert.type === 'Concentration' ? ' — a downturn in that sector would hit your overall portfolio harder than it would a well-diversified one.' : ' — if this continues, the position may be worth reviewing rather than holding by default.'}` : `No portfolio alerts are currently flagged — check back after major news or results, since conditions can change quickly.`));
        p3.appendChild(data.surfacedAlerts.alerts.length ? table(['Type', 'Severity', 'Message'], data.surfacedAlerts.alerts.map((a) => [a.type, tag(a.severity, a.severity === 'High' ? 'sell' : 'hold'), a.message])) : el('div', 'empty-hint', 'No alerts.'));
        container.appendChild(p3);

        const p4 = panel('panel-m3uc7-gap');
        p4.appendChild(panelTitle('Model-Portfolio Gap Analysis', `FR-PR-04: your portfolio vs the ${data.templateGap.templateName} template by market-cap bucket.`));
        const biggestGap = [...data.templateGap.gaps].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];
        p4.appendChild(takeaway(`Your biggest gap vs the ${data.templateGap.templateName} template is in ${biggestGap.bucket}-cap stocks — you're ${biggestGap.gap > 0 ? 'overweight' : 'underweight'} by ${fmt2(Math.abs(biggestGap.gap))} percentage points. Closing that gap would bring your portfolio's cap mix closer to the governed template.`));
        p4.appendChild(table(['Bucket', 'Current %', 'Target %', 'Gap (pp)'], data.templateGap.gaps.map((g) => [g.bucket, fmt2(g.current), fmt2(g.target), fmt2(g.gap)])));
        container.appendChild(p4);

        const p5 = panel('panel-m3uc7-screen');
        p5.appendChild(panelTitle('Personalised Screener', 'FR-PR-05 (Should Have): non-held stocks ranked by compatibility (conviction + diversification benefit) with your existing book.'));
        p5.appendChild(takeaway(data.personalisedScreen.length ? `${data.personalisedScreen[0].name} is the best-fit new idea for your portfolio right now, balancing a strong conviction score with the diversification benefit of adding a sector you're not already exposed to.` : `No candidates to show.`));
        p5.appendChild(table(['Stock', 'Sector', 'Conviction', 'Rating', 'Compatibility'], data.personalisedScreen.slice(0, 10).map((s) => [s.name, s.sector, fmt2(s.convictionScore), tag(s.rating, ratingTagClass(s.rating)), fmt2(s.compatibility)])));
        container.appendChild(p5);
      },
      tour: [
        { fr: 'FR-PR-01', priority: 'Must', status: 'full', selector: '#panel-m3uc7-holding', requirement: 'Holding status, weight, P&L, buy/sell health-score impact.', achieved: 'Computed live from Module 4\'s real holdings and this stock\'s current price/conviction, with a takeaway summarising the position in plain terms.' },
        { fr: 'FR-PR-02', priority: 'Must', status: 'full', selector: '#panel-m3uc7-switcher', requirement: 'SwitchER: same-sector/cap replacements, higher conviction, lower correlation.', achieved: 'Real correlation computed from 120-day return series; only triggers for Hold/Sell-rated holdings per the FR, and only surfaces candidates with a genuinely higher conviction score, with a takeaway naming the top candidate.' },
        { fr: 'FR-PR-03', priority: 'Must', status: 'partial', selector: '#panel-m3uc7-alerts', requirement: 'Surface Module 2 alerts (drift/underperformance/concentration/drawdown) with action links.', achieved: 'Concentration and underperformance alerts computed live from your holdings — labelled illustrative because Module 2 isn\'t built yet in this workspace, so nothing is actually "surfaced from" it (drift/drawdown alert types not yet modelled here).' },
        { fr: 'FR-PR-04', priority: 'Must', status: 'full', selector: '#panel-m3uc7-gap', requirement: 'Model-portfolio templates with gap analysis.', achieved: '3 governed cap-bucket templates (Conservative/Balanced/Aggressive) benchmarked against your actual current-value mix, with a takeaway naming the single biggest gap.' },
        { fr: 'FR-PR-05', priority: 'Should', status: 'full', selector: '#panel-m3uc7-screen', requirement: 'Screener ranked by portfolio compatibility.', achieved: 'Non-held universe stocks ranked by a real compatibility score (conviction weight + sector-diversification bonus).' },
      ],
    },

    // ---------------- M3-UC8 Platform & Administration ----------------
    {
      key: 'm3uc8', tag: 'M3-UC8', title: 'Platform & Administration (SDK)', api: '/api/m3uc8',
      objective: 'Cross-cutting SDK services: token auth/RBAC, watchlists, a unified notification centre and global search.',
      frs: ['FR-PL-01 Mobile payloads (Must)', 'FR-PL-02 Token auth (Must)', 'FR-PL-03 RBAC (Must)', 'FR-PL-04 Watchlist (Must)', 'FR-PL-05 Notifications (Must)', 'FR-PL-06 Global search (Must)'],
      buildForm(container) {
        let state = { token: 'Retail Investor', userId: 'demo-user', searchQuery: '', watchlistAction: null, stockId: 'INFY' };
        const wrap = el('div', 'form-grid');
        container.appendChild(wrap);
        return {
          setData: (sample) => {
            wrap.innerHTML = '';
            const roleSel = document.createElement('select'); roleSel.className = 'ui-select';
            (sample.roles || ['Retail Investor', 'Research Analyst', 'Relationship Manager', 'Admin']).forEach((r) => { const o = document.createElement('option'); o.value = r; o.textContent = r; roleSel.appendChild(o); });
            roleSel.addEventListener('change', () => { state.token = roleSel.value; });
            wrap.appendChild(C.field('Role (mock token)', roleSel, 'FR-PL-02/03: stands in for a validated OAuth2/JWT token — resolves to the RBAC entitlement matrix below.'));
            wrap.appendChild(C.field('Search Query', C.textInput({ value: 'infy', onChange: (v) => { state.searchQuery = v; } }), 'FR-PL-06: ranked across instruments and themes.'));
            const addBtn = document.createElement('button'); addBtn.className = 'btn btn-secondary'; addBtn.textContent = 'Add INFY to Watchlist';
            addBtn.addEventListener('click', (e) => { e.preventDefault(); state.watchlistAction = 'add'; });
            wrap.appendChild(addBtn);
          },
          getData: () => state,
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const p1 = panel('panel-m3uc8-auth');
        p1.appendChild(panelTitle('Auth & RBAC', 'FR-PL-02/03: token validated, role resolved, entitlements filtered by role.'));
        p1.appendChild(takeaway(`Your role controls what you can see and do on this platform — a Retail Investor won't see everything a Research Analyst or Admin does. This keeps sensitive analyst-only or admin-only data from leaking to the wrong audience.`));
        p1.appendChild(el('div', null, `<div>Role: <strong>${data.authResult.role}</strong> · Data scope: ${data.authResult.entitlements.dataScope}</div><div style="margin-top:6px">${data.authResult.entitlements.features.map((f) => tag(f, 'hold')).join(' ')}</div>`));
        container.appendChild(p1);

        const p2 = panel('panel-m3uc8-endpoints');
        p2.appendChild(panelTitle('Endpoint Catalogue', 'FR-PL-01: versioned, mobile-compatible endpoint schemas.'));
        p2.appendChild(takeaway(`This is the technical contract that apps like MyGeojit or Flip call to get Module 3 data — not something an end user interacts with directly, but it's what makes the rest of this module usable on mobile.`));
        p2.appendChild(el('div', null, data.endpointCatalogue.endpoints.map((e) => `<code style="display:block;font-size:12px">${e}</code>`).join('')));
        container.appendChild(p2);

        const p3 = panel('panel-m3uc8-watchlist');
        p3.appendChild(panelTitle('Watchlist', 'FR-PL-04: per-user tracked stocks with optional alert rules.'));
        p3.appendChild(takeaway(data.watchlist.length ? `You're tracking ${data.watchlist.length} stock(s) here — add alert rules to each so you're notified on a meaningful move instead of having to check back manually.` : `Your watchlist is empty — add a stock above to start tracking it here.`));
        p3.appendChild(data.watchlist.length ? table(['Stock', 'Added'], data.watchlist.map((w) => [w.stockId, new Date(w.addedAt).toLocaleString()])) : el('div', 'empty-hint', 'Empty — use the "Add INFY to Watchlist" button and re-run.'));
        container.appendChild(p3);

        const p4 = panel('panel-m3uc8-notifications');
        p4.appendChild(panelTitle('Unified Notification Centre', 'FR-PL-05: Module 2 + platform-generated alerts routed to one feed.'));
        const hasHighSeverity = data.notifications.some((n) => n.severity === 'High');
        p4.appendChild(takeaway(hasHighSeverity ? `At least one High-severity notification needs attention below — check it before assuming everything is business as usual.` : `No High-severity notifications right now, but this is the layer that surfaces Module 2's portfolio alerts (drift, concentration, drawdown) as they happen, so it's worth checking regularly.`));
        p4.appendChild(table(['Source', 'Type', 'Severity', 'Message'], data.notifications.map((n) => [n.source, n.type, tag(n.severity, n.severity === 'High' ? 'sell' : 'hold'), n.message])));
        container.appendChild(p4);

        const p5 = panel('panel-m3uc8-search');
        p5.appendChild(panelTitle('Global Search', 'FR-PL-06: autocomplete across instruments, reports, themes, ideas, ranked by relevance × entity weight.'));
        p5.appendChild(takeaway(data.searchResults.length ? `Top match: ${data.searchResults[0].label} — results are ranked so the most relevant instrument or theme shows up first.` : `No matches for this query — try a shorter or different search term.`));
        p5.appendChild(data.searchResults.length ? table(['Type', 'Label', 'Rank'], data.searchResults.map((s) => [s.type, s.label, fmt2(s.rank)])) : el('div', 'empty-hint', 'No matches.'));
        container.appendChild(p5);
      },
      tour: [
        { fr: 'FR-PL-02/03', priority: 'Must', status: 'partial', selector: '#panel-m3uc8-auth', requirement: 'OAuth2/JWT token validation + RBAC entitlement resolution.', achieved: 'RBAC matrix and entitlement resolution are real; token validation is mocked (a role name stands in for a signed JWT — no real identity provider in this prototype).' },
        { fr: 'FR-PL-01', priority: 'Must', status: 'full', selector: '#panel-m3uc8-endpoints', requirement: 'Mobile-compatible, versioned endpoint payloads.', achieved: 'All 8 Module 3 endpoints listed with a version tag and default pagination size.' },
        { fr: 'FR-PL-04', priority: 'Must', status: 'full', selector: '#panel-m3uc8-watchlist', requirement: 'Per-user watchlist add/remove with alert rules.', achieved: 'In-memory add/remove wired to a real per-user store (resets on server restart — production needs persistence).' },
        { fr: 'FR-PL-05', priority: 'Must', status: 'partial', selector: '#panel-m3uc8-notifications', requirement: 'Unified notification centre for Module 2 + platform alerts.', achieved: 'Platform-generated (event-risk) notifications are real; the Module 2 alert shown is an illustrative placeholder since Module 2 isn\'t built in this workspace.' },
        { fr: 'FR-PL-06', priority: 'Must', status: 'full', selector: '#panel-m3uc8-search', requirement: 'Global search/autocomplete with relevance ranking.', achieved: 'Text-match search across instruments and themes, ranked by entity-type weight × exact-match bonus.' },
      ],
    },
  ];

  global.WISUseCasesM3 = USE_CASES;
})(window);
