/**
 * Position info tooltips with fixed layout so they are not clipped by scroll containers.
 */

function placeFieldInfoTip(tip) {
  const btn = tip.querySelector('.info-tip-btn');
  const content = tip.querySelector('.info-tip-content');
  if (!btn || !content) return;

  const pad = 8;
  const gap = 6;
  const maxW = Math.min(272, window.innerWidth - pad * 2);

  const prevVisibility = content.style.visibility;
  const prevPointerEvents = content.style.pointerEvents;
  content.style.visibility = 'hidden';
  content.style.pointerEvents = 'none';
  content.style.width = `${maxW}px`;
  content.style.maxWidth = `${maxW}px`;
  content.style.display = 'block';
  content.style.position = 'fixed';
  content.style.left = '0';
  content.style.top = '0';

  const width = content.offsetWidth;
  const height = content.offsetHeight;
  content.style.visibility = prevVisibility;
  content.style.pointerEvents = prevPointerEvents;
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
}

/**
 * @param {ParentNode} [root]
 */
export function initFieldInfoTips(root = document) {
  root.querySelectorAll('.field-info-tip').forEach((tip) => {
    if (tip.dataset.tipInit === 'true') return;
    tip.dataset.tipInit = 'true';

    const place = () => placeFieldInfoTip(tip);
    tip.addEventListener('mouseenter', place);
    tip.addEventListener('focusin', place);

    const modalBody = tip.closest('.modal-body');
    if (modalBody) {
      modalBody.addEventListener('scroll', place, { passive: true });
    }
  });

  window.addEventListener('resize', () => {
    document.querySelectorAll('.field-info-tip:hover, .field-info-tip:focus-within').forEach((tip) => {
      placeFieldInfoTip(tip);
    });
  });
}
