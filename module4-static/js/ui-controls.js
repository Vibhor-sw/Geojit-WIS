// Reusable end-user input controls (replacing raw JSON editing) + a generic modal/popup helper
// used for the "drift detected" nudge and other confirmations.
(function (global) {
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

  // Wraps any control with a label (+ optional info tooltip) in the standard form-field layout.
  function field(labelText, controlEl, infoText, extraCls) {
    const wrap = el('div', 'form-field' + (extraCls ? ' ' + extraCls : ''));
    const labelRow = el('div', 'form-field-label');
    labelRow.appendChild(el('span', null, labelText));
    if (infoText) labelRow.appendChild(infoIcon(infoText));
    wrap.appendChild(labelRow);
    wrap.appendChild(controlEl);
    return wrap;
  }

  function numberInput({ id, value, min, max, step, prefix, suffix, onChange }) {
    const wrap = el('div', 'input-affix-wrap');
    if (prefix) wrap.appendChild(el('span', 'input-affix', prefix));
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'ui-input';
    if (id) input.id = id;
    if (value != null) input.value = value;
    if (min != null) input.min = min;
    if (max != null) input.max = max;
    if (step != null) input.step = step;
    input.addEventListener('input', () => onChange && onChange(input.value === '' ? null : Number(input.value)));
    wrap.appendChild(input);
    if (suffix) wrap.appendChild(el('span', 'input-affix', suffix));
    wrap.getValue = () => (input.value === '' ? null : Number(input.value));
    wrap.setValue = (v) => { input.value = v; };
    wrap.inputEl = input;
    return wrap;
  }

  function textInput({ id, value, placeholder, onChange }) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ui-input';
    if (id) input.id = id;
    if (value != null) input.value = value;
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener('input', () => onChange && onChange(input.value));
    input.getValue = () => input.value;
    return input;
  }

  function selectInput({ id, value, options, onChange }) {
    const select = document.createElement('select');
    select.className = 'ui-select';
    if (id) select.id = id;
    options.forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      if (o.value === value) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => onChange && onChange(select.value));
    select.getValue = () => select.value;
    return select;
  }

  function sliderInput({ id, value, min, max, step, format, onChange }) {
    const wrap = el('div', 'slider-wrap');
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'ui-slider';
    if (id) input.id = id;
    input.min = min; input.max = max; input.step = step != null ? step : 1;
    input.value = value;
    const valueLabel = el('span', 'slider-value');
    const fmt = format || ((v) => v);
    valueLabel.textContent = fmt(Number(value));
    input.addEventListener('input', () => {
      const v = Number(input.value);
      valueLabel.textContent = fmt(v);
      onChange && onChange(v);
    });
    wrap.appendChild(input);
    wrap.appendChild(valueLabel);
    wrap.getValue = () => Number(input.value);
    wrap.setValue = (v) => { input.value = v; valueLabel.textContent = fmt(Number(v)); };
    return wrap;
  }

  function toggleInput({ id, checked, labelOn, labelOff, onChange }) {
    const wrap = el('label', 'toggle-wrap');
    const input = document.createElement('input');
    input.type = 'checkbox';
    if (id) input.id = id;
    input.checked = !!checked;
    const track = el('span', 'toggle-track');
    const text = el('span', 'toggle-text', checked ? (labelOn || 'On') : (labelOff || 'Off'));
    input.addEventListener('change', () => {
      text.textContent = input.checked ? (labelOn || 'On') : (labelOff || 'Off');
      onChange && onChange(input.checked);
    });
    wrap.appendChild(input);
    wrap.appendChild(track);
    wrap.appendChild(text);
    wrap.getValue = () => input.checked;
    return wrap;
  }

  // A 0-100 radial score gauge (used for goal-attainment score, health score, etc.)
  function gauge(value, opts) {
    opts = opts || {};
    const size = opts.size || 120;
    const stroke = opts.stroke || 12;
    const r = (size - stroke) / 2;
    const c = size / 2;
    const circumference = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, value)) / 100;
    const color = pct >= 0.8 ? '#2e7d5b' : pct >= 0.5 ? '#d4a017' : '#c0392b';
    const wrap = el('div', 'gauge-wrap');
    wrap.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#eef1f5" stroke-width="${stroke}" />
        <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - pct)}"
          stroke-linecap="round" transform="rotate(-90 ${c} ${c})" />
        <text x="${c}" y="${c - 2}" text-anchor="middle" font-size="${size * 0.24}" font-weight="700" fill="${color}">${Math.round(value)}</text>
        <text x="${c}" y="${c + size * 0.16}" text-anchor="middle" font-size="${size * 0.09}" fill="#8b98a5">${opts.subLabel || 'out of 100'}</text>
      </svg>`;
    return wrap;
  }

  // ---- Generic modal / popup (used for the drift "nudge" and confirmations) ----
  function ensureModalHost() {
    let host = document.getElementById('ui-modal-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ui-modal-host';
      host.className = 'ui-modal-overlay';
      document.body.appendChild(host);
      host.addEventListener('click', (e) => { if (e.target === host) closeModal(); });
    }
    return host;
  }

  function closeModal() {
    const host = document.getElementById('ui-modal-host');
    if (host) host.classList.remove('active');
  }

  function showModal({ icon, title, bodyHtml, bodyEl, actions }) {
    const host = ensureModalHost();
    host.innerHTML = '';
    const card = el('div', 'ui-modal-card');
    const head = el('div', 'ui-modal-head');
    if (icon) head.appendChild(el('div', 'ui-modal-icon', icon));
    head.appendChild(el('div', 'ui-modal-title', title));
    const closeBtn = el('button', 'ui-modal-close', '&times;');
    closeBtn.addEventListener('click', closeModal);
    head.appendChild(closeBtn);
    card.appendChild(head);
    const body = el('div', 'ui-modal-body');
    if (bodyEl) body.appendChild(bodyEl); else if (bodyHtml) body.innerHTML = bodyHtml;
    card.appendChild(body);
    if (actions && actions.length) {
      const footer = el('div', 'ui-modal-footer');
      actions.forEach((a) => {
        const btn = el('button', 'btn ' + (a.className || 'btn-secondary'), a.label);
        btn.addEventListener('click', () => { if (a.onClick) a.onClick(); if (a.closeOnClick !== false) closeModal(); });
        footer.appendChild(btn);
      });
      card.appendChild(footer);
    }
    host.appendChild(card);
    host.classList.add('active');
  }

  global.WISControls = {
    field, numberInput, textInput, selectInput, sliderInput, toggleInput, gauge, infoIcon,
    showModal, closeModal,
  };
})(window);
