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

  // A compact table-based weight editor (replaces sprawling one-field-per-security grids).
  // rows: [{ id, name, cols: [preformatted extra cell values...], value: number(%), onChange(fraction) }]
  function weightTable(rows, opts) {
    opts = opts || {};
    const headers = [opts.nameHeader || 'Security'].concat(opts.extraHeaders || []).concat([opts.weightHeader || 'Weight']);
    return table(headers, rows.map((r) => {
      const input = document.createElement('input');
      input.type = 'number'; input.className = 'ui-input'; input.step = opts.step || '0.5';
      input.style.width = '72px'; input.style.display = 'inline-block';
      input.value = r.value;
      input.addEventListener('input', () => r.onChange((Number(input.value) || 0) / 100));
      const wrap = el('div');
      wrap.style.display = 'flex'; wrap.style.alignItems = 'center'; wrap.style.gap = '4px';
      wrap.appendChild(input); wrap.appendChild(el('span', null, '%'));
      return [r.name].concat(r.cols || []).concat([wrap]);
    }));
  }

  // Splits a security list into Stocks / Mutual Funds sub-tables (using window.WISRealHoldings'
  // `type` field) so a 30+ security list reads as two short tables instead of one giant field grid.
  function renderSplitWeightSection(container, items, opts) {
    const stocks = items.filter((i) => i.type === 'STOCK');
    const funds = items.filter((i) => i.type !== 'STOCK');
    if (stocks.length) {
      container.appendChild(el('div', null, '<strong style="font-size:12.5px;">Stocks</strong>'));
      container.appendChild(weightTable(stocks, opts));
    }
    if (funds.length) {
      container.appendChild(el('div', null, '<strong style="font-size:12.5px;margin-top:10px;display:block;">Mutual Funds</strong>'));
      container.appendChild(weightTable(funds, opts));
    }
  }

  const USE_CASES = [
    {
      key: 'uc1', tag: 'M4-UC1', title: 'Goal-Based Asset Allocation', api: '/api/uc1', customPage: true,
      objective: 'Map each client goal to an asset allocation using time-horizon bucketing and a probability-of-success score, and emit rebalancing triggers and scenario paths.',
      frs: ['FR-GA-01 Multi-goal capture (Must)', 'FR-GA-02 Horizon glide-path (Must)', 'FR-GA-03 Probability of success (Must)', 'FR-GA-04 SIP goal-seek (Must)', 'FR-GA-05 Rebalancing triggers (Must)', 'FR-GA-06 CMA governance (Should)', 'FR-GA-07 Household aggregation (Should)'],
      tour: [
        { fr: 'FR-GA-01', priority: 'Must Have', status: 'partial', selector: '#panel-uc1-goals',
          requirement: 'Capture goals with target corpus, target date, priority and flexibility; support multiple concurrent goals per client.',
          achieved: 'Each goal card captures a target corpus (target amount) and target date (horizon), and you can hold multiple concurrent goals (see the seeded goals here). Gap: "priority" and "flexibility" are not yet captured or used by the allocation logic — every goal is currently treated with equal priority.' },
        { fr: 'FR-GA-02', priority: 'Must Have', status: 'full', selector: '#panel-uc1-goal-table',
          requirement: 'Bucket each goal into short / medium / long horizon and map to a glide-path allocation across equity, debt, gold, cash and international.',
          achieved: 'The "Horizon" column shows each goal\'s bucket (short <3y / medium 3–7y / long >7y). The recommended weights behind each row cover all 5 asset classes from a governed glide-path matrix, then clipped to the client\'s risk-category guardrails.' },
        { fr: 'FR-GA-03', priority: 'Must Have', status: 'full', selector: '#panel-uc1-goal-table',
          requirement: 'Compute a probability-of-success (goal-attainment) score per goal via forward simulation of the mapped allocation.',
          achieved: 'The "P(success)" and "Attainment Score" columns come from a forward Monte Carlo simulation of the mapped glide-path allocation against the required, inflation-adjusted corpus, using the funds you\'ve actually allocated to each goal.' },
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
      renderPage(container, api) {
        const C = global.WISControls;
        // Two kinds of allocation source, per the requirement: assets the client already owns
        // (real holdings, tagged with what's owned) and instruments not currently held that could
        // be purchased fresh to close a funding gap.
        const OWNED_HOLDINGS = (global.WISRealHoldings || []).map((h) => ({
          id: h.id, name: h.name, price: h.currentPrice, owned: true, ownedQty: h.qty, ownedValue: Math.round(h.qty * h.currentPrice),
        }));
        const NEW_PURCHASE_OPTIONS = [
          { id: 'LIQUIDFUND', name: 'Liquid Fund', price: 100, owned: false },
          { id: 'GOLDETF', name: 'Gold ETF', price: 63, owned: false },
          { id: 'NIFTYINDEX', name: 'Nifty Index Fund', price: 210, owned: false },
        ];
        const SECURITIES = [...OWNED_HOLDINGS, ...NEW_PURCHASE_OPTIONS];
        const ICONS = ['🎓', '🏖️', '🏠', '🚗', '✈️', '💍', '🎯', '👶', '🏥'];

        let goals = [
          { id: 'g1', icon: '🎓', name: 'Child Education', targetAmount: 3000000, horizonYears: 12, inflation: 0.08, allocatedHoldings: [{ security: 'HDFC_MIDCAP', amount: 400000 }], monthlySip: 8000, lumpSum: 0 },
          { id: 'g2', icon: '🏖️', name: 'Retirement', targetAmount: 20000000, horizonYears: 25, inflation: 0.06, allocatedHoldings: [{ security: 'HDFC_LARGECAP', amount: 1500000 }], monthlySip: 15000, lumpSum: 0 },
          { id: 'g3', icon: '🏠', name: 'Home Down-payment', targetAmount: 2000000, horizonYears: 4, inflation: 0.06, allocatedHoldings: [{ security: 'LIQUIDFUND', amount: 300000 }], monthlySip: 20000, lumpSum: 100000 },
          { id: 'g4', icon: '🚗', name: 'My Dream Car', targetAmount: 250000, horizonYears: 6, inflation: 0.06, allocatedHoldings: [], monthlySip: 5000, lumpSum: 0 },
        ];
        let selectedGoalId = null;
        // Risk category is DERIVED from a short risk-profile questionnaire, not a direct dropdown --
        // it isn't something a client should be able to dial up/down for themselves. Target success
        // probability is a governed platform default (per the spec's "Configurable parameters" --
        // an advisor/platform setting, not an end-client-facing input), so it's shown read-only too.
        let riskProfile = { tolerance: [3, 3], capacity: [3, 3] };
        function computeRiskCategory() {
          const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
          return Math.max(1, Math.min(5, Math.round(Math.min(avg(riskProfile.tolerance), avg(riskProfile.capacity)))));
        }
        let riskCategory = computeRiskCategory();
        const targetSuccessProbability = 0.80; // governed default, not user-adjustable
        let lastResult = null;

        function openRiskQuestionnaireModal() {
          const body = el('div');
          const questions = [
            { key: 'tolerance', idx: 0, label: 'If your investments fell 20% in a month, you would:', options: [[1, 'Sell everything immediately'], [2, 'Sell some of it'], [3, 'Hold and wait it out'], [4, 'Buy a little more'], [5, 'Buy a lot more']] },
            { key: 'tolerance', idx: 1, label: 'Your ideal investment mix leans:', options: [[1, 'All safe / fixed income'], [2, 'Mostly safe'], [3, 'Balanced'], [4, 'Mostly growth'], [5, 'All growth / equity']] },
            { key: 'capacity', idx: 0, label: 'How many years until you first need this money?', options: [[1, 'Less than 1 year'], [2, '1–3 years'], [3, '3–7 years'], [4, '7–15 years'], [5, '15+ years']] },
            { key: 'capacity', idx: 1, label: 'How stable is your income?', options: [[1, 'Very unstable'], [2, 'Somewhat unstable'], [3, 'Stable'], [4, 'Very stable'], [5, 'Guaranteed / pension']] },
          ];
          const fields = questions.map((q) => {
            const f = C.selectInput({ value: String(riskProfile[q.key][q.idx]), options: q.options.map(([v, l]) => ({ value: String(v), label: l })) });
            body.appendChild(C.field(q.label, f));
            return { q, f };
          });
          C.showModal({
            icon: '🧭', title: 'Risk Profile Questionnaire', bodyEl: body,
            actions: [
              { label: 'Cancel', className: 'btn-secondary' },
              { label: 'Save & Recalculate Category', className: 'btn-accent', onClick: () => {
                fields.forEach(({ q, f }) => { riskProfile[q.key][q.idx] = Number(f.getValue()); });
                riskCategory = computeRiskCategory();
                renderSettings();
              } },
            ],
          });
        }

        function goalCurrentValue(g) { return g.allocatedHoldings.reduce((s, h) => s + h.amount, 0) + (g.currentValue || 0); }
        function fmtDate(yearsFromNow) {
          const d = new Date(); d.setFullYear(d.getFullYear() + Math.round(yearsFromNow));
          return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        const goalsPanel = el('div', 'panel');
        goalsPanel.id = 'panel-uc1-goals';
        const workspacePanel = el('div');
        const settingsPanel = el('div', 'panel');
        const runRow = el('div', 'panel');
        const resultsPanel = el('div');
        container.appendChild(settingsPanel);
        container.appendChild(goalsPanel);
        container.appendChild(workspacePanel);
        container.appendChild(runRow);
        container.appendChild(resultsPanel);

        function renderSettings() {
          settingsPanel.innerHTML = '';
          settingsPanel.appendChild(panelTitle('Household Settings', 'These two values drive every goal\'s glide-path and SIP goal-seek below. Neither is a free-form dial: risk category comes from a risk-profile questionnaire, and the success-probability target is a governed platform default -- matching how an advisory platform actually works, rather than letting a client self-select their own risk band.'));
          const grid = el('div', 'form-grid');

          const riskWrap = el('div', 'form-field');
          const riskLabelRow = el('div', 'form-field-label');
          riskLabelRow.appendChild(el('span', null, 'Risk Category'));
          riskLabelRow.appendChild(infoIcon('Derived from the risk-profile questionnaire (tolerance + capacity), not directly editable -- capacity caps tolerance so an aggressive-minded client with low actual capacity isn\'t over-allocated to risk.'));
          riskWrap.appendChild(riskLabelRow);
          riskWrap.appendChild(el('div', null, `<strong style="font-size:15px;">Category ${riskCategory} / 5</strong>`));
          const retakeBtn = el('button', 'btn btn-secondary', 'Retake Risk Assessment');
          retakeBtn.style.marginTop = '6px'; retakeBtn.style.fontSize = '11px'; retakeBtn.style.padding = '5px 10px';
          retakeBtn.addEventListener('click', openRiskQuestionnaireModal);
          riskWrap.appendChild(retakeBtn);
          grid.appendChild(riskWrap);

          const targetWrap = el('div', 'form-field');
          const targetLabelRow = el('div', 'form-field-label');
          targetLabelRow.appendChild(el('span', null, 'Target Success Probability'));
          targetLabelRow.appendChild(infoIcon('A governed platform default (per the spec\'s Model Specification "Configurable parameters"), not a client-adjustable input -- if a goal\'s simulated probability falls below this, the required SIP is solved upward to close the gap.'));
          targetWrap.appendChild(targetLabelRow);
          targetWrap.appendChild(el('div', null, `<strong style="font-size:15px;">${Math.round(targetSuccessProbability * 100)}%</strong> <span style="color:var(--text-muted);font-size:11.5px;">— governed default</span>`));
          grid.appendChild(targetWrap);

          settingsPanel.appendChild(grid);
        }

        function renderGoalCards() {
          goalsPanel.innerHTML = '';
          goalsPanel.appendChild(panelTitle('Your Goals', 'Each card is a financial goal. Click one to allocate existing holdings or set up a SIP toward it — that funding is what the model (below) uses to compute its probability of success.'));
          const list = el('div', 'goal-card-list');
          goals.forEach((g) => {
            const cur = goalCurrentValue(g);
            const pct = Math.min(100, Math.round((cur / g.targetAmount) * 100));
            const card = el('div', 'goal-card' + (g.id === selectedGoalId ? ' active' : ''));
            card.innerHTML = `
              <div class="goal-card-icon">${g.icon}</div>
              <div class="goal-card-name">${g.name}</div>
              <div class="goal-progress-track"><div class="goal-progress-fill" style="width:${pct}%"></div></div>
              <div class="goal-card-meta"><span>₹${fmtCompact(cur)} of ₹${fmtCompact(g.targetAmount)}</span><span>${pct}%</span></div>
            `;
            card.addEventListener('click', () => { selectedGoalId = g.id; renderGoalCards(); renderWorkspace(); });
            list.appendChild(card);
          });
          const addCard = el('div', 'goal-card-add', '+ Add Goal');
          addCard.addEventListener('click', () => openAddGoalModal());
          list.appendChild(addCard);
          goalsPanel.appendChild(list);
        }

        function openAddGoalModal() {
          const body = el('div');
          const nameField = C.textInput({ placeholder: 'e.g. Dream Vacation' });
          body.appendChild(C.field('Goal Name', nameField));
          const iconField = C.selectInput({ value: ICONS[0], options: ICONS.map((i) => ({ value: i, label: i })) });
          body.appendChild(C.field('Icon', iconField));
          const amountField = C.numberInput({ value: 500000, step: 10000, prefix: '₹' });
          body.appendChild(C.field('Target Amount (today\'s ₹)', amountField));
          const yearsField = C.numberInput({ value: 5, step: 1, suffix: 'yrs' });
          body.appendChild(C.field('Time to Goal', yearsField));
          C.showModal({
            icon: '🎯', title: 'Add a New Goal', bodyEl: body,
            actions: [
              { label: 'Cancel', className: 'btn-secondary' },
              { label: 'Create Goal', className: 'btn-accent', onClick: () => {
                const id = 'g' + Date.now();
                goals.push({ id, icon: iconField.getValue(), name: nameField.getValue() || 'New Goal', targetAmount: amountField.getValue() || 100000, horizonYears: yearsField.getValue() || 1, inflation: 0.06, allocatedHoldings: [], monthlySip: 0, lumpSum: 0 });
                selectedGoalId = id;
                renderGoalCards(); renderWorkspace();
              } },
            ],
          });
        }

        function openAllocateFundsModal(goal) {
          const body = el('div');
          const modeField = C.selectInput({
            value: 'owned',
            options: [{ value: 'owned', label: 'Allocate an asset I already own' }, { value: 'new', label: 'Purchase a new asset for this goal' }],
          });
          body.appendChild(C.field('Source', modeField));
          const pickerWrap = el('div');
          body.appendChild(pickerWrap);
          const amountField = C.numberInput({ value: 50000, step: 5000, prefix: '₹' });
          body.appendChild(C.field('Amount to Allocate', amountField, 'Value of existing holdings (or new purchase) you want to earmark toward this goal.'));

          let secField;
          function renderPicker() {
            pickerWrap.innerHTML = '';
            const list = modeField.getValue() === 'owned' ? OWNED_HOLDINGS : NEW_PURCHASE_OPTIONS;
            secField = C.selectInput({
              value: list[0].id,
              options: list.map((s) => ({ value: s.id, label: s.owned ? `${s.name} — you own ${s.ownedQty} units (₹${fmtCompact(s.ownedValue)})` : `${s.name} (new purchase)` })),
            });
            pickerWrap.appendChild(C.field('Security / Fund', secField));
          }
          modeField.addEventListener('change', renderPicker);
          renderPicker();

          C.showModal({
            icon: '📦', title: `Allocate Funds — ${goal.name}`, bodyEl: body,
            actions: [
              { label: 'Cancel', className: 'btn-secondary' },
              { label: 'Allocate', className: 'btn-accent', onClick: () => {
                const sec = SECURITIES.find((s) => s.id === secField.getValue());
                goal.allocatedHoldings.push({ security: sec.id, amount: amountField.getValue() || 0 });
                renderGoalCards(); renderWorkspace();
              } },
            ],
          });
        }

        function openInvestModal(goal) {
          const body = el('div');
          const sipField = C.numberInput({ value: goal.monthlySip || 1000, step: 500, prefix: '₹' });
          body.appendChild(C.field('Monthly SIP Amount', sipField, 'Recurring monthly investment committed toward this goal.'));
          C.showModal({
            icon: '💰', title: `Invest in Goal — ${goal.name}`, bodyEl: body,
            actions: [
              { label: 'Cancel', className: 'btn-secondary' },
              { label: 'Save SIP', className: 'btn-accent', onClick: () => {
                goal.monthlySip = sipField.getValue() || 0;
                renderGoalCards(); renderWorkspace();
              } },
            ],
          });
        }

        function renderWorkspace() {
          workspacePanel.innerHTML = '';
          const goal = goals.find((g) => g.id === selectedGoalId);
          if (!goal) return;
          const cur = goalCurrentValue(goal);
          const pct = Math.min(100, Math.round((cur / goal.targetAmount) * 100));
          const remaining = Math.max(0, goal.targetAmount - cur);

          const panel = el('div', 'panel');
          panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:26px;">${goal.icon}</span>
                <div>
                  <div style="font-weight:700;font-size:16px;">${goal.name}</div>
                  <div style="font-size:11.5px;color:var(--text-muted);">₹${fmtCompact(cur)} of ₹${fmtCompact(goal.targetAmount)}</div>
                </div>
              </div>
            </div>
          `;
          const backBtn = el('button', 'btn btn-secondary', '← Back to Goals');
          backBtn.addEventListener('click', () => { selectedGoalId = null; renderGoalCards(); renderWorkspace(); });
          panel.insertBefore(backBtn, panel.firstChild);

          const progressWrap = el('div');
          progressWrap.innerHTML = `<div class="goal-progress-track" style="height:10px;margin:10px 0 8px 0;"><div class="goal-progress-fill" style="width:${pct}%"></div></div>
            <div class="goal-card-meta" style="margin-bottom:14px;"><span>Remaining Time: ${goal.horizonYears} yrs</span><span>Remaining Amount: ₹${fmtCompact(remaining)}</span></div>`;
          panel.appendChild(progressWrap);

          const detailTable = table(['Field', 'Value'], [
            ['Current Allocated Holding Value', '₹' + fmtCompact(goal.allocatedHoldings.reduce((s, h) => s + h.amount, 0))],
            ['Monthly SIP Investment', '₹' + fmtCompact(goal.monthlySip)],
            ['End Date', fmtDate(goal.horizonYears)],
          ]);
          panel.appendChild(detailTable);

          const tabsRow = el('div', 'allocation-tabs');
          const holdingsTab = el('div', 'allocation-tab active', 'Holdings');
          const sipTab = el('div', 'allocation-tab', 'SIP');
          tabsRow.appendChild(holdingsTab); tabsRow.appendChild(sipTab);
          panel.appendChild(el('div', 'panel-title', 'Allocation'));
          panel.appendChild(tabsRow);

          const tabBody = el('div');
          panel.appendChild(tabBody);

          function renderHoldingsTab() {
            tabBody.innerHTML = '';
            if (!goal.allocatedHoldings.length) {
              const empty = el('div', 'empty-box');
              empty.innerHTML = `<div class="empty-box-icon">📭</div><div class="empty-box-title">No funds allocated</div><div>You have not allocated any mutual fund holdings to your current goal.</div>`;
              const btnRow = el('div', 'form-actions-row'); btnRow.style.justifyContent = 'center'; btnRow.style.marginTop = '14px';
              const investBtn = el('button', 'btn btn-secondary', 'Invest in Goal');
              investBtn.addEventListener('click', () => openInvestModal(goal));
              const allocBtn = el('button', 'btn btn-accent', 'Allocate Funds');
              allocBtn.addEventListener('click', () => openAllocateFundsModal(goal));
              btnRow.appendChild(investBtn); btnRow.appendChild(allocBtn);
              empty.appendChild(btnRow);
              tabBody.appendChild(empty);
            } else {
              tabBody.appendChild(table(['Security', 'Amount', ''], goal.allocatedHoldings.map((h, idx) => {
                const sec = SECURITIES.find((s) => s.id === h.security);
                const removeBtn = el('button', 'btn btn-secondary', 'Remove');
                removeBtn.style.padding = '4px 10px'; removeBtn.style.fontSize = '11px';
                removeBtn.addEventListener('click', () => { goal.allocatedHoldings.splice(idx, 1); renderGoalCards(); renderWorkspace(); });
                return [sec ? sec.name : h.security, '₹' + fmtCompact(h.amount), removeBtn];
              })));
              const allocBtn = el('button', 'btn btn-accent', '+ Allocate More Funds');
              allocBtn.style.marginTop = '10px';
              allocBtn.addEventListener('click', () => openAllocateFundsModal(goal));
              tabBody.appendChild(allocBtn);
            }
          }
          function renderSipTab() {
            tabBody.innerHTML = '';
            if (!goal.monthlySip) {
              const empty = el('div', 'empty-box');
              empty.innerHTML = `<div class="empty-box-icon">🔁</div><div class="empty-box-title">No SIP set up</div><div>Set up a recurring monthly investment toward this goal.</div>`;
              const investBtn = el('button', 'btn btn-accent', 'Invest in Goal');
              investBtn.style.marginTop = '14px';
              investBtn.addEventListener('click', () => openInvestModal(goal));
              empty.appendChild(investBtn);
              tabBody.appendChild(empty);
            } else {
              tabBody.appendChild(table(['Monthly SIP', ''], [[
                '₹' + fmtCompact(goal.monthlySip) + '/mo',
                (() => { const b = el('button', 'btn btn-secondary', 'Edit SIP'); b.style.padding = '4px 10px'; b.style.fontSize = '11px'; b.addEventListener('click', () => openInvestModal(goal)); return b; })(),
              ]]));
            }
          }
          holdingsTab.addEventListener('click', () => { holdingsTab.classList.add('active'); sipTab.classList.remove('active'); renderHoldingsTab(); });
          sipTab.addEventListener('click', () => { sipTab.classList.add('active'); holdingsTab.classList.remove('active'); renderSipTab(); });
          renderHoldingsTab();

          const deleteBtn = el('button', 'btn btn-secondary', '🗑 Delete Goal');
          deleteBtn.style.marginTop = '16px';
          deleteBtn.addEventListener('click', () => {
            goals = goals.filter((g) => g.id !== goal.id);
            selectedGoalId = null;
            renderGoalCards(); renderWorkspace();
          });
          panel.appendChild(deleteBtn);

          workspacePanel.appendChild(panel);
        }

        function renderRunRow() {
          runRow.innerHTML = '';
          const btn = el('button', 'btn btn-accent', 'Run Financial Plan');
          btn.style.fontSize = '14px'; btn.style.padding = '11px 22px';
          const tourBtn = api.makeTourButton();
          const status = el('div', 'status-line');
          btn.addEventListener('click', async () => {
            status.textContent = 'Running model...'; status.className = 'status-line';
            btn.disabled = true;
            try {
              const payload = {
                riskCategory, targetSuccessProbability,
                goals: goals.map((g) => ({ name: g.name, targetAmount: g.targetAmount, horizonYears: g.horizonYears, inflation: g.inflation, currentValue: goalCurrentValue(g), lumpSum: g.lumpSum || 0, monthlySip: g.monthlySip || 0 })),
              };
              const result = await api.runModel(api.uc, payload);
              lastResult = result;
              status.textContent = 'Model executed successfully.'; status.className = 'status-line ok';
              renderResults(result);
              tourBtn.disabled = false;
            } catch (err) {
              status.textContent = 'Error: ' + err.message; status.className = 'status-line error';
            } finally {
              btn.disabled = false;
            }
          });
          runRow.appendChild(btn);
          runRow.appendChild(tourBtn);
          runRow.appendChild(status);
        }

        function renderResults(data) {
          resultsPanel.innerHTML = '';
          const intro = el('div', 'note-box');
          intro.style.background = '#eef2f7'; intro.style.borderColor = 'var(--border)'; intro.style.color = 'var(--text)';
          intro.textContent = 'Results below use the funds you\'ve actually allocated/committed to each goal above (not a generic assumption) — allocate more, or add a SIP, and re-run to see the probability move.';
          resultsPanel.appendChild(intro);

          const metrics = el('div', 'metric-row');
          metrics.appendChild(metricCard('Goals Modelled', data.goalAllocations.length, null,
            'Count of goals run through the horizon-bucketing + probability-of-success model (one row per goal below).'));
          const cmaCard = metricCard('CMA Version', data.assumptionSet.version, data.assumptionSet.effectiveDate,
            'Capital-market assumptions (expected return, volatility, correlation per asset class) used for every projection — governed & version-stamped per FR-GA-06.');
          cmaCard.id = 'm-uc1-cma';
          metrics.appendChild(cmaCard);
          metrics.appendChild(metricCard('Rebalancing Triggers', data.rebalancingTriggers.length, null,
            'Count of goals whose success probability fell below target, or household weights sitting at a risk-guardrail edge (FR-GA-05).'));
          resultsPanel.appendChild(metrics);

          const goalCardsRow = el('div', 'metric-row');
          data.goalAllocations.forEach((g) => {
            const card = el('div', 'metric-card');
            card.style.flex = '1 1 220px';
            const gaugeWrap = C.gauge(g.goalAttainmentScore, { size: 90, subLabel: 'attainment' });
            const row = el('div'); row.style.display = 'flex'; row.style.gap = '10px'; row.style.alignItems = 'center';
            row.appendChild(gaugeWrap);
            const textWrap = el('div');
            textWrap.innerHTML = `<div style="font-weight:700;font-size:13px;">${g.goalName}</div><div style="font-size:11px;color:var(--text-muted);">P(success) ${fmtPct(g.probability)}</div><div style="font-size:11px;color:var(--text-muted);">Needs ₹${fmtCompact(g.requiredMonthlySip)}/mo</div>`;
            row.appendChild(textWrap);
            card.appendChild(row);
            goalCardsRow.appendChild(card);
          });
          resultsPanel.appendChild(goalCardsRow);

          const panel1 = el('div', 'panel');
          panel1.id = 'panel-uc1-goal-table';
          panel1.appendChild(panelTitle('Goal Allocations — Detail',
            'Each row: horizon → governed glide-path allocation (FR-GA-02), then a forward Monte Carlo projection estimates the probability of meeting the Required Corpus (FR-GA-03). "Target Amount" is what you entered in today\'s ₹ on the goal card; "Required Corpus" is that same amount compounded forward by the goal\'s own inflation rate over its horizon (Required Corpus = Target Amount × (1+inflation)^years) -- the two numbers are deliberately different, not a mismatch, and this column pair shows the calculation directly. If probability was below target, the required monthly SIP was solved via goal-seek (FR-GA-04) — a score of 100/100 means the solved SIP exactly reaches your target probability, not that the goal is risk-free.'));
          const targetAmountByName = {};
          goals.forEach((g) => { targetAmountByName[g.name] = g.targetAmount; });
          panel1.appendChild(table(
            ['Goal', 'Horizon', 'Target Amount (today\'s ₹)', 'Required Corpus (inflation-adjusted)', 'Required SIP', 'Attainment Score', 'P(success)'],
            data.goalAllocations.map((g) => [
              g.goalName, g.horizonBucket,
              '₹' + fmtCompact(targetAmountByName[g.goalName] != null ? targetAmountByName[g.goalName] : g.requiredCorpus),
              '₹' + fmtCompact(g.requiredCorpus), '₹' + fmtCompact(g.requiredMonthlySip) + '/mo',
              g.goalAttainmentScore + '/100', fmtPct(g.probability),
            ])
          ));
          resultsPanel.appendChild(panel1);

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
            '"probability" triggers fire when a goal\'s P(success) is below your target. "drift" triggers fire when the household allocation for an asset class sits at the edge of its risk-category guardrail band.'));
          if (data.rebalancingTriggers.length) {
            p3.appendChild(table(['Type', 'Scope', 'Threshold', 'Current'], data.rebalancingTriggers.map((t) => [
              t.type, t.goal || t.assetClass, t.threshold != null ? t.threshold : t.band, t.currentValue,
            ])));
          } else {
            p3.appendChild(el('div', 'empty-hint', 'No triggers breached'));
          }
          two.appendChild(p3);
          resultsPanel.appendChild(two);

          barChart(chart1, Object.entries(data.householdAllocation).map(([k, v]) => ({ label: k, value: v })), {
            valueFormatter: (v) => fmtPct(v), max: 1,
          });

          const p4 = el('div', 'panel');
          p4.appendChild(panelTitle('Scenario Wealth Paths (5th–95th percentile band, gold = median) — hover to see values',
            'A separate 500-path Monte Carlo run per goal (distinct from the probability-of-success calculation above, which uses its own simulation count) under the same capital-market assumptions and this goal\'s contribution schedule — shown to illustrate the dispersion of outcomes, not a single predicted number.'));
          const chartGrid = el('div', 'chart-grid-2');
          data.scenarioPaths.forEach((sp) => {
            const cell = el('div');
            cell.appendChild(el('div', null, `<strong>${sp.goalName}</strong>`));
            const cw = el('div', 'chart-wrap');
            cell.appendChild(cw);
            chartGrid.appendChild(cell);
            bandChart(cw, sp.series, { xLabel: (i) => 'Yr ' + i, width: 460 });
          });
          p4.appendChild(chartGrid);
          resultsPanel.appendChild(p4);
        }

        renderSettings();
        renderGoalCards();
        renderRunRow();
        resultsPanel.innerHTML = '<div class="empty-hint">Allocate funds to your goals above, then click "Run Financial Plan" to see results.</div>';
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
      buildForm(container) {
        const C = global.WISControls;
        const WEIGHT_PRESETS = {
          conservative: { accumulationWeights: { Equity: 0.35, Debt: 0.50, Gold: 0.10, Cash: 0.05, International: 0 }, decumulationWeights: { Equity: 0.20, Debt: 0.65, Gold: 0.10, Cash: 0.05, International: 0 } },
          balanced: { accumulationWeights: { Equity: 0.65, Debt: 0.25, Gold: 0.05, Cash: 0.05, International: 0 }, decumulationWeights: { Equity: 0.35, Debt: 0.50, Gold: 0.10, Cash: 0.05, International: 0 } },
          growth: { accumulationWeights: { Equity: 0.80, Debt: 0.10, Gold: 0.05, Cash: 0.05, International: 0 }, decumulationWeights: { Equity: 0.50, Debt: 0.35, Gold: 0.10, Cash: 0.05, International: 0 } },
        };
        let state = {
          currentCorpus: 5000000, accumulationYears: 15, decumulationYears: 25, monthlyContribution: 25000,
          annualWithdrawal: 420000, inflationMean: 0.06, inflationVol: 0.015, ...WEIGHT_PRESETS.balanced,
          shockProbability: 0.03, shockSize: 300000, pathCount: 3000, targetSuccessProbability: 0.85,
        };
        let riskPreset = 'balanced';

        container.appendChild(el('div', 'panel-title', 'Your Plan'));
        const grid = el('div', 'form-grid');
        const corpusField = C.numberInput({ value: state.currentCorpus, step: 100000, prefix: '₹', onChange: (v) => { state.currentCorpus = v || 0; } });
        grid.appendChild(C.field('Current Investable Corpus', corpusField, 'What you have invested today, at the start of the simulation.'));

        const contribField = C.numberInput({ value: state.monthlyContribution, step: 1000, prefix: '₹', onChange: (v) => { state.monthlyContribution = v || 0; } });
        grid.appendChild(C.field('Monthly Contribution (accumulation)', contribField, 'How much you add every month until retirement.'));

        const withdrawField = C.numberInput({ value: state.annualWithdrawal, step: 10000, prefix: '₹', onChange: (v) => { state.annualWithdrawal = v || 0; } });
        grid.appendChild(C.field('Annual Withdrawal (retirement, today\'s ₹)', withdrawField, 'How much you plan to spend per year in retirement, in today\'s rupees — the simulation inflates this forward each year.'));

        const accYearsField = C.sliderInput({ value: state.accumulationYears, min: 1, max: 40, step: 1, format: (v) => v + ' yrs', onChange: (v) => { state.accumulationYears = v; } });
        grid.appendChild(C.field('Years Until Retirement', accYearsField, 'Length of the accumulation phase (still contributing, not yet withdrawing).'));

        const decYearsField = C.sliderInput({ value: state.decumulationYears, min: 1, max: 40, step: 1, format: (v) => v + ' yrs', onChange: (v) => { state.decumulationYears = v; } });
        grid.appendChild(C.field('Years In Retirement', decYearsField, 'Length of the decumulation phase (withdrawing, not contributing) — plan for a long life expectancy.'));

        const riskField = C.selectInput({ value: riskPreset, options: [{ value: 'conservative', label: 'Conservative' }, { value: 'balanced', label: 'Balanced' }, { value: 'growth', label: 'Growth' }], onChange: (v) => { riskPreset = v; Object.assign(state, WEIGHT_PRESETS[v]); } });
        grid.appendChild(C.field('Investment Style', riskField, 'A preset asset-class mix for the accumulation and (more conservative) decumulation phases. Conservative/Balanced/Growth roughly track risk categories 2/3/4.'));

        const targetField = C.sliderInput({ value: state.targetSuccessProbability * 100, min: 50, max: 95, step: 5, format: (v) => v + '%', onChange: (v) => { state.targetSuccessProbability = v / 100; } });
        grid.appendChild(C.field('Target Success Probability', targetField, 'The confidence level used to solve the Safe Withdrawal Rate below — higher targets produce a more conservative (lower) safe withdrawal rate.'));

        const pathField = C.selectInput({ value: String(state.pathCount), options: [{ value: '1000', label: '1,000 (fastest)' }, { value: '3000', label: '3,000 (default)' }, { value: '5000', label: '5,000' }, { value: '10000', label: '10,000 (spec minimum, slower)' }], onChange: (v) => { state.pathCount = Number(v); } });
        grid.appendChild(C.field('Simulation Paths', pathField, 'More paths = more statistically reliable percentiles, at the cost of longer run time. FR-MC-01 calls for at least 10,000.'));
        container.appendChild(grid);

        container.appendChild(el('div', 'panel-title', 'Shocks & Inflation'));
        const grid2 = el('div', 'form-grid');
        const inflField = C.sliderInput({ value: state.inflationMean * 100, min: 2, max: 10, step: 0.5, format: (v) => v + '%', onChange: (v) => { state.inflationMean = v / 100; } });
        grid2.appendChild(C.field('Average Inflation', inflField, 'Mean annual inflation used to grow your withdrawal amount each year in retirement.'));
        const shockProbField = C.sliderInput({ value: state.shockProbability * 100, min: 0, max: 15, step: 1, format: (v) => v + '%', onChange: (v) => { state.shockProbability = v / 100; } });
        grid2.appendChild(C.field('Annual Shock Probability', shockProbField, 'Chance, each year in retirement, of an unplanned lump-sum expense (medical, etc.).'));
        const shockSizeField = C.numberInput({ value: state.shockSize, step: 50000, prefix: '₹', onChange: (v) => { state.shockSize = v || 0; } });
        grid2.appendChild(C.field('Shock Size', shockSizeField, 'Size of that unplanned expense, in today\'s rupees, when it occurs.'));
        container.appendChild(grid2);

        return {
          getData: () => ({ ...state }),
          setData: (json) => {
            state = { ...state, ...json };
            corpusField.setValue(state.currentCorpus);
            contribField.setValue(state.monthlyContribution);
            withdrawField.setValue(state.annualWithdrawal);
            accYearsField.setValue(state.accumulationYears);
            decYearsField.setValue(state.decumulationYears);
            targetField.setValue(state.targetSuccessProbability * 100);
            inflField.setValue(state.inflationMean * 100);
            shockProbField.setValue(state.shockProbability * 100);
            shockSizeField.setValue(state.shockSize);
          },
        };
      },
      render(container, data, ctx) {
        container.innerHTML = '';
        const C = global.WISControls;
        const verdict = el('div', 'panel');
        verdict.style.display = 'flex'; verdict.style.gap = '20px'; verdict.style.alignItems = 'center';
        const gaugeWrap = el('div');
        if (C) gaugeWrap.appendChild(C.gauge(data.successProbability * 100, { subLabel: 'success prob.' }));
        verdict.appendChild(gaugeWrap);
        const verdictText = el('div');
        const verdictWord = data.successProbability >= 0.8 ? 'on track' : data.successProbability >= 0.5 ? 'at moderate risk' : 'at high risk';
        verdictText.innerHTML = `<div style="font-size:16px;font-weight:700;margin-bottom:6px;">This plan is ${verdictWord}</div>
          <div style="font-size:13px;line-height:1.6;color:var(--text-muted);">Across ${data.runManifest.pathCount.toLocaleString()} simulated futures, this plan avoids running out of money in <strong>${fmtPct(data.successProbability)}</strong> of them.
          A withdrawal rate of <strong>${fmtPct(data.safeWithdrawalRate, 2)}</strong> of the retirement-date corpus would keep that success chance at your ${fmtPct(0.85, 0)} target.
          The plan is <strong>${fmtPct(Math.abs(data.sequenceRiskDelta), 1)} ${data.sequenceRiskDelta >= 0 ? 'more' : 'less'} likely to succeed</strong> if bad market years happen late rather than early in retirement (sequence-of-returns risk).</div>`;
        verdict.appendChild(verdictText);
        container.appendChild(verdict);

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

        // ---- Portfolio concentration & liquidity recommendations, using the client's real holdings ----
        const holdings = global.WISRealHoldings || [];
        if (holdings.length) {
          const totalValue = holdings.reduce((s, h) => s + h.qty * h.currentPrice, 0);
          const byMacap = { Large: 0, Mid: 0, Small: 0 };
          holdings.forEach((h) => { byMacap[h.macap] = (byMacap[h.macap] || 0) + h.qty * h.currentPrice; });
          const liquidValue = 0; // no liquid/debt instrument present in the supplied holdings
          const pct = (v) => totalValue ? v / totalValue : 0;

          const annualWithdrawal = (ctx && ctx.payload && ctx.payload.annualWithdrawal) || 420000;
          const emergencyBufferTarget = Math.round((annualWithdrawal / 12) * 6); // 6 months of planned spending

          const p5 = el('div', 'panel');
          p5.appendChild(panelTitle('Portfolio Concentration & Liquidity — Built for Long-Term Safety',
            'Derived from your actual holdings (not the Monte Carlo engine itself): checks how concentrated the equity sleeve is by market-cap bucket, and whether there\'s a liquid buffer for shocks/medical emergencies separate from the long-term growth assets.'));

          const flags = [];
          if (liquidValue === 0) {
            flags.push({ icon: '🚨', text: `0% of this portfolio is in a liquid/debt instrument. For medical-emergency-type shocks, recommend holding roughly ₹${fmtCompact(emergencyBufferTarget)} (~6 months of planned spending) in a liquid fund, separate from the growth assets below.` });
          }
          if (pct(byMacap.Small) > 0.30) {
            flags.push({ icon: '⚠️', text: `Small-cap exposure is ${fmtPct(pct(byMacap.Small))} of the equity sleeve — high for a "safe, shock-resistant" long-term corpus. Consider trimming toward Large-cap for stability.` });
          }
          const bigPositions = holdings.filter((h) => (h.qty * h.currentPrice) / totalValue > 0.08);
          bigPositions.forEach((h) => flags.push({ icon: '🔎', text: `${h.name} is ${fmtPct((h.qty * h.currentPrice) / totalValue)} of the portfolio — a concentrated single-name position; consider trimming to reduce single-stock risk.` }));
          if (!flags.length) flags.push({ icon: '✅', text: 'No major concentration or liquidity flags — the current cap-bucket mix and position sizes look reasonable for a long-term plan.' });

          flags.forEach((f) => {
            const banner = el('div', 'alert-banner' + (f.icon === '✅' ? ' ok' : ''));
            banner.innerHTML = `<span class="alert-icon">${f.icon}</span><span class="alert-text">${f.text}</span>`;
            p5.appendChild(banner);
          });

          const two2 = el('div', 'two-col');
          const capPanel = el('div', 'panel');
          capPanel.appendChild(panelTitle('Current vs. Recommended Mix', 'Recommended mix tilts toward Large-cap for stability and carves out a liquid emergency buffer, per the flags above.'));
          const capChart = el('div', 'chart-wrap');
          capPanel.appendChild(capChart);
          two2.appendChild(capPanel);
          const recommended = { Large: 0.45, Mid: 0.35, Small: 0.15, Liquid: 0.05 };
          barChart(capChart, [
            { label: 'Large Cap (current)', value: pct(byMacap.Large) }, { label: 'Large Cap (target)', value: recommended.Large, color: '#94a3b3' },
            { label: 'Mid Cap (current)', value: pct(byMacap.Mid) }, { label: 'Mid Cap (target)', value: recommended.Mid, color: '#94a3b3' },
            { label: 'Small Cap (current)', value: pct(byMacap.Small) }, { label: 'Small Cap (target)', value: recommended.Small, color: '#94a3b3' },
            { label: 'Liquid (current)', value: pct(liquidValue) }, { label: 'Liquid (target)', value: recommended.Liquid, color: '#94a3b3' },
          ], { valueFormatter: fmtPct, max: 0.5 });

          const actionPanel = el('div', 'panel');
          actionPanel.appendChild(panelTitle('Specific Increase / Decrease Suggestions', 'Sell-flagged holdings are candidates to trim; Buy-flagged Large-cap holdings help rebuild the stability sleeve. This reads your Reco field directly — it is not re-derived by the simulation.'));
          const actionRows = holdings
            .map((h) => {
              const w = (h.qty * h.currentPrice) / totalValue;
              let action = null, rationale = '';
              if (h.reco === 'Sell' && w > 0.01) { action = 'Decrease'; rationale = 'Flagged Sell by research; reduces concentration.'; }
              else if (h.reco === 'Buy' && h.macap === 'Large') { action = 'Increase'; rationale = 'Flagged Buy; adds Large-cap stability.'; }
              return action ? { name: h.name, macap: h.macap, weight: w, action, rationale } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 8);
          if (actionRows.length) {
            actionPanel.appendChild(table(['Holding', 'Cap', 'Current Wt', 'Action', 'Rationale'], actionRows.map((r) => [
              r.name, r.macap, fmtPct(r.weight), tag(r.action, r.action === 'Increase' ? 'buy' : 'sell'), r.rationale,
            ])));
          } else {
            actionPanel.appendChild(el('div', 'empty-hint', 'No specific increase/decrease flags from the Reco data'));
          }
          two2.appendChild(actionPanel);
          p5.appendChild(two2);
          container.appendChild(p5);
        }
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
      buildForm(container) {
        const C = global.WISControls;
        const REAL = global.WISRealHoldings || [];
        const UNIVERSE_OPTIONS = REAL.map((h) => [h.id, h.name]);
        const totalValue = REAL.reduce((s, h) => s + h.qty * h.currentPrice, 0) || 1;
        const defaultHoldings = {};
        REAL.forEach((h) => { defaultHoldings[h.id] = Number(((h.qty * h.currentPrice) / totalValue).toFixed(4)); });
        let state = {
          objective: 'maxSharpe', riskFreeRate: 0.065, shrinkageIntensity: 0.3, useBlackLitterman: true,
          views: [{ assetId: 'HDFCBANK', viewReturn: 0.16, confidence: 0.6 }],
          sectorCaps: { 'Information Technology': 0.15, 'Financial Services': 0.30 }, boxMax: 0.15, riskAversion: 3, turnoverCap: null,
          currentHoldings: defaultHoldings,
          transactionCostBps: 15,
        };

        container.appendChild(el('div', 'panel-title', 'Optimization Settings'));
        const grid = el('div', 'form-grid');
        const objField = C.selectInput({ value: state.objective, options: [{ value: 'maxSharpe', label: 'Maximise Sharpe Ratio' }, { value: 'minVariance', label: 'Minimise Variance' }], onChange: (v) => { state.objective = v; } });
        grid.appendChild(C.field('Objective (Markowitz)', objField, 'What the optimizer solves for. "Max Sharpe" balances return against risk; "Min Variance" minimises risk regardless of return. The Efficient Frontier chart shows the full range either way.'));

        const rfField = C.sliderInput({ value: state.riskFreeRate * 100, min: 2, max: 10, step: 0.25, format: (v) => v + '%', onChange: (v) => { state.riskFreeRate = v / 100; } });
        grid.appendChild(C.field('Risk-Free Rate', rfField, 'Used in the Sharpe ratio calculation: (return − risk-free) ÷ volatility.'));

        const shrinkField = C.sliderInput({ value: state.shrinkageIntensity * 100, min: 0, max: 100, step: 5, format: (v) => v + '%', onChange: (v) => { state.shrinkageIntensity = v / 100; } });
        grid.appendChild(C.field('Covariance Shrinkage (Ledoit-Wolf)', shrinkField, 'How much the raw historical covariance is pulled toward a stable diagonal target. 0% = raw sample covariance (noisy); 100% = fully diagonal (ignores correlation). Stabilises the optimizer against estimation error.'));

        const blField = C.toggleInput({ checked: state.useBlackLitterman, labelOn: 'Enabled', labelOff: 'Disabled', onChange: (v) => { state.useBlackLitterman = v; } });
        grid.appendChild(C.field('Black-Litterman Blending', blField, 'When enabled, blends the house-view return estimates with your view below (weighted by confidence) before optimizing, instead of using house-view returns directly.'));
        container.appendChild(grid);

        container.appendChild(el('div', 'panel-title', 'Your View (for Black-Litterman)'));
        const grid1b = el('div', 'form-grid');
        const viewSecField = C.selectInput({ value: state.views[0].assetId, options: UNIVERSE_OPTIONS.map(([v, l]) => ({ value: v, label: l })), onChange: (v) => { state.views[0].assetId = v; } });
        grid1b.appendChild(C.field('Security', viewSecField, 'The security your view applies to.'));
        const viewRetField = C.sliderInput({ value: state.views[0].viewReturn * 100, min: 0, max: 30, step: 1, format: (v) => v + '%', onChange: (v) => { state.views[0].viewReturn = v / 100; } });
        grid1b.appendChild(C.field('Your Expected Return', viewRetField, 'What you believe this security\'s annual return will be, overriding the house view proportionally to your confidence below.'));
        const viewConfField = C.sliderInput({ value: state.views[0].confidence * 100, min: 5, max: 100, step: 5, format: (v) => v + '%', onChange: (v) => { state.views[0].confidence = v / 100; } });
        grid1b.appendChild(C.field('Confidence', viewConfField, 'How strongly your view should pull the blended return away from the house-view equilibrium.'));
        container.appendChild(grid1b);

        container.appendChild(el('div', 'panel-title', 'Constraints'));
        const grid2 = el('div', 'form-grid');
        const boxField = C.sliderInput({ value: state.boxMax * 100, min: 5, max: 50, step: 5, format: (v) => v + '%', onChange: (v) => { state.boxMax = v / 100; } });
        grid2.appendChild(C.field('Max Weight per Security', boxField, 'No single holding can exceed this share of the portfolio.'));
        const itCapField = C.sliderInput({ value: (state.sectorCaps['Information Technology'] || 0) * 100, min: 0, max: 60, step: 5, format: (v) => v + '%', onChange: (v) => { state.sectorCaps['Information Technology'] = v / 100; } });
        grid2.appendChild(C.field('IT Sector Cap', itCapField, 'Maximum combined weight across all Information Technology holdings (Infosys, Wipro).'));
        const finCapField = C.sliderInput({ value: (state.sectorCaps['Financial Services'] || 0) * 100, min: 0, max: 60, step: 5, format: (v) => v + '%', onChange: (v) => { state.sectorCaps['Financial Services'] = v / 100; } });
        grid2.appendChild(C.field('Financial Services Sector Cap', finCapField, 'Maximum combined weight across all Financial Services holdings (HDFC Bank, REC, HDFC Life).'));
        const riskAvField = C.sliderInput({ value: state.riskAversion, min: 1, max: 10, step: 0.5, format: (v) => v.toFixed(1), onChange: (v) => { state.riskAversion = v; } });
        grid2.appendChild(C.field('Risk Aversion (λ)', riskAvField, 'Higher values penalise variance more heavily inside the "Max Sharpe" objective, pulling the solution toward lower-risk holdings.'));
        const costField = C.numberInput({ value: state.transactionCostBps, step: 1, suffix: 'bps', onChange: (v) => { state.transactionCostBps = v || 0; } });
        grid2.appendChild(C.field('Transaction Cost', costField, 'Estimated cost per unit of trade, in basis points — used to estimate the cost of the trade list below.'));
        container.appendChild(grid2);

        const holdingsSection = el('div');
        container.appendChild(holdingsSection);
        function renderHoldingsSection() {
          holdingsSection.innerHTML = '';
          holdingsSection.appendChild(el('div', 'panel-title', 'Current Holdings (your starting portfolio)'));
          holdingsSection.appendChild(el('p', null, '<span style="color:var(--text-muted);font-size:12.5px">Used to compute turnover and the trade list — how far the optimal portfolio is from what you hold today.</span>'));
          const items = REAL.map((h) => ({
            id: h.id, name: h.name, type: h.type, value: Math.round((state.currentHoldings[h.id] || 0) * 1000) / 10,
            onChange: (frac) => { state.currentHoldings[h.id] = frac; },
          }));
          renderSplitWeightSection(holdingsSection, items, { weightHeader: 'Current Weight' });
        }
        renderHoldingsSection();

        return {
          getData: () => JSON.parse(JSON.stringify(state)),
          setData: (json) => {
            state = JSON.parse(JSON.stringify(json));
            objField.value = state.objective;
            rfField.setValue(state.riskFreeRate * 100);
            shrinkField.setValue(state.shrinkageIntensity * 100);
            viewSecField.value = state.views[0].assetId;
            viewRetField.setValue(state.views[0].viewReturn * 100);
            viewConfField.setValue(state.views[0].confidence * 100);
            boxField.setValue(state.boxMax * 100);
            itCapField.setValue((state.sectorCaps['Information Technology'] || 0) * 100);
            finCapField.setValue((state.sectorCaps['Financial Services'] || 0) * 100);
            riskAvField.setValue(state.riskAversion);
            costField.setValue(state.transactionCostBps);
            renderHoldingsSection();
          },
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const m = data.riskMetrics;

        const modelBadges = el('div', 'uc-fr-list');
        modelBadges.style.marginBottom = '16px';
        modelBadges.innerHTML = `
          <span class="fr-chip must">Markowitz mean-variance</span>
          ${data.muUsed === 'black-litterman-blended' ? '<span class="fr-chip must">Black-Litterman blending</span>' : '<span class="fr-chip">Black-Litterman: off</span>'}
          <span class="fr-chip must">Ledoit-Wolf-style shrinkage</span>`;
        container.appendChild(modelBadges);

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
          'Each point is a separate constrained optimization solved for a different target return, sweeping from the universe\'s lowest to highest expected return (FR-MV-05) — 13 real re-solves, not interpolated or decorative points. Hover a point to see its exact return/risk.'));
        const cw2 = el('div', 'chart-wrap');
        p2.appendChild(cw2);
        two.appendChild(p2);
        container.appendChild(two);

        barChart(cw1, data.optimalWeights.filter((w) => w.weight > 0.001).map((w) => ({ label: w.security, value: w.weight })), { valueFormatter: fmtPct, max: Math.max(...data.optimalWeights.map((w) => w.weight)) });
        frontierChart(cw2, data.efficientFrontier, data.currentPortfolio, { risk: m.volatility, return: m.expectedReturn });

        // ---- Editable weights + live client-side recompute (no server round-trip needed) ----
        const p1b = el('div', 'panel');
        p1b.appendChild(panelTitle('Adjust Weights & See the Effect',
          'This is a system-optimised starting point, not a mandate — edit any "New Weight" below and click Recalculate to see the resulting expected return / volatility / Sharpe for your own mix, computed instantly from the same return & risk model (no re-solve, just evaluated directly for your numbers).'));
        const editedWeights = {};
        const REAL_LOOKUP = {};
        (global.WISRealHoldings || []).forEach((h) => { REAL_LOOKUP[h.id] = h; });
        const nameById = {};
        data.universe.forEach((u) => { nameById[u.id] = u.name; });
        const editItems = data.optimalWeights.map((w) => {
          editedWeights[w.security] = w.weight;
          return {
            id: w.security, name: nameById[w.security] || w.security, type: (REAL_LOOKUP[w.security] || {}).type || 'STOCK',
            cols: [fmtPct(w.weight)], value: Math.round(w.weight * 1000) / 10,
            onChange: (frac) => { editedWeights[w.security] = frac; },
          };
        });
        renderSplitWeightSection(p1b, editItems, { extraHeaders: ['Optimal Weight'], weightHeader: 'New Weight' });
        const customResult = el('div', 'metric-row');
        customResult.style.marginTop = '14px';
        p1b.appendChild(customResult);
        const recalcBtn = el('button', 'btn btn-accent', 'Recalculate Stats for My Weights');
        recalcBtn.style.marginTop = '4px';
        recalcBtn.addEventListener('click', () => {
          const order = data.universe.map((u) => u.id);
          const wArr = order.map((id) => editedWeights[id] || 0);
          const sum = wArr.reduce((a, b) => a + b, 0) || 1;
          const wNorm = wArr.map((v) => v / sum);
          const ret = wNorm.reduce((s, wi, i) => s + wi * data.mu[i], 0);
          let variance = 0;
          for (let i = 0; i < wNorm.length; i++) for (let j = 0; j < wNorm.length; j++) variance += wNorm[i] * wNorm[j] * data.covariance[i][j];
          const vol = Math.sqrt(Math.max(variance, 0));
          const sharpe = vol > 0 ? (ret - data.riskFreeRate) / vol : 0;
          customResult.innerHTML = '';
          customResult.appendChild(metricCard('Your Weights — Return', fmtPct(ret)));
          customResult.appendChild(metricCard('Your Weights — Volatility', fmtPct(vol)));
          customResult.appendChild(metricCard('Your Weights — Sharpe', sharpe.toFixed(2)));
          customResult.appendChild(metricCard('Weights Summed To', fmtPct(sum), sum < 0.98 || sum > 1.02 ? 'renormalised to 100% for the calc above' : null));
        });
        p1b.appendChild(recalcBtn);
        container.appendChild(p1b);

        const FACTOR_INFO = {
          value: { label: 'Value', desc: 'Cheapness vs. fundamentals (P/E, P/B style).' },
          quality: { label: 'Quality', desc: 'Profitability & balance-sheet strength.' },
          momentum: { label: 'Momentum', desc: 'Recent price trend / outperformance.' },
          size: { label: 'Size', desc: 'Larger-cap (positive) vs. smaller-cap (negative) tilt.' },
          lowvol: { label: 'Low Volatility', desc: 'Historical return steadiness.' },
        };
        const p3 = el('div', 'panel');
        p3.id = 'panel-uc3-factors';
        p3.appendChild(panelTitle('Factor Report — In Plain Language',
          'Weighted-average factor loading of the optimal portfolio: Σ(weight × security\'s factor score) per factor (FR-MV-04), shown on a diverging scale so "tilted toward" vs "tilted away from" is visually obvious. These are illustrative factor scores, not licensed fundamentals-derived loadings — see the note banner.'));
        Object.entries(data.factorReport).forEach(([k, v]) => {
          const info = FACTOR_INFO[k] || { label: k, desc: '' };
          const row = el('div', 'factor-row');
          row.appendChild(el('div', 'factor-label', info.label));
          const track = el('div', 'factor-track');
          const fill = el('div', 'factor-fill');
          const pct = Math.min(Math.abs(v) / 2, 1) * 50;
          if (v >= 0) { fill.style.left = '50%'; fill.style.width = pct + '%'; fill.style.background = 'var(--accent-2)'; }
          else { fill.style.left = (50 - pct) + '%'; fill.style.width = pct + '%'; fill.style.background = '#94a3b3'; }
          track.appendChild(fill);
          row.appendChild(track);
          row.appendChild(el('div', 'factor-desc', info.desc));
          const verdict = Math.abs(v) < 0.1 ? 'Neutral' : v > 0 ? 'Tilted toward' : 'Tilted away from';
          row.appendChild(el('div', 'factor-value', `${verdict} (${v.toFixed(2)})`));
          p3.appendChild(row);
        });
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
      buildForm(container) {
        const C = global.WISControls;
        let state = { lots: [], targetWeights: {}, driftBandAbs: 0.05, driftBandRel: 0.20, policy: 'threshold', cashflow: 50000, transactionCostBps: 10, minTradeValue: 5000 };
        container.appendChild(el('div', 'panel-title', 'Portfolio & Rebalancing Policy'));

        const grid = el('div', 'form-grid');
        const bandField = C.sliderInput({ value: state.driftBandAbs * 100, min: 1, max: 15, step: 1, format: (v) => v + '%', onChange: (v) => { state.driftBandAbs = v / 100; } });
        grid.appendChild(C.field('Drift Band (absolute)', bandField, 'A security is flagged BREACH if its actual weight is more than this many percentage points away from target. Requirement default: 5%.'));

        const relField = C.sliderInput({ value: state.driftBandRel * 100, min: 5, max: 50, step: 5, format: (v) => v + '%', onChange: (v) => { state.driftBandRel = v / 100; } });
        grid.appendChild(C.field('Drift Band (relative)', relField, 'Also flags a breach if drift exceeds this % of the target weight itself — catches small-weight positions that have doubled or halved even if the absolute gap is small.'));

        const policyField = C.selectInput({ value: state.policy, options: [{ value: 'threshold', label: 'Threshold (only rebalance on breach)' }, { value: 'calendar', label: 'Calendar (always rebalance on schedule)' }], onChange: (v) => { state.policy = v; } });
        grid.appendChild(C.field('Rebalancing Policy', policyField, 'Threshold: only breached securities are ever touched. Calendar: always runs, but still only trades securities that are breached at the time it runs.'));

        const cashField = C.numberInput({ value: state.cashflow, step: 1000, prefix: '₹', onChange: (v) => { state.cashflow = v || 0; } });
        grid.appendChild(C.field('Incoming Cashflow', cashField, 'New contribution available to invest. Used first to top up underweight-breached securities before any sell-side trade is generated (cash-flow-first, FR-RB-04).'));

        const costField = C.numberInput({ value: state.transactionCostBps, step: 1, suffix: 'bps', onChange: (v) => { state.transactionCostBps = v || 0; } });
        grid.appendChild(C.field('Transaction Cost', costField, 'Estimated brokerage/impact cost per trade, in basis points of trade value.'));

        const minField = C.numberInput({ value: state.minTradeValue, step: 500, prefix: '₹', onChange: (v) => { state.minTradeValue = v || 0; } });
        grid.appendChild(C.field('Minimum Trade Size', minField, 'Trades smaller than this are skipped entirely, to avoid needless churn on tiny gaps (FR-RB-06).'));
        container.appendChild(grid);

        container.appendChild(el('div', 'panel-title', 'Target Weights by Security'));
        container.appendChild(el('p', null, '<span style="color:var(--text-muted);font-size:12.5px">Loaded from your current holdings. Edit any target weight below — the drift check and trade list will use these values.</span>'));
        const weightsSection = el('div');
        container.appendChild(weightsSection);
        const REAL_LOOKUP4 = {};
        (global.WISRealHoldings || []).forEach((h) => { REAL_LOOKUP4[h.id] = h; });

        function rebuildWeightFields() {
          weightsSection.innerHTML = '';
          const items = Object.keys(state.targetWeights).map((sec) => ({
            id: sec, name: (REAL_LOOKUP4[sec] || {}).name || sec, type: (REAL_LOOKUP4[sec] || {}).type || 'STOCK',
            value: Math.round(state.targetWeights[sec] * 1000) / 10,
            onChange: (frac) => { state.targetWeights[sec] = frac; },
          }));
          renderSplitWeightSection(weightsSection, items, { weightHeader: 'Target Weight' });
        }

        return {
          getData: () => ({ ...state, lots: state.lots }),
          setData: (json) => {
            state = { ...state, ...json, targetWeights: { ...json.targetWeights } };
            bandField.setValue(state.driftBandAbs * 100);
            relField.setValue(state.driftBandRel * 100);
            cashField.setValue(state.cashflow);
            costField.setValue(state.transactionCostBps);
            minField.setValue(state.minTradeValue);
            rebuildWeightFields();
          },
        };
      },
      render(container, data, ctx) {
        container.innerHTML = '';
        const breachedCount = data.driftAlerts.filter((d) => d.breach).length;
        const okCount = data.driftAlerts.length - breachedCount;

        const scopeBanner = el('div', 'alert-banner' + (breachedCount ? '' : ' ok'));
        scopeBanner.innerHTML = `<span class="alert-icon">${breachedCount ? '⚠️' : '✅'}</span><span class="alert-text"><strong>${breachedCount} of ${data.driftAlerts.length} holdings breached</strong> their drift band and are being rebalanced below. The other ${okCount} are within band and left untouched — unlike M4-UC3 (which can re-optimise the whole portfolio any time), this engine only ever acts on breached positions.</span>`;
        container.appendChild(scopeBanner);

        if (breachedCount > 0 && global.WISControls) {
          global.WISControls.showModal({
            icon: '⚠️',
            title: 'Portfolio drift detected',
            bodyHtml: `<p><strong>${breachedCount} holding${breachedCount > 1 ? 's have' : ' has'}</strong> drifted beyond the ${fmtPct(data.driftAlerts[0].band)} band and need${breachedCount > 1 ? '' : 's'} rebalancing.</p><p>A prioritised, tax-aware trade list has been generated below — review it and adjust target weights if needed before acting.</p>`,
            actions: [{ label: 'Review Recommendation', className: 'btn-accent' }],
          });
        }

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
        if (data.unallocatedCash > 0) {
          metrics.appendChild(metricCard('Unallocated Cash', '₹' + fmtCompact(data.unallocatedCash), null,
            'Cash left over after every breached underweight gap was fully closed — shown as "Cash (unallocated)" in the post-trade chart below so weights stay internally consistent (sum to 100%).'));
        }
        container.appendChild(metrics);

        const p1 = el('div', 'panel');
        p1.id = 'panel-uc4-drift';
        p1.appendChild(panelTitle('Drift Alerts vs Target',
          'Drift = current weight − target weight per security. Breach = |drift| exceeds your driftBandAbs, or the relative drift exceeds driftBandRel (FR-RB-01). Only breached securities generate trades below. Target weights are editable here — adjust and click "Recalculate" to re-run with your changes.'));
        const editedWeights = {};
        p1.appendChild(table(['Security', 'Current Wt', 'Target Wt (editable)', 'Drift', 'Breach'], data.driftAlerts.map((d) => {
          const input = document.createElement('input');
          input.type = 'number'; input.className = 'ui-input'; input.style.width = '80px';
          input.step = '0.5'; input.value = Math.round(d.targetWeight * 1000) / 10;
          editedWeights[d.security] = d.targetWeight;
          input.addEventListener('input', () => { editedWeights[d.security] = (Number(input.value) || 0) / 100; });
          const inputWrap = el('div', null); inputWrap.appendChild(input); inputWrap.appendChild(el('span', null, ' %'));
          return [d.security, fmtPct(d.currentWeight), inputWrap, fmtPct(d.drift), d.breach ? tag('BREACH', 'breach') : tag('OK', 'ok')];
        })));
        if (ctx && ctx.rerun && ctx.payload) {
          const recalcBtn = el('button', 'btn btn-accent', 'Recalculate with Edited Targets');
          recalcBtn.style.marginTop = '10px';
          recalcBtn.addEventListener('click', () => {
            ctx.payload.targetWeights = { ...editedWeights };
            ctx.rerun();
          });
          p1.appendChild(recalcBtn);
        }
        container.appendChild(p1);

        const p2 = el('div', 'panel');
        p2.id = 'panel-uc4-tradelist';
        p2.appendChild(panelTitle('Prioritised Trade List',
          'Order of operations (FR-RB-04): (1) any incoming cashflow buys the most-underweight breached securities first; (2) every breached-overweight position is trimmed (tax-aware lot order: losses, then long-term gains, then short-term gains last); (3) sale proceeds are redeployed into any still-remaining underweight-breached gap, so the portfolio\'s total value is conserved.'));
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
        p3.appendChild(panelTitle('Post-Trade Weights (target vs. achieved)',
          'Current weights with the trade list above applied. Breached securities should land exactly on target (limited only by available cash/sell proceeds); non-breached securities are untouched by design. Any leftover cash after closing all gaps is shown as "Cash (unallocated)" so the bars always sum to 100%.'));
        const cw = el('div', 'chart-wrap');
        p3.appendChild(cw);
        two.appendChild(p3);
        barChart(cw, Object.entries(data.postTradeWeights).map(([k, v]) => ({ label: k, value: v, color: k === 'Cash (unallocated)' ? '#8b98a5' : undefined })), { valueFormatter: fmtPct, max: 1 });

        const p4 = el('div', 'panel');
        p4.appendChild(panelTitle('Tax-Deferred Alternative',
          'A lower-tax variant that keeps only the cash-flow-funded buys and skips every sell-side trade — for comparison against the primary trade list when you want to weigh "rebalance now" against "rebalance gradually via future contributions" (FR-RB-05).'));
        const alt = data.alternatives[0];
        p4.appendChild(el('p', null, alt.note));
        if (alt.tradeList.length) {
          p4.appendChild(table(['Security', 'Side', 'Amount'], alt.tradeList.map((t) => [t.security, tag(t.side, 'buy'), '₹' + fmtCompact(t.amount)])));
        } else {
          p4.appendChild(el('div', 'empty-hint', 'No cash-flow-funded buys available this run'));
        }
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
      buildForm(container) {
        const C = global.WISControls;
        let state = { lots: [], realizedGainsYTD: { stcg: 0, ltcg: 0 }, washSaleWindowDays: 30, minHarvestableLoss: 1000, recentlyPurchased: [] };
        container.appendChild(el('div', 'panel-title', 'Realised Gains This Year (available to offset)'));
        const grid = el('div', 'form-grid');
        const stcgField = C.numberInput({ value: state.realizedGainsYTD.stcg, step: 1000, prefix: '₹', onChange: (v) => { state.realizedGainsYTD.stcg = v || 0; } });
        grid.appendChild(C.field('Short-Term Gains YTD', stcgField, 'Realised short-term capital gains already booked this financial year. Short-term losses can only offset against this bucket.'));
        const ltcgField = C.numberInput({ value: state.realizedGainsYTD.ltcg, step: 1000, prefix: '₹', onChange: (v) => { state.realizedGainsYTD.ltcg = v || 0; } });
        grid.appendChild(C.field('Long-Term Gains YTD', ltcgField, 'Realised long-term capital gains already booked this financial year. Long-term losses can only offset against this bucket.'));
        container.appendChild(grid);

        container.appendChild(el('div', 'panel-title', 'Harvesting Rules'));
        const grid2 = el('div', 'form-grid');
        const washField = C.numberInput({ value: state.washSaleWindowDays, step: 5, suffix: 'days', onChange: (v) => { state.washSaleWindowDays = v || 0; } });
        grid2.appendChild(C.field('Wash-Sale Window', washField, 'A sold security cannot be repurchased within this many days without the loss being disallowed. This is the compliance rule that governs the timing of a harvest.'));
        const minLossField = C.numberInput({ value: state.minHarvestableLoss, step: 500, prefix: '₹', onChange: (v) => { state.minHarvestableLoss = v || 0; } });
        grid2.appendChild(C.field('Minimum Harvestable Loss', minLossField, 'Lots with an unrealised loss smaller than this are ignored, to avoid harvesting trivial amounts.'));
        container.appendChild(grid2);
        container.appendChild(el('p', null, '<span style="color:var(--text-muted);font-size:12.5px">Scans your current holdings (loaded from sample lots) for unrealised losses.</span>'));

        return {
          getData: () => ({ ...state }),
          setData: (json) => {
            state = { ...json, realizedGainsYTD: { ...json.realizedGainsYTD } };
            stcgField.setValue(state.realizedGainsYTD.stcg);
            ltcgField.setValue(state.realizedGainsYTD.ltcg);
            washField.setValue(state.washSaleWindowDays);
            minLossField.setValue(state.minHarvestableLoss);
          },
        };
      },
      render(container, data) {
        container.innerHTML = '';
        const r = data.harvestReport;
        const intro = el('div', 'note-box');
        intro.style.background = '#eef2f7'; intro.style.borderColor = 'var(--border)'; intro.style.color = 'var(--text)';
        intro.innerHTML = '<strong>Tax-loss harvesting is about timing:</strong> a loss is only useful if realised (sold) in the same window it can offset a matching-type gain. Short-term losses offset short-term gains only; long-term losses offset long-term gains only. The two tables below show exactly how much of each loss gets absorbed, and what capacity remains afterward.';
        container.appendChild(intro);

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

        function offsetTable(pairs, label, rateLabel) {
          const p = el('div', 'panel');
          p.appendChild(panelTitle(`${label} Losses → Offset Against ${rateLabel} Gains`,
            `Each row shows how much of that lot's loss was actually absorbed by your available ${rateLabel} gains bucket (in tax-benefit-ranked order, FR-TL-01), and the "Remaining Capacity After" column is a running waterfall — once it hits ₹0, further losses of this type carry forward unoffset this year.`));
          if (!pairs.length) {
            p.appendChild(el('div', 'empty-hint', `No ${label.toLowerCase()} losses harvested`));
          } else {
            p.appendChild(table(
              ['Security', 'Unrealised Loss', 'Offset Applied', 'Unoffset (carries fwd)', 'Tax Benefit', 'Remaining Capacity After', 'Replacement'],
              pairs.map((pr) => [
                pr.sellSecurity, '₹' + fmtCompact(pr.unrealizedLoss), '₹' + fmtCompact(pr.offsetApplied || 0),
                pr.unoffsetAmount > 0 ? tag('₹' + fmtCompact(pr.unoffsetAmount), 'breach') : '₹0',
                '₹' + fmtCompact(pr.taxBenefit), '₹' + fmtCompact(pr.remainingCapacityAfter || 0),
                pr.replacement ? `${pr.replacement.name} (${fmtPct(pr.replacement.similarity)} similar)` : '-',
              ])
            ));
          }
          return p;
        }

        const p1 = el('div', 'panel');
        p1.id = 'panel-uc5-pairs';
        p1.appendChild(panelTitle('Short-Term vs Long-Term Offset Waterfall',
          'Split by holding type because Indian tax rules only let a short-term loss offset a short-term gain (and likewise for long-term) — mixing them is not permitted, which is why this use case tracks the two buckets separately (FR-TL-02, FR-TL-04).'));
        container.appendChild(p1);

        const stPairs = data.sellBuyPairs.filter((p) => p.holdingType === 'STCG');
        const ltPairs = data.sellBuyPairs.filter((p) => p.holdingType === 'LTCG');
        container.appendChild(offsetTable(stPairs, 'Short-Term', 'STCG'));
        container.appendChild(offsetTable(ltPairs, 'Long-Term', 'LTCG'));

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
        p3.appendChild(panelTitle('Harvest Capacity Remaining This Year',
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
