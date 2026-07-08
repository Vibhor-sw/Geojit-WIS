// App shell: left-nav (Module 4 -> 7 sub-modules) + view switching + generic run/render wiring.
// Supports three input modes per use case:
//  - uc.customPage + uc.renderPage(container, api): the use case owns its entire page (used by UC1's
//    goal workspace, which doesn't fit the generic "one form -> one result" shape).
//  - uc.buildForm(container): use case renders its own structured form (text/number/select/slider
//    controls) instead of the raw-JSON textarea, but still uses the generic Load/Run/Tour flow.
//  - default: a JSON textarea (kept as a fallback / "advanced" escape hatch).
(function () {
  const USE_CASES = window.WISUseCases;
  const menuEl = document.getElementById('menu');
  const contentEl = document.getElementById('content');

  const MODULE = {
    key: 'module4',
    title: 'Module 4 — Portfolio Construction & Financial Planning',
    subtitle: 'Goal allocation, optimisation, rebalancing, tax & robo-advisory',
  };

  // ---- Data-access adapter: Node/Express build talks to the API over fetch. ----
  const api = {
    getSampleData: async (uc) => {
      const res = await fetch(uc.api + '/sample');
      return res.json();
    },
    runModel: async (uc, payload) => {
      const res = await fetch(uc.api + '/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      return json;
    },
  };

  function buildSidebar() {
    const moduleItem = document.createElement('div');
    moduleItem.className = 'module-item';

    const header = document.createElement('div');
    header.className = 'module-header';
    header.innerHTML = `<span>${MODULE.title.replace('Module 4 — ', 'Module 4: ')}</span><span class="chevron">▶</span>`;
    moduleItem.appendChild(header);

    const submenu = document.createElement('div');
    submenu.className = 'submenu';
    USE_CASES.forEach((uc) => {
      const item = document.createElement('div');
      item.className = 'submenu-item';
      item.dataset.key = uc.key;
      item.innerHTML = `<span class="uc-tag">${uc.tag}</span><span>${uc.title}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate(uc.key);
      });
      submenu.appendChild(item);
    });
    moduleItem.appendChild(submenu);

    header.addEventListener('click', () => {
      const expanded = header.classList.toggle('expanded');
      submenu.classList.toggle('expanded', expanded);
    });

    menuEl.appendChild(moduleItem);

    // Auto-expand on load so all sub-modules are visible immediately.
    header.classList.add('expanded');
    submenu.classList.add('expanded');
    header.classList.add('active');
  }

  function setActiveSubmenu(key) {
    document.querySelectorAll('.submenu-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.key === key);
    });
  }

  async function navigate(key) {
    const uc = USE_CASES.find((u) => u.key === key);
    if (!uc) return;
    setActiveSubmenu(key);
    window.location.hash = key;
    renderUseCaseShell(uc);
  }

  function renderUseCaseHeader(uc) {
    const header = document.createElement('div');
    header.className = 'uc-header';
    header.innerHTML = `
      <div class="uc-eyebrow">${uc.tag} · Module 4</div>
      <h1 class="uc-title">${uc.title}</h1>
      <p class="uc-objective">${uc.objective}</p>
      <div class="uc-fr-list">${uc.frs.map((f) => `<span class="fr-chip ${f.includes('(Must)') ? 'must' : ''}">${f}</span>`).join('')}</div>
    `;
    contentEl.appendChild(header);

    const note = document.createElement('div');
    note.className = 'note-box';
    note.textContent = 'Running on illustrative sample data (see src/data/sampleData.js) — replace with live vendor feeds (see Data-Source Mapping in the spec) before production use.';
    contentEl.appendChild(note);
  }

  function makeTourButton(uc) {
    const tourBtn = document.createElement('button');
    tourBtn.className = 'btn btn-tour';
    tourBtn.textContent = '🧭 Guided Requirement Walkthrough';
    tourBtn.disabled = true;
    tourBtn.title = 'Run the model first, then walk through each requirement FR-by-FR against what\'s shown on screen.';
    tourBtn.addEventListener('click', () => {
      window.WISCoachmark.start(uc.tour, { tag: `${uc.tag} Requirement Walkthrough` });
    });
    return tourBtn;
  }

  function renderUseCaseShell(uc) {
    contentEl.innerHTML = '';
    renderUseCaseHeader(uc);

    if (uc.customPage) {
      const pageBody = document.createElement('div');
      pageBody.id = 'input-panel'; // coachmark anchors for the input-capture FR target this id
      contentEl.appendChild(pageBody);
      uc.renderPage(pageBody, { ...api, uc, makeTourButton: () => makeTourButton(uc) });
      return;
    }

    const inputPanel = document.createElement('div');
    inputPanel.className = 'panel';
    inputPanel.id = 'input-panel';
    contentEl.appendChild(inputPanel);

    let formApi = null;
    let textarea = null;

    if (uc.buildForm) {
      formApi = uc.buildForm(inputPanel);
    } else {
      inputPanel.appendChild(Object.assign(document.createElement('div'), { className: 'panel-title', textContent: 'Model Input (edit JSON, or load the bundled sample)' }));
      textarea = document.createElement('textarea');
      textarea.className = 'json-input';
      textarea.id = `input-${uc.key}`;
      inputPanel.appendChild(textarea);
    }

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';
    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn btn-secondary';
    loadBtn.textContent = 'Load Sample Data';
    const runBtn = document.createElement('button');
    runBtn.className = 'btn btn-accent';
    runBtn.textContent = 'Run Model';
    const tourBtn = makeTourButton(uc);
    btnRow.appendChild(loadBtn);
    btnRow.appendChild(runBtn);
    btnRow.appendChild(tourBtn);
    inputPanel.appendChild(btnRow);

    const status = document.createElement('div');
    status.className = 'status-line';
    inputPanel.appendChild(status);

    const resultsWrap = document.createElement('div');
    resultsWrap.className = 'results';
    resultsWrap.innerHTML = '<div class="empty-hint">Load the sample data and click "Run Model" to see output.</div>';
    contentEl.appendChild(resultsWrap);

    async function loadSample() {
      status.textContent = 'Loading sample data...';
      status.className = 'status-line';
      try {
        const json = await api.getSampleData(uc);
        if (formApi) formApi.setData(json); else textarea.value = JSON.stringify(json, null, 2);
        status.textContent = 'Sample data loaded.';
        status.className = 'status-line ok';
      } catch (err) {
        status.textContent = 'Failed to load sample: ' + err.message;
        status.className = 'status-line error';
      }
    }

    async function runModel() {
      let payload;
      try {
        payload = formApi ? formApi.getData() : JSON.parse(textarea.value || '{}');
      } catch (err) {
        status.textContent = 'Invalid input: ' + err.message;
        status.className = 'status-line error';
        return;
      }
      status.textContent = 'Running model...';
      status.className = 'status-line';
      runBtn.disabled = true;
      try {
        const started = performance.now();
        const json = await api.runModel(uc, payload);
        const elapsed = Math.round(performance.now() - started);
        status.textContent = `Model executed successfully in ${elapsed}ms.`;
        status.className = 'status-line ok';
        uc.render(resultsWrap, json, { payload, rerun: runModel });
        tourBtn.disabled = !(uc.tour && uc.tour.length);
      } catch (err) {
        status.textContent = 'Error: ' + err.message;
        status.className = 'status-line error';
      } finally {
        runBtn.disabled = false;
      }
    }

    loadBtn.addEventListener('click', loadSample);
    runBtn.addEventListener('click', runModel);

    // Auto-load sample on first open for convenience.
    loadSample();
  }

  buildSidebar();

  const initialKey = window.location.hash ? window.location.hash.slice(1) : null;
  if (initialKey && USE_CASES.find((u) => u.key === initialKey)) {
    navigate(initialKey);
  }
})();
