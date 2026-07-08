// App shell: left-nav (Module 4 -> 7 sub-modules) + view switching + generic run/render wiring.
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

  async function navigate(key) {
    const uc = USE_CASES.find((u) => u.key === key);
    if (!uc) return;
    setActiveSubmenu(key);
    window.location.hash = key;
    renderUseCaseShell(uc);
  }

  function renderUseCaseShell(uc) {
    contentEl.innerHTML = '';

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

    const inputPanel = document.createElement('div');
    inputPanel.className = 'panel';
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
    btnRow.appendChild(loadBtn);
    btnRow.appendChild(runBtn);
    inputPanel.appendChild(btnRow);

    const status = document.createElement('div');
    status.className = 'status-line';
    inputPanel.appendChild(status);
    contentEl.appendChild(inputPanel);

    const resultsWrap = document.createElement('div');
    resultsWrap.className = 'results';
    resultsWrap.innerHTML = '<div class="empty-hint">Load the sample data and click "Run Model" to see output.</div>';
    contentEl.appendChild(resultsWrap);

    async function loadSample() {
      status.textContent = 'Loading sample data...';
      status.className = 'status-line';
      try {
        const res = await fetch(uc.api + '/sample');
        const json = await res.json();
        textarea.value = JSON.stringify(json, null, 2);
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
        payload = JSON.parse(textarea.value || '{}');
      } catch (err) {
        status.textContent = 'Invalid JSON input: ' + err.message;
        status.className = 'status-line error';
        return;
      }
      status.textContent = 'Running model...';
      status.className = 'status-line';
      runBtn.disabled = true;
      try {
        const started = performance.now();
        const res = await fetch(uc.api + '/run', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Request failed');
        const elapsed = Math.round(performance.now() - started);
        status.textContent = `Model executed successfully in ${elapsed}ms.`;
        status.className = 'status-line ok';
        uc.render(resultsWrap, json);
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
