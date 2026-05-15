/**
 * Clear a numeric field on focus; restore the prior value on blur if left empty.
 */

function defaultIsEmpty(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed === '' || trimmed === '-';
}

/**
 * @param {string} raw
 * @param {{ allowDecimal?: boolean }} [options]
 */
export function sanitizeNumericInputValue(raw, { allowDecimal = false } = {}) {
  const chars = String(raw).split('');
  let out = '';
  let sawDecimal = false;

  for (const ch of chars) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
      continue;
    }
    if (!allowDecimal) {
      if (ch === ',') out += ch;
      continue;
    }
    if ((ch === '.' || ch === ',') && !sawDecimal) {
      out += '.';
      sawDecimal = true;
    }
  }

  return out;
}

function attachNumericInputGuard(input, numericOnly) {
  const allowDecimal = numericOnly === 'decimal';

  input.addEventListener('input', () => {
    const sanitized = sanitizeNumericInputValue(input.value, { allowDecimal });
    if (sanitized === input.value) return;
    const end = input.selectionEnd;
    const removed = input.value.length - sanitized.length;
    input.value = sanitized;
    const nextPos = Math.max(0, (end ?? sanitized.length) - removed);
    input.setSelectionRange(nextPos, nextPos);
  });
}

/**
 * @param {HTMLInputElement} input
 * @param {object} [options]
 * @param {(raw: string, input: HTMLInputElement) => string|null|undefined} [options.formatOnCommit]
 * @param {(input: HTMLInputElement) => void} [options.onRestore]
 * @param {(input: HTMLInputElement) => void} [options.onCommit]
 * @param {(value: string) => boolean} [options.isEmpty]
 * @param {'integer'|'decimal'} [options.numericOnly]
 */
export function attachClearOnFocus(input, options = {}) {
  if (!input) return;

  const {
    formatOnCommit,
    onRestore,
    onCommit,
    isEmpty = defaultIsEmpty,
    numericOnly,
  } = options;

  if (numericOnly) {
    attachNumericInputGuard(input, numericOnly);
  }

  let snapshot = '';

  input.addEventListener('focus', () => {
    snapshot = input.value;
    input.value = '';
  });

  input.addEventListener('blur', () => {
    const raw = input.value;
    if (isEmpty(raw)) {
      input.value = snapshot;
      if (onRestore) onRestore(input);
      return;
    }
    if (formatOnCommit) {
      const formatted = formatOnCommit(raw, input);
      if (formatted != null && formatted !== '') input.value = formatted;
    }
    if (onCommit) onCommit(input);
  });
}
