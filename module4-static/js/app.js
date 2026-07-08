// App shell: left-nav (Module 4 -> 7 sub-modules) + view switching.
// Static build: models run entirely client-side via window.WISModels (see js/models.js) -- no backend/fetch.
(function () {
  const USE_CASES = window.WISUseCases;
  const menuEl = document.getElementById('menu');
  const contentEl = document.getElementById('content');

  const MODULE = {
    key: 'module4',
    title: 'Module 4 — Portfolio Construction & Financial Planning',
    subtitle: 'Goal allocation, optimisation, rebalancing, tax & robo-advisory',
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

  function navigate(key) {
    const uc = USE_CASES.find((u) => u.key === key);
    if (!uc) return;
    setActiveSubmenu(key);
    window.location.hash = key;
    renderUseCaseShell(uc);
  }

  function renderUseCaseShell(uc) {
    contentEl.innerHTML = '';
    const model = window.WISModels[uc.key];

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
    note.textContent = 'Running entirely in your browser on illustrative sample data (see js/models.js) — no backend, no data leaves this page. Replace with live vendor feeds (see Data-Source Mapping in the spec) before production use.';
    contentEl.appendChild(note);

    const inputPanel = document.createElement('div');
    inputPanel.className = 'panel';
    inputPanel.id = 'input-panel';
    inputPanel.innerHTML = `<div class="panel-title">Model Input (edit JSON, or load the bundled sample)</div>`;
    const textarea = document.createElement('textarea');
    textarea.className = 'json-input';
    textarea.id = `input-${uc.key}`;
    inputPanel.appendChild(textarea);

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';
    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn btn-secondary';
    loadBtn.textContent = 'Load Sample Data';
    const runBtn = document.createElement('button');
    runBtn.className = 'btn btn-accent';
    runBtn.textContent = 'Run Model';
    const tourBtn = document.createElement('button');
    tourBtn.className = 'btn btn-tour';
    tourBtn.textContent = '🧭 Guided Requirement Walkthrough';
    tourBtn.disabled = true;
    tourBtn.title = 'Run the model first, then walk through each requirement FR-by-FR against what\'s shown on screen.';
    btnRow.appendChild(loadBtn);
    btnRow.appendChild(runBtn);
    btnRow.appendChild(tourBtn);
    inputPanel.appendChild(btnRow);

    const status = document.createElement('div');
    status.className = 'status-line';
    inputPanel.appendChild(status);
    contentEl.appendChild(inputPanel);

    const resultsWrap = document.createElement('div');
    resultsWrap.className = 'results';
    resultsWrap.innerHTML = '<div class="empty-hint">Load the sample data and click "Run Model" to see output.</div>';
    contentEl.appendChild(resultsWrap);

    function loadSample() {
      try {
        textarea.value = JSON.stringify(model.sample, null, 2);
        status.textContent = 'Sample data loaded.';
        status.className = 'status-line ok';
      } catch (err) {
        status.textContent = 'Failed to load sample: ' + err.message;
        status.className = 'status-line error';
      }
    }

    function runModel() {
      let payload;
      try {
        payload = JSON.parse(textarea.value || '{}');
      } catch (err) {
        status.textContent = 'Invalid JSON input: ' + err.message;
        status.className = 'status-line error';
        return;
      }
      status.textContent = 'Running model...';
      status.className = 'status-line';
      runBtn.disabled = true;
      // Defer to next tick so the "Running..." status paints before the (synchronous, CPU-bound) model runs.
      setTimeout(() => {
        try {
          const started = performance.now();
          const result = model.run(payload);
          const elapsed = Math.round(performance.now() - started);
          status.textContent = `Model executed successfully in ${elapsed}ms (in-browser).`;
          status.className = 'status-line ok';
          uc.render(resultsWrap, result);
          tourBtn.disabled = !(uc.tour && uc.tour.length);
        } catch (err) {
          status.textContent = 'Error: ' + err.message;
          status.className = 'status-line error';
        } finally {
          runBtn.disabled = false;
        }
      }, 10);
    }

    loadBtn.addEventListener('click', loadSample);
    runBtn.addEventListener('click', runModel);
    tourBtn.addEventListener('click', () => {
      window.WISCoachmark.start(uc.tour, { tag: `${uc.tag} Requirement Walkthrough` });
    });

    // Auto-load sample on first open for convenience.
    loadSample();
  }

  buildSidebar();

  const initialKey = window.location.hash ? window.location.hash.slice(1) : null;
  if (initialKey && USE_CASES.find((u) => u.key === initialKey)) {
    navigate(initialKey);
  }
})();
