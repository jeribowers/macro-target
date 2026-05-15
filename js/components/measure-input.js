/**
 * Self-contained measure input: label, numeric field, and attached unit dropdown.
 */

import { attachClearOnFocus, sanitizeNumericInputValue } from './clear-on-focus-input.js';

export function formatMeasureDisplay(value, unit) {
  if (!Number.isFinite(value) || value <= 0) return '';
  if (unit === 'in' || unit === 'kg') {
    return String(Math.round(value * 10) / 10);
  }
  return String(Math.round(value));
}

/**
 * @param {object} options
 * @param {string} options.id - Input element id
 * @param {string} options.label - Visible label
 * @param {{ value: string, label: string }[]} options.units - Unit options
 * @param {string} [options.defaultUnit] - Initially selected unit
 * @param {string|number} [options.value] - Initial field value
 * @param {(value: number, fromUnit: string, toUnit: string) => number|null} [options.convertValue]
 * @param {() => void} [options.onChange] - Value or unit changed
 */
export function createMeasureInput(options) {
  const {
    id,
    label,
    units,
    defaultUnit = units[0]?.value,
    value = '',
    convertValue,
    onChange,
  } = options;

  let currentUnit = defaultUnit;
  const unitLabels = new Map(units.map((u) => [u.value, u.label]));

  const element = document.createElement('div');
  element.className = 'measure-input';

  const labelEl = document.createElement('label');
  labelEl.className = 'measure-input__label';
  labelEl.htmlFor = id;
  labelEl.textContent = label;

  const control = document.createElement('div');
  control.className = 'measure-input__control';

  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.className = 'measure-input__field';
  input.id = id;
  if (value !== '' && value != null && Number.isFinite(Number(value))) {
    input.value = formatMeasureDisplay(Number(value), currentUnit);
  }

  const unitWrap = document.createElement('div');
  unitWrap.className = 'measure-input__unit dropdown';

  const unitTrigger = document.createElement('button');
  unitTrigger.type = 'button';
  unitTrigger.className = 'dropdown-trigger measure-input__unit-trigger';
  unitTrigger.setAttribute('aria-label', `${label} unit`);

  const unitLabelEl = document.createElement('span');
  unitLabelEl.className = 'dropdown-trigger-label';
  unitLabelEl.textContent = unitLabels.get(currentUnit) || currentUnit;

  const caret = document.createElement('span');
  caret.className = 'caret';
  caret.setAttribute('aria-hidden', 'true');

  unitTrigger.appendChild(unitLabelEl);
  unitTrigger.appendChild(caret);

  const unitMenu = document.createElement('div');
  unitMenu.className = 'dropdown-menu right-aligned';

  const unitItems = [];

  function emitChange() {
    if (onChange) onChange();
  }

  function parseFieldValue(raw) {
    if (raw == null || raw === '') return NaN;
    const normalized = String(raw).trim().replace(/,/g, '');
    return Number.parseFloat(normalized);
  }

  function syncUnitMenu() {
    unitItems.forEach(({ item, unitValue }) => {
      const selected = unitValue === currentUnit;
      item.classList.toggle('selected', selected);
      if (selected) unitLabelEl.textContent = unitLabels.get(unitValue) || unitValue;
    });
  }

  function setUnit(nextUnit) {
    if (nextUnit === currentUnit) return;
    const raw = parseFieldValue(input.value);
    if (Number.isFinite(raw) && raw > 0 && convertValue) {
      const converted = convertValue(raw, currentUnit, nextUnit);
      if (converted != null) {
        input.value = formatMeasureDisplay(converted, nextUnit);
      }
    }
    currentUnit = nextUnit;
    syncUnitMenu();
    emitChange();
  }

  units.forEach(({ value: unitValue, label: unitLabel }) => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    item.dataset.value = unitValue;
    item.textContent = unitLabel;
    if (unitValue === currentUnit) item.classList.add('selected');
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      unitMenu.classList.remove('open');
      setUnit(unitValue);
    });
    unitMenu.appendChild(item);
    unitItems.push({ item, unitValue });
  });

  unitTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.dropdown-menu.open').forEach((m) => {
      if (m !== unitMenu) m.classList.remove('open');
    });
    unitMenu.classList.toggle('open');
  });

  unitWrap.appendChild(unitTrigger);
  unitWrap.appendChild(unitMenu);

  input.addEventListener('input', () => {
    const next = sanitizeNumericInputValue(input.value, { allowDecimal: true });
    if (next !== input.value) input.value = next;
    emitChange();
  });

  attachClearOnFocus(input, {
    formatOnCommit: (raw) => {
      const parsed = parseFieldValue(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      return formatMeasureDisplay(parsed, currentUnit);
    },
    onRestore: () => emitChange(),
    onCommit: () => emitChange(),
  });

  control.appendChild(input);
  control.appendChild(unitWrap);
  element.appendChild(labelEl);
  element.appendChild(control);

  function getValue() {
    return parseFieldValue(input.value);
  }

  function getUnit() {
    return currentUnit;
  }

  function setValue(num, unit = currentUnit) {
    if (unit !== currentUnit) {
      currentUnit = unit;
      syncUnitMenu();
    }
    if (num != null && Number.isFinite(num) && num > 0) {
      input.value = formatMeasureDisplay(num, unit);
    } else {
      input.value = '';
    }
  }

  function getMeasurement() {
    return { value: getValue(), unit: getUnit() };
  }

  function setMeasurement(measurement) {
    if (!measurement) {
      input.value = '';
      return;
    }
    setValue(measurement.value, measurement.unit || currentUnit);
  }

  return {
    element,
    input,
    getValue,
    getUnit,
    setUnit,
    setValue,
    getMeasurement,
    setMeasurement,
  };
}
