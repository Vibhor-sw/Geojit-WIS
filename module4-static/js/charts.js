// Minimal dependency-free SVG chart helpers used across the Module 4 use-case views.
// All charts are interactive: hovering shows a floating tooltip with the exact values at that point.
(function (global) {
  const NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    return el;
  }

  function fmtCompact(n) {
    if (n == null || isNaN(n)) return '-';
    const abs = Math.abs(n);
    if (abs >= 1e7) return (n / 1e7).toFixed(2) + 'Cr';
    if (abs >= 1e5) return (n / 1e5).toFixed(2) + 'L';
    if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return Math.round(n).toString();
  }

  function fmtPct(n, digits) {
    if (n == null || isNaN(n)) return '-';
    return (n * 100).toFixed(digits != null ? digits : 1) + '%';
  }

  // ---- Shared floating HTML tooltip, positioned relative to a chart's wrapper container ----
  function ensureTooltip(container) {
    let tip = container.querySelector(':scope > .chart-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tooltip';
      container.style.position = 'relative';
      container.appendChild(tip);
    }
    return tip;
  }
  function showTooltip(container, x, y, html) {
    const tip = ensureTooltip(container);
    tip.innerHTML = html;
    tip.style.display = 'block';
    const tipW = tip.offsetWidth || 160;
    let left = x + 14;
    if (left + tipW > container.clientWidth) left = x - tipW - 14;
    tip.style.left = Math.max(4, left) + 'px';
    tip.style.top = Math.max(0, y - 10) + 'px';
  }
  function hideTooltip(container) {
    const tip = container.querySelector(':scope > .chart-tooltip');
    if (tip) tip.style.display = 'none';
  }

  // Horizontal bar chart. data: [{label, value, color?}]
  function barChart(container, data, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!data || !data.length) { container.innerHTML = '<div class="empty-hint">No data</div>'; return; }
    const width = opts.width || Math.max(560, container.clientWidth || 560);
    const rowH = opts.rowHeight || 26;
    const labelW = opts.labelWidth || 140;
    const height = data.length * rowH + 20;
    const maxVal = opts.max != null ? opts.max : Math.max(...data.map((d) => Math.abs(d.value)), 0.0001);
    const chartW = width - labelW - 70;

    const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}` });
    data.forEach((d, i) => {
      const y = i * rowH + 10;
      const barW = Math.max(1, (Math.abs(d.value) / maxVal) * chartW);
      svg.appendChild(svgEl('text', { x: 0, y: y + rowH / 2 + 4, 'font-size': 11.5, fill: '#3a4653' })).textContent = d.label;
      const rect = svgEl('rect', {
        x: labelW, y: y + 3, width: barW, height: rowH - 10, rx: 3,
        fill: d.color || opts.color || '#0b1f3a', style: 'cursor:pointer',
      });
      const formatted = opts.valueFormatter ? opts.valueFormatter(d.value) : d.value;
      rect.addEventListener('mousemove', (e) => {
        const r = container.getBoundingClientRect();
        showTooltip(container, e.clientX - r.left, e.clientY - r.top, `<strong>${d.label}</strong><br/>${formatted}${opts.tooltipSuffix || ''}`);
      });
      rect.addEventListener('mouseleave', () => hideTooltip(container));
      svg.appendChild(rect);
      const valText = svgEl('text', {
        x: labelW + barW + 6, y: y + rowH / 2 + 4, 'font-size': 11, fill: '#5b6b7c',
      });
      valText.textContent = formatted;
      svg.appendChild(valText);
    });
    container.appendChild(svg);
  }

  // Percentile band chart. series: {p5:[], p25:[], p50:[], p75:[], p95:[]} equal length arrays across x = 0..n
  // Hover anywhere in the plot area to see the exact percentile values at that x via crosshair + tooltip.
  function bandChart(container, series, opts) {
    opts = opts || {};
    container.innerHTML = '';
    const n = series.p50.length;
    if (!n) { container.innerHTML = '<div class="empty-hint">No data</div>'; return; }
    const width = opts.width || Math.max(560, container.clientWidth || 560);
    const height = opts.height || 240;
    const padL = 56, padB = 24, padT = 10, padR = 10;
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    const allVals = [...series.p5, ...series.p95];
    const minV = Math.min(...allVals, 0);
    const maxV = Math.max(...allVals);
    const x = (i) => padL + (i / (n - 1)) * chartW;
    const y = (v) => padT + chartH - ((v - minV) / (maxV - minV || 1)) * chartH;

    const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}` });

    // gridlines + y labels
    const gridSteps = 4;
    for (let g = 0; g <= gridSteps; g++) {
      const val = minV + ((maxV - minV) * g) / gridSteps;
      const yy = y(val);
      svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: yy, y2: yy, stroke: '#eef1f5', 'stroke-width': 1 }));
      const t = svgEl('text', { x: 4, y: yy + 4, 'font-size': 10, fill: '#8b98a5' });
      t.textContent = fmtCompact(val);
      svg.appendChild(t);
    }

    function pathFor(arr) {
      return arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    }
    function areaFor(top, bottom) {
      const topPath = top.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
      const bottomPath = bottom.slice().reverse().map((v, i) => `L ${x(n - 1 - i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
      return `${topPath} ${bottomPath} Z`;
    }

    svg.appendChild(svgEl('path', { d: areaFor(series.p95, series.p5), fill: '#0b1f3a', opacity: 0.08 }));
    svg.appendChild(svgEl('path', { d: areaFor(series.p75, series.p25), fill: '#0b1f3a', opacity: 0.18 }));
    svg.appendChild(svgEl('path', { d: pathFor(series.p50), fill: 'none', stroke: '#d4a017', 'stroke-width': 2.4 }));

    // x-axis labels (start / mid / end)
    [0, Math.floor((n - 1) / 2), n - 1].forEach((i) => {
      const t = svgEl('text', { x: x(i), y: height - 4, 'font-size': 10, fill: '#8b98a5', 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' });
      t.textContent = opts.xLabel ? opts.xLabel(i) : `Yr ${i}`;
      svg.appendChild(t);
    });

    // Interactive crosshair + hover dot, driven by an invisible overlay capturing mouse position.
    const crosshair = svgEl('line', { x1: padL, x2: padL, y1: padT, y2: padT + chartH, stroke: '#8b98a5', 'stroke-width': 1, 'stroke-dasharray': '3,3', opacity: 0, 'pointer-events': 'none' });
    const hoverDot = svgEl('circle', { r: 4, fill: '#d4a017', stroke: '#fff', 'stroke-width': 1.5, opacity: 0, 'pointer-events': 'none' });
    svg.appendChild(crosshair);
    svg.appendChild(hoverDot);

    const overlay = svgEl('rect', { x: padL, y: padT, width: chartW, height: chartH, fill: 'transparent', style: 'cursor:crosshair' });
    overlay.addEventListener('mousemove', (e) => {
      const svgRect = svg.getBoundingClientRect();
      const scaleX = width / svgRect.width;
      const mouseX = (e.clientX - svgRect.left) * scaleX;
      let idx = Math.round(((mouseX - padL) / chartW) * (n - 1));
      idx = Math.max(0, Math.min(n - 1, idx));
      const xx = x(idx), yy = y(series.p50[idx]);
      crosshair.setAttribute('x1', xx); crosshair.setAttribute('x2', xx); crosshair.setAttribute('opacity', 1);
      hoverDot.setAttribute('cx', xx); hoverDot.setAttribute('cy', yy); hoverDot.setAttribute('opacity', 1);
      const label = opts.xLabel ? opts.xLabel(idx) : `Yr ${idx}`;
      const contRect = container.getBoundingClientRect();
      showTooltip(container, e.clientX - contRect.left, e.clientY - contRect.top, `
        <strong>${label}</strong>
        <table class="chart-tooltip-table">
          <tr><td>95th pct</td><td>${fmtCompact(series.p95[idx])}</td></tr>
          <tr><td>75th pct</td><td>${fmtCompact(series.p75[idx])}</td></tr>
          <tr class="hl"><td>Median</td><td>${fmtCompact(series.p50[idx])}</td></tr>
          <tr><td>25th pct</td><td>${fmtCompact(series.p25[idx])}</td></tr>
          <tr><td>5th pct</td><td>${fmtCompact(series.p5[idx])}</td></tr>
        </table>`);
    });
    overlay.addEventListener('mouseleave', () => {
      crosshair.setAttribute('opacity', 0);
      hoverDot.setAttribute('opacity', 0);
      hideTooltip(container);
    });
    svg.appendChild(overlay);

    container.appendChild(svg);
  }

  // Simple scatter/line chart for an efficient frontier + a highlighted current-portfolio point.
  // Hover any point (frontier, current, or optimal) to see its exact return/risk values.
  function frontierChart(container, frontier, currentPoint, optimalPoint, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!frontier || !frontier.length) { container.innerHTML = '<div class="empty-hint">No data</div>'; return; }
    const width = opts.width || Math.max(520, container.clientWidth || 520);
    const height = opts.height || 260;
    const padL = 50, padB = 30, padT = 14, padR = 16;
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    const risks = frontier.map((f) => f.risk).concat(currentPoint ? [currentPoint.risk] : []).concat(optimalPoint ? [optimalPoint.risk] : []);
    const rets = frontier.map((f) => f.return).concat(currentPoint ? [currentPoint.return] : []).concat(optimalPoint ? [optimalPoint.return] : []);
    const minX = Math.min(...risks) * 0.9, maxX = Math.max(...risks) * 1.05;
    const minY = Math.min(...rets) * 0.9, maxY = Math.max(...rets) * 1.05;
    const x = (v) => padL + ((v - minX) / (maxX - minX || 1)) * chartW;
    const y = (v) => padT + chartH - ((v - minY) / (maxY - minY || 1)) * chartH;

    const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}` });
    svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: height - padB, y2: height - padB, stroke: '#d7dde3' }));
    svg.appendChild(svgEl('line', { x1: padL, x2: padL, y1: padT, y2: height - padB, stroke: '#d7dde3' }));
    svg.appendChild(svgEl('text', { x: width / 2, y: height - 4, 'font-size': 10.5, fill: '#5b6b7c', 'text-anchor': 'middle' })).textContent = 'Risk (volatility)';
    const yLabel = svgEl('text', { x: 12, y: padT + 6, 'font-size': 10.5, fill: '#5b6b7c' });
    yLabel.textContent = 'Return ↑';
    svg.appendChild(yLabel);

    function attachHover(el, ret, risk, labelText) {
      el.style.cursor = 'pointer';
      el.addEventListener('mousemove', (e) => {
        const r = container.getBoundingClientRect();
        showTooltip(container, e.clientX - r.left, e.clientY - r.top, `<strong>${labelText}</strong><br/>Return: ${fmtPct(ret)}<br/>Risk: ${fmtPct(risk)}`);
      });
      el.addEventListener('mouseleave', () => hideTooltip(container));
    }

    const path = frontier.map((f, i) => `${i === 0 ? 'M' : 'L'} ${x(f.risk).toFixed(1)} ${y(f.return).toFixed(1)}`).join(' ');
    svg.appendChild(svgEl('path', { d: path, fill: 'none', stroke: '#0b1f3a', 'stroke-width': 2 }));
    frontier.forEach((f) => {
      const c = svgEl('circle', { cx: x(f.risk), cy: y(f.return), r: 5, fill: '#0b1f3a', 'fill-opacity': 0.001, stroke: '#0b1f3a', 'stroke-width': 0 });
      // a larger invisible hit-area circle plus a small visible dot, so hovering near the point is forgiving
      svg.appendChild(svgEl('circle', { cx: x(f.risk), cy: y(f.return), r: 2.5, fill: '#0b1f3a', 'pointer-events': 'none' }));
      attachHover(c, f.return, f.risk, 'Frontier point');
      svg.appendChild(c);
    });

    if (currentPoint) {
      const c = svgEl('circle', { cx: x(currentPoint.risk), cy: y(currentPoint.return), r: 6, fill: '#c0392b' });
      attachHover(c, currentPoint.return, currentPoint.risk, 'Current Portfolio');
      svg.appendChild(c);
      const t = svgEl('text', { x: x(currentPoint.risk) + 8, y: y(currentPoint.return) - 6, 'font-size': 10.5, fill: '#c0392b', 'font-weight': 700 });
      t.textContent = 'Current';
      svg.appendChild(t);
    }
    if (optimalPoint) {
      const c = svgEl('circle', { cx: x(optimalPoint.risk), cy: y(optimalPoint.return), r: 6, fill: '#d4a017' });
      attachHover(c, optimalPoint.return, optimalPoint.risk, 'Optimal Portfolio');
      svg.appendChild(c);
      const t = svgEl('text', { x: x(optimalPoint.risk) + 8, y: y(optimalPoint.return) - 6, 'font-size': 10.5, fill: '#a67c00', 'font-weight': 700 });
      t.textContent = 'Optimal';
      svg.appendChild(t);
    }

    container.appendChild(svg);
  }

  global.WISCharts = { barChart, bandChart, frontierChart, fmtCompact, fmtPct, showTooltip, hideTooltip };
})(window);
