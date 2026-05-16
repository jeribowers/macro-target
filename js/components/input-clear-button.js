function isNumericOnlyInput(input) {
  if (!input) return true;
  const mode = (input.inputMode || input.getAttribute('inputmode') || '').toLowerCase();
  if (mode === 'numeric' || mode === 'decimal') return true;
  if (input.closest('.measure-input, .serving-size-input, .quantity-input-group')) return true;
  return false;
}

function refreshLucideIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Shows an X control to clear non-numeric text inputs while focused and non-empty.
 * @param {HTMLInputElement} input
 * @param {{ onClear?: (input: HTMLInputElement) => void }} [options]
 */
export function attachInputClearButton(input, options = {}) {
  if (!input || input.type === 'hidden' || input.type === 'checkbox' || input.type === 'radio') return null;
  if (input.dataset.inputClearAttached === 'true') return null;
  if (isNumericOnlyInput(input)) return null;

  input.dataset.inputClearAttached = 'true';

  const wrap = document.createElement('div');
  wrap.className = 'input-with-clear';
  const parent = input.parentNode;
  if (!parent) return null;
  parent.insertBefore(wrap, input);
  wrap.appendChild(input);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'input-clear-btn';
  btn.setAttribute('aria-label', 'Clear');
  btn.hidden = true;
  btn.innerHTML = '<i data-lucide="x" aria-hidden="true"></i>';

  const sync = () => {
    const hasValue = String(input.value ?? '').length > 0;
    const isFocused = document.activeElement === input;
    const showClear = hasValue && isFocused;
    btn.hidden = !showClear;
    wrap.classList.toggle('show-clear', showClear);
  };

  const clearValue = () => {
    input.value = '';
    sync();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    if (options.onClear) options.onClear(input);
  };

  // Keep focus on the input so blur does not hide the button before click/tap lands.
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearValue();
  });

  input.addEventListener('input', sync);
  input.addEventListener('focus', sync);
  input.addEventListener('blur', () => {
    requestAnimationFrame(sync);
  });
  input.__syncInputClear = sync;
  sync();

  wrap.appendChild(btn);
  refreshLucideIcons();

  return { wrap, button: btn, sync };
}

/** Re-show or hide the clear control after programmatic `.value` updates. */
export function syncInputClearButton(input) {
  if (input && typeof input.__syncInputClear === 'function') {
    input.__syncInputClear();
  }
}
