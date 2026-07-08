// Guided requirement walkthrough: a spotlight + tooltip "coachmark" that steps through
// a use case's functional requirements one at a time, highlighting the on-screen element
// that satisfies each one, alongside the exact requirement text from the spec and a plain
// explanation of what was implemented. Lets you cross-check the app against the Word doc
// FR-by-FR instead of guessing whether something was covered.
(function (global) {
  let state = null;

  function ensureOverlay() {
    let overlay = document.getElementById('coachmark-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'coachmark-overlay';
    overlay.className = 'coachmark-overlay';
    const spotlight = document.createElement('div');
    spotlight.className = 'coachmark-spotlight';
    overlay.appendChild(spotlight);
    const card = document.createElement('div');
    card.className = 'coachmark-card';
    card.innerHTML = `
      <div class="coachmark-head">
        <span class="coachmark-badge" id="coachmark-badge"></span>
        <span class="coachmark-status" id="coachmark-status"></span>
        <span class="coachmark-progress" id="coachmark-progress"></span>
        <button class="coachmark-close" id="coachmark-close" aria-label="End walkthrough">&times;</button>
      </div>
      <div class="coachmark-section">
        <div class="coachmark-label">Requirement (per spec)</div>
        <div class="coachmark-text" id="coachmark-requirement"></div>
      </div>
      <div class="coachmark-section coachmark-achieved" id="coachmark-achieved-section">
        <div class="coachmark-label" id="coachmark-achieved-label">Achieved — shown here</div>
        <div class="coachmark-text" id="coachmark-achieved"></div>
      </div>
      <div class="coachmark-foot">
        <button class="btn btn-secondary" id="coachmark-prev">← Prev</button>
        <span class="coachmark-counter" id="coachmark-counter"></span>
        <button class="btn btn-accent" id="coachmark-next">Next →</button>
      </div>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    document.getElementById('coachmark-close').addEventListener('click', stop);
    document.getElementById('coachmark-prev').addEventListener('click', () => go(-1));
    document.getElementById('coachmark-next').addEventListener('click', () => go(1));
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('keydown', onKeydown);
    return overlay;
  }

  function onKeydown(e) {
    if (!state) return;
    if (e.key === 'Escape') stop();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  }

  function findTarget(step) {
    return document.querySelector(step.selector);
  }

  function reposition() {
    if (!state) return;
    const step = state.steps[state.index];
    const target = findTarget(step);
    const overlay = document.getElementById('coachmark-overlay');
    const spotlight = overlay.querySelector('.coachmark-spotlight');
    const card = overlay.querySelector('.coachmark-card');
    if (!target) {
      spotlight.style.display = 'none';
      card.style.top = '90px';
      card.style.left = '50%';
      card.style.transform = 'translateX(-50%)';
      return;
    }
    const rect = target.getBoundingClientRect();
    const pad = 6;
    spotlight.style.display = 'block';
    spotlight.style.top = (rect.top - pad) + 'px';
    spotlight.style.left = (rect.left - pad) + 'px';
    spotlight.style.width = (rect.width + pad * 2) + 'px';
    spotlight.style.height = (rect.height + pad * 2) + 'px';

    const cardHeight = card.offsetHeight || 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    let top;
    if (spaceBelow > cardHeight + 24) top = rect.bottom + 16;
    else if (rect.top > cardHeight + 24) top = rect.top - cardHeight - 16;
    else top = Math.max(16, window.innerHeight - cardHeight - 16);
    let left = Math.min(Math.max(16, rect.left), window.innerWidth - 420);
    card.style.transform = 'none';
    card.style.top = top + 'px';
    card.style.left = left + 'px';
  }

  function render() {
    const step = state.steps[state.index];
    document.getElementById('coachmark-badge').textContent = `${step.fr} · ${step.priority}`;
    const statusEl = document.getElementById('coachmark-status');
    const isFull = step.status === 'full';
    statusEl.textContent = isFull ? '✓ Fully Implemented' : '◐ Partially Implemented';
    statusEl.className = 'coachmark-status ' + (isFull ? 'status-full' : 'status-partial');
    document.getElementById('coachmark-achieved-label').textContent = isFull ? 'Achieved — shown here' : 'Achieved (with a noted gap) — shown here';
    document.getElementById('coachmark-achieved-section').className = 'coachmark-section coachmark-achieved ' + (isFull ? 'achieved-full' : 'achieved-partial');
    document.getElementById('coachmark-requirement').textContent = step.requirement;
    document.getElementById('coachmark-achieved').textContent = step.achieved;
    document.getElementById('coachmark-progress').textContent = state.tag;
    document.getElementById('coachmark-counter').textContent = `${state.index + 1} / ${state.steps.length}`;
    document.getElementById('coachmark-prev').disabled = state.index === 0;
    document.getElementById('coachmark-next').textContent = state.index === state.steps.length - 1 ? 'Finish' : 'Next →';

    const target = findTarget(step);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(reposition, target ? 260 : 0);
  }

  function go(delta) {
    const nextIndex = state.index + delta;
    if (nextIndex < 0) return;
    if (nextIndex >= state.steps.length) { stop(); return; }
    state.index = nextIndex;
    render();
  }

  function start(steps, opts) {
    if (!steps || !steps.length) return;
    stop();
    ensureOverlay();
    state = { steps, index: 0, tag: (opts && opts.tag) || 'Requirement Walkthrough' };
    document.getElementById('coachmark-overlay').classList.add('active');
    render();
  }

  function stop() {
    const overlay = document.getElementById('coachmark-overlay');
    if (overlay) overlay.classList.remove('active');
    state = null;
  }

  global.WISCoachmark = { start, stop };
})(window);
