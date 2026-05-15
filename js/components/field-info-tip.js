/**
 * Position info tooltips with fixed layout so they are not clipped by scroll containers.
 */

const scrollHideBound = new WeakSet();

function placeFieldInfoTip(tip) {
  const btn = tip.querySelector('.info-tip-btn');
  const content = tip.querySelector('.info-tip-content');
  if (!btn || !content) return;

  const pad = 8;
  const gap = 6;
  const maxW = Math.min(272, window.innerWidth - pad * 2);

  content.style.visibility = 'hidden';
  content.style.pointerEvents = 'none';
  content.style.width = `${maxW}px`;
  content.style.maxWidth = `${maxW}px`;
  content.style.display = 'block';
  content.style.position = 'fixed';

  const width = content.offsetWidth;
  const height = content.offsetHeight;
  content.style.display = '';

  const btnRect = btn.getBoundingClientRect();
  let left = btnRect.left;
  if (left + width > window.innerWidth - pad) left = window.innerWidth - pad - width;
  if (left < pad) left = pad;

  let top = btnRect.bottom + gap;
  if (top + height > window.innerHeight - pad) {
    top = Math.max(pad, btnRect.top - gap - height);
  }

  content.style.left = `${left}px`;
  content.style.top = `${top}px`;
  content.style.visibility = '';
  content.style.pointerEvents = '';
}

function showFieldInfoTip(tip) {
  placeFieldInfoTip(tip);
  tip.classList.add('is-tip-open');
  const btn = tip.querySelector('.info-tip-btn');
  if (btn) btn.setAttribute('aria-expanded', 'true');
}

function hideFieldInfoTip(tip) {
  tip.classList.remove('is-tip-open');
  const btn = tip.querySelector('.info-tip-btn');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

export function hideAllFieldInfoTips() {
  document.querySelectorAll('.field-info-tip.is-tip-open').forEach(hideFieldInfoTip);
}

function toggleFieldInfoTip(tip) {
  if (tip.classList.contains('is-tip-open')) {
    hideFieldInfoTip(tip);
  } else {
    hideAllFieldInfoTips();
    showFieldInfoTip(tip);
  }
}

function bindScrollHide(container) {
  if (!container || scrollHideBound.has(container)) return;
  scrollHideBound.add(container);
  container.addEventListener('scroll', hideAllFieldInfoTips, { passive: true });
}

let globalListenersBound = false;

function bindGlobalListeners() {
  if (globalListenersBound) return;
  globalListenersBound = true;

  window.addEventListener('resize', () => {
    document.querySelectorAll('.field-info-tip.is-tip-open').forEach(placeFieldInfoTip);
  });

  document.addEventListener('pointerdown', (e) => {
    if (!document.querySelector('.field-info-tip.is-tip-open')) return;
    if (e.target.closest('.field-info-tip')) return;
    hideAllFieldInfoTips();
  }, { capture: true });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideAllFieldInfoTips();
  });
}

/**
 * @param {ParentNode} [root]
 */
export function initFieldInfoTips(root = document) {
  const hoverFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  root.querySelectorAll('.field-info-tip').forEach((tip) => {
    if (tip.dataset.tipInit === 'true') return;
    tip.dataset.tipInit = 'true';

    const btn = tip.querySelector('.info-tip-btn');
    if (!btn) return;

    btn.setAttribute('aria-expanded', 'false');

    let lastToggleAt = 0;

    const onActivate = (e) => {
      if (e.type === 'pointerup' && e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - lastToggleAt < 400) return;
      lastToggleAt = now;
      toggleFieldInfoTip(tip);
    };

    btn.addEventListener('pointerup', onActivate);
    btn.addEventListener('click', onActivate);

    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggleFieldInfoTip(tip);
    });

    if (hoverFinePointer) {
      tip.addEventListener('mouseenter', () => {
        hideAllFieldInfoTips();
        showFieldInfoTip(tip);
      });
      tip.addEventListener('mouseleave', () => hideFieldInfoTip(tip));
    }

    bindScrollHide(tip.closest('.modal'));
    bindScrollHide(tip.closest('.modal-body'));
    bindScrollHide(tip.closest('.content'));
  });

  bindGlobalListeners();
}
