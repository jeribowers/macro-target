import * as sync from './sync-service.js';
import { trackDailyLogFoodAdded, trackFeedbackFailed, trackFeedbackOpened, trackFeedbackSubmitted, trackSessionStart } from './analytics.js';
import { submitFeedback } from './feedback-service.js';
import {
  calculateTargets,
  convertHeightValue,
  convertWeightValue,
  getDefaultMeasureUnits,
  formatActivityLabel,
  isProfileComplete,
  profileLevelToAppKey,
  appKeyToProfileLevel,
  sanitizeProfile,
  targetsMatchFormula,
  targetsByLevelMatchFormula,
  buildTargetsByLevel,
  buildDefaultNewUserProfile,
  ACTIVITY_APP_KEYS,
  createEmptyTargetFieldLocks,
  normalizeTargetFieldLocks,
  inferTargetFieldLocks,
  hasAnyTargetFieldLocks,
} from './profile-calculator.js';
import { createMeasureInput } from './components/measure-input.js';
import { attachClearOnFocus } from './components/clear-on-focus-input.js';
import { attachInputClearButton, syncInputClearButton } from './components/input-clear-button.js';
import { hideAllFieldInfoTips, initFieldInfoTips } from './components/field-info-tip.js';
import { initAlertDismiss } from './components/alert.js';
import { STARTER_FOODS, STARTER_LOG_ENTRIES } from './starter-foods.js';
import {
  renderFoodCategoryBlock,
  renderFoodItemInfo,
  renderFoodLogEmptyRow,
  renderFoodSearchOption,
  renderSwipeRowLogEntry,
} from './templates/dom-templates.js';

const ACTIVITY_LEVELS = {
  low: { calories: 1200, protein: 120, carbs: 115, fat: 45, label: 'Light' },
  medium: { calories: 1700, protein: 121, carbs: 184, fat: 53, label: 'Moderate' },
  high: { calories: 2000, protein: 127, carbs: 234, fat: 61, label: 'Intense' }
};

const SWIPE_DELETE_ICON = '<svg class="swipe-delete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

const FOOD_SERVING_UNITS = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'oz', label: 'oz' },
  { value: 'cup', label: 'cup' },
  { value: 'tbsp', label: 'tbsp' },
  { value: 'tsp', label: 'tsp' },
  { value: 'piece', label: 'piece' },
];

/** Built-in foods merged client-side; starter library is seeded per account in Supabase. */
const DEFAULT_FOODS = [];

let state = {
  currentDate: new Date(),
  activityLevel: 'low',
  defaultActivityLevel: 'low',
  activityLevelsByDate: {},
  dailyLogs: {},
  foods: [], recentSearches: [],
  currentFoodForLog: null, editingFoodId: null,
  editingLogItem: null, defaultCategory: null, logMeal: 'breakfast',
  userProfile: null,
};

let profileDraft = null;
let profileTargetLocks = createEmptyTargetFieldLocks();
let profileSaveTimer = null;

const PROFILE_LEVEL_PREFIX = { low: 'Low', medium: 'Med', high: 'High' };
const PROFILE_MACROS = ['calories', 'fat', 'carbs', 'protein'];

function profileTargetInputId(levelKey, macro) {
  const macroName = macro === 'calories' ? 'Calories' : macro === 'protein' ? 'Protein' : macro === 'carbs' ? 'Carbs' : 'Fat';
  return `profile${PROFILE_LEVEL_PREFIX[levelKey]}${macroName}`;
}

const WEEKLY_WEIGHT_RATE_LB = 0.5;
const LB_TO_KG = 0.453592;

function formatWeeklyWeightRateLabel(unit) {
  if (unit === 'kg') {
    const kg = Math.round(WEEKLY_WEIGHT_RATE_LB * LB_TO_KG * 10) / 10;
    return `~${kg} kg`;
  }
  return `~${WEEKLY_WEIGHT_RATE_LB} lb`;
}

function updateDietGoalHint() {
  const lossEl = document.getElementById('profileDietGoalLossRate');
  const gainEl = document.getElementById('profileDietGoalGainRate');
  if (!lossEl || !gainEl) return;
  const label = formatWeeklyWeightRateLabel(profileWeightInput?.getUnit() || 'kg');
  lossEl.textContent = label;
  gainEl.textContent = label;
}

const profileBodyChange = () => {
  updateDietGoalHint();
  updateProfileTargetsFields();
  scheduleProfileAutoSave();
};

function scheduleProfileAutoSave() {
  const modal = document.getElementById('personalizeModal');
  if (!modal?.classList.contains('active')) return;
  window.clearTimeout(profileSaveTimer);
  profileSaveTimer = window.setTimeout(() => {
    void saveUserProfile({ auto: true });
  }, 400);
}

function syncTargetLockIndicators() {
  ACTIVITY_APP_KEYS.forEach((key) => {
    PROFILE_MACROS.forEach((macro) => {
      const input = document.getElementById(profileTargetInputId(key, macro));
      const group = input?.closest('.profile-target-field');
      if (group) group.classList.toggle('is-locked', Boolean(profileTargetLocks[key]?.[macro]));
    });
  });
  const hint = document.getElementById('profileOverrideHint');
  if (hint) hint.hidden = !hasAnyTargetFieldLocks(profileTargetLocks);
  refreshIcons();
}

function profileTargetFieldChange(inputEl) {
  const level = inputEl?.dataset?.level;
  const macro = inputEl?.dataset?.macro;
  if (!level || !macro || !profileTargetLocks[level]) return;
  const raw = String(inputEl.value ?? '').trim();
  if (!raw || !Number.isFinite(parseMacroInputNumber(raw))) return;
  profileTargetLocks[level][macro] = true;
  syncTargetLockIndicators();
  scheduleProfileAutoSave();
}

function initProfileTargetFieldDecorations() {
  document.querySelectorAll('#profileTargetsLevels input[data-level]').forEach((input) => {
    const group = input.closest('.form-group');
    if (!group || group.classList.contains('profile-target-field')) return;
    group.classList.add('profile-target-field');

    const label = group.querySelector('label');
    if (label && !group.querySelector('.profile-target-label-row')) {
      const labelRow = document.createElement('div');
      labelRow.className = 'profile-target-label-row';
      label.parentNode.insertBefore(labelRow, label);
      labelRow.appendChild(label);
      const icon = document.createElement('i');
      icon.setAttribute('data-lucide', 'pencil');
      icon.className = 'profile-target-lock-icon';
      icon.setAttribute('aria-hidden', 'true');
      labelRow.appendChild(icon);
    }

    const legacyWrap = input.closest('.profile-target-input-wrap');
    if (legacyWrap) {
      legacyWrap.parentNode.insertBefore(input, legacyWrap);
      legacyWrap.remove();
    }
  });
  syncTargetLockIndicators();
}

let profileHeightInput = null;
let profileWeightInput = null;
let createFoodReferenceInput = null;
let editFoodReferenceInput = null;

function initInputClearButtons() {
  ['searchInput', 'editFoodName', 'createFoodName'].forEach((id) => {
    attachInputClearButton(document.getElementById(id));
  });
}

function initClearOnFocusInputs() {
  const foodNumericIds = [
    'editFoodDefaultServingSize',
    'editFoodCalories', 'editFoodCarbs', 'editFoodProtein', 'editFoodFat',
    'createFoodDefaultServingSize',
    'createFoodCalories', 'createFoodCarbs', 'createFoodProtein', 'createFoodFat',
  ];

  const formatNumericCommit = (raw) => {
    const parsed = parseInputNumber(raw);
    return Number.isFinite(parsed) ? formatInputNumber(parsed) : null;
  };

  foodNumericIds.forEach((id) => {
    attachClearOnFocus(document.getElementById(id), {
      formatOnCommit: formatNumericCommit,
      numericOnly: 'decimal',
    });
  });

  attachClearOnFocus(document.getElementById('foodServingSize'), {
    formatOnCommit: formatNumericCommit,
    numericOnly: 'decimal',
    onRestore: () => updateLogFoodPreview(),
    onCommit: () => updateLogFoodPreview(),
  });

  attachClearOnFocus(document.getElementById('profileAge'), {
    formatOnCommit: (raw) => {
      const parsed = parseInputNumber(raw);
      if (!Number.isFinite(parsed)) return null;
      return String(Math.round(parsed));
    },
    numericOnly: 'integer',
    onRestore: () => profileBodyChange(),
    onCommit: () => profileBodyChange(),
  });

  document.querySelectorAll('#profileTargetsLevels input[data-level]').forEach((input) => {
    attachClearOnFocus(input, {
      formatOnCommit: (raw) => formatInputNumber(parseMacroInputNumber(raw)),
      numericOnly: 'integer',
      onCommit: (el) => profileTargetFieldChange(el),
    });
  });
}

function initProfileMeasureInputs() {
  const heightMount = document.getElementById('profileHeightMeasure');
  const weightMount = document.getElementById('profileWeightMeasure');
  if (!heightMount || !weightMount) return;

  const localeUnits = getDefaultMeasureUnits();

  profileHeightInput = createMeasureInput({
    id: 'profileHeight',
    label: 'Height',
    units: [{ value: 'cm', label: 'cm' }, { value: 'in', label: 'in' }],
    defaultUnit: localeUnits.heightUnit,
    convertValue: convertHeightValue,
    onChange: profileBodyChange,
  });
  heightMount.appendChild(profileHeightInput.element);

  profileWeightInput = createMeasureInput({
    id: 'profileWeight',
    label: 'Weight',
    units: [{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }],
    defaultUnit: localeUnits.weightUnit,
    convertValue: convertWeightValue,
    onChange: profileBodyChange,
  });
  weightMount.appendChild(profileWeightInput.element);
}

function syncCreateFoodServingUnitLabel() {
  const unitEl = document.getElementById('createFoodServingUnit');
  if (!unitEl || !createFoodReferenceInput) return;
  unitEl.textContent = getServingUnitLabel(createFoodReferenceInput.getUnit());
}

function syncEditFoodServingUnitLabel() {
  const unitEl = document.getElementById('editFoodServingUnit');
  if (!unitEl || !editFoodReferenceInput) return;
  unitEl.textContent = getServingUnitLabel(editFoodReferenceInput.getUnit());
}

function initCreateFoodReferenceMeasure() {
  const mount = document.getElementById('createFoodReferenceMeasure');
  if (!mount || createFoodReferenceInput) return;

  createFoodReferenceInput = createMeasureInput({
    id: 'createFoodServingSize',
    label: 'Reference Size',
    units: FOOD_SERVING_UNITS,
    defaultUnit: 'g',
    value: 100,
    convertValue: convertServingQuantity,
    onChange: syncCreateFoodServingUnitLabel,
  });
  mount.appendChild(createFoodReferenceInput.element);
  syncCreateFoodServingUnitLabel();
}

function initEditFoodReferenceMeasure() {
  const mount = document.getElementById('editFoodReferenceMeasure');
  if (!mount || editFoodReferenceInput) return;

  editFoodReferenceInput = createMeasureInput({
    id: 'editFoodServingSize',
    label: 'Reference Size',
    units: FOOD_SERVING_UNITS,
    defaultUnit: 'g',
    value: 100,
    convertValue: convertServingQuantity,
    onChange: syncEditFoodServingUnitLabel,
  });
  mount.appendChild(editFoodReferenceInput.element);
  syncEditFoodServingUnitLabel();
}

function getDateKey(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d.toISOString().split('T')[0]; }

function pruneExpiredLocalDailyLogCaches() {
  const cutoff = sync.getDailyLogRetentionCutoffDateKey();
  Object.keys(state.dailyLogs).forEach((key) => {
    if (key < cutoff) delete state.dailyLogs[key];
  });
  const prev = state.activityLevelsByDate || {};
  const next = {};
  Object.entries(prev).forEach(([key, level]) => {
    if (key >= cutoff) next[key] = level;
  });
  if (Object.keys(next).length !== Object.keys(prev).length) {
    state.activityLevelsByDate = next;
    saveState();
  }
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  const integerDigits = Math.trunc(Math.abs(number)).toString().length;
  return number.toLocaleString('en-US', {
    useGrouping: integerDigits >= 4,
    maximumFractionDigits: 10
  });
}

function formatInputNumber(value) {
  return formatNumber(value);
}

function parseInputNumber(value) {
  if (value == null || value === '') return NaN;
  const normalized = String(value).trim().replace(/,/g, '');
  if (normalized === '' || normalized === '-') return NaN;
  return Number.parseFloat(normalized);
}

function parseMacroInputNumber(value) {
  if (value == null || String(value).trim() === '' || String(value).trim() === '-') return 0;
  const parsed = parseInputNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeFood(food) {
  const servingSize = Number(food.servingSize ?? 100) > 0 ? Number(food.servingSize ?? 100) : 100;
  const servingUnit = food.servingUnit || food.unit || 'g';
  const defaultServingSize = Number(food.defaultServingSize ?? food.servingSize ?? 100) > 0
    ? Number(food.defaultServingSize ?? food.servingSize ?? 100)
    : servingSize;
  return { ...food, servingSize, servingUnit, defaultServingSize };
}

function getFoodServingUnit(food) {
  return food?.servingUnit || food?.unit || 'g';
}

function getDefaultServingSize(food) {
  return normalizeFood(food).defaultServingSize;
}

function syncFoodSnapshots(savedFood) {
  const normalized = normalizeFood(savedFood);
  Object.values(state.dailyLogs).forEach((dayLog) => {
    Object.values(dayLog).forEach((items) => {
      items.forEach((item) => {
        if (item.food?.id !== normalized.id) return;
        item.food = { ...normalized };
        item.macros = getMacrosForFood(item.food, item.quantity, item.unit);
      });
    });
  });
}

function getServingUnitLabel(unit) {
  const labels = { g: 'g', ml: 'ml', oz: 'oz', cup: 'cup', tbsp: 'tbsp', tsp: 'teaspoon', piece: 'piece' };
  return labels[unit] || unit;
}

function saveState() {
  sync.saveLocalPreferences({
    recentSearches: state.recentSearches,
    activityLevelsByDate: state.activityLevelsByDate,
  });
}

function getActivityLevelForDate(dateKey) {
  return state.activityLevelsByDate[dateKey] ?? state.defaultActivityLevel ?? 'low';
}

function applyActivityLevelForDate(dateKey) {
  const level = getActivityLevelForDate(dateKey);
  state.activityLevel = level;
  setDropdownValue('activityDropdown', level);
  updateActivityDropdownLabels();
}

function reportError(error, fallback = 'Something went wrong while saving your data.') {
  alert(error?.message || fallback);
}

function reportAuthError(error) {
  const message = document.getElementById('authError');
  if (!message) return;
  message.textContent = error?.message || '';
}

const AUTH_PENDING_KEY = 'macroTrackerAuthPending';

/** When set, closing the Library editor returns to Add to Daily Log with this context. */
let addToLogResume = null;

let suppressAuthGate = false;
let initialAuthSettled = false;
let authListenerRegistered = false;
let isSigningOut = false;
let bootstrappedUserId = null;

function setAuthVisible(showAuth) {
  if (showAuth && (!initialAuthSettled || suppressAuthGate)) return;
  document.documentElement.classList.toggle('show-auth-gate', showAuth);
  const authGate = document.getElementById('authGate');
  const appContainer = document.querySelector('.app-container');
  const loading = document.getElementById('appLoading');
  if (authGate) authGate.hidden = !showAuth;
  if (appContainer) appContainer.hidden = showAuth;
  if (loading && showAuth) loading.hidden = true;
}

function clearAuthPendingFlag() {
  try {
    sessionStorage.removeItem(AUTH_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

function setAuthPendingFlag() {
  try {
    sessionStorage.setItem(AUTH_PENDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

function forceShowAuthGate() {
  clearAuthPendingFlag();
  initialAuthSettled = true;
  suppressAuthGate = false;
  sessionBootstrapInFlight = false;
  document.documentElement.classList.remove('is-auth-callback', 'is-auth-loading', 'is-app-ready');
  document.documentElement.classList.add('show-auth-gate');
  const authGate = document.getElementById('authGate');
  const appContainer = document.querySelector('.app-container');
  const loading = document.getElementById('appLoading');
  if (authGate) authGate.hidden = false;
  if (appContainer) appContainer.hidden = true;
  if (loading) {
    loading.hidden = true;
    loading.removeAttribute('style');
  }
  refreshIcons();
}

function revealAuthGate() {
  endAuthBootstrap();
  forceShowAuthGate();
}

function registerAuthListener() {
  if (authListenerRegistered) return;
  authListenerRegistered = true;
  sync.onAuthStateChange((event, session) => {
    window.setTimeout(() => {
      if (isSigningOut) return;
      if (session) {
        void handleSession(session);
        return;
      }
      if (event === 'SIGNED_OUT') handleSignedOut();
    }, 0);
  });
}

function setAuthBootstrapping(active) {
  if (!active) return;
  document.documentElement.classList.add('is-auth-loading');
  setLoadingVisible(true, { hideApp: true });
}

function beginAuthBootstrap() {
  suppressAuthGate = true;
  setAuthPendingFlag();
  document.documentElement.classList.add('is-auth-callback', 'is-auth-loading');
  setAuthBootstrapping(true);
}

function endAuthBootstrap() {
  suppressAuthGate = false;
}

function handleSignedOut() {
  bootstrappedUserId = null;
  sync.setCurrentUserId(null);
  ['personalizeModal', 'backupDataModal', 'feedbackModal', 'addFoodModal', 'editFoodModal', 'createFoodModal', 'addToLogModal'].forEach((id) => {
    document.getElementById(id)?.classList.remove('active');
  });
  hideAllFieldInfoTips();
  syncModalOpenState();
  reportAuthError({ message: '' });
  forceShowAuthGate();
}

async function performSignOut() {
  if (isSigningOut) return;
  isSigningOut = true;
  handleSignedOut();
  try {
    await sync.signOut();
  } catch (error) {
    reportError(error, 'Sign-out failed.');
  } finally {
    isSigningOut = false;
  }
}

function setLoadingVisible(visible, { hideApp = false } = {}) {
  const loading = document.getElementById('appLoading');
  const authGate = document.getElementById('authGate');
  const appContainer = document.querySelector('.app-container');
  if (loading) {
    loading.hidden = !visible;
    loading.classList.toggle('app-loading--fullscreen', visible && hideApp);
  }
  if (visible && hideApp) {
    if (authGate) authGate.hidden = true;
    if (appContainer) appContainer.hidden = true;
    return;
  }
  if (visible) {
    if (authGate) authGate.hidden = true;
    if (appContainer) appContainer.hidden = false;
    return;
  }
  if (loading) {
    loading.classList.remove('app-loading--fullscreen');
    loading.removeAttribute('style');
  }
}

function showSignedInApp() {
  clearAuthPendingFlag();
  document.documentElement.classList.remove('show-auth-gate');
  suppressAuthGate = false;
  sessionBootstrapInFlight = false;
  const authGate = document.getElementById('authGate');
  const appContainer = document.querySelector('.app-container');
  const loading = document.getElementById('appLoading');
  if (authGate) authGate.hidden = true;
  document.documentElement.classList.remove('is-auth-loading', 'is-auth-callback');
  if (loading) {
    loading.hidden = true;
    loading.classList.remove('app-loading--fullscreen');
    loading.removeAttribute('style');
  }
  document.documentElement.classList.add('is-app-ready');
  if (appContainer) appContainer.hidden = false;
  trackSessionStart();
}

function renderSignedInUi() {
  updateDateDisplay();
  updateMacroDisplay();
  renderFoodLog();
  refreshIcons();
}

async function loadDayLog(dateKey, userId = sync.getCurrentUserId()) {
  if (!userId) return;
  const [dayLog] = await Promise.all([
    sync.fetchLogEntriesForDate(userId, dateKey, state.foods),
    loadDayActivity(dateKey),
  ]);
  state.dailyLogs[dateKey] = dayLog;
}

async function loadDayActivity(dateKey) {
  if (!dateKey) return;
  if (Object.prototype.hasOwnProperty.call(state.activityLevelsByDate, dateKey)) return;

  const userId = sync.getCurrentUserId();
  if (!userId) return;

  const level = await sync.fetchActivityLevelForDate(userId, dateKey);
  if (level) {
    state.activityLevelsByDate[dateKey] = level;
    saveState();
  }
}

async function persistActivityLevelForDate(level, dateKey) {
  const userId = sync.getCurrentUserId();
  if (!userId) return;
  await sync.saveActivityLevelForDate(userId, dateKey, level);
}

const UNIT_CONVERSIONS = { g: 1, ml: 1, oz: 28.35, cup: 240, tbsp: 15, tsp: 5, piece: 100 };

function convertServingQuantity(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  const fromBase = value * (UNIT_CONVERSIONS[fromUnit] || 1);
  const toFactor = UNIT_CONVERSIONS[toUnit] || 1;
  return fromBase / toFactor;
}

function getMacrosForFood(food, quantity, unit) {
  const conversion = UNIT_CONVERSIONS[unit] || 1;
  const grams = quantity * conversion;
  const multiplier = grams / 100;
  return {
    calories: Math.round(food.calories * multiplier * 10) / 10,
    carbs: Math.round(food.carbs * multiplier * 10) / 10,
    protein: Math.round(food.protein * multiplier * 10) / 10,
    fat: Math.round((food.fat || 0) * multiplier * 10) / 10
  };
}

function getCurrentDayLog() {
  const key = getDateKey(state.currentDate);
  if (!state.dailyLogs[key]) {
    state.dailyLogs[key] = { breakfast: [], lunch: [], dinner: [], snack: [] };
  }
  return state.dailyLogs[key];
}

function getDailyLogItemCount(dateKey) {
  const log = state.dailyLogs[dateKey];
  if (!log) return 0;
  return ['breakfast', 'lunch', 'dinner', 'snack'].reduce(
    (sum, category) => sum + (log[category]?.length || 0),
    0,
  );
}

function getTodayTotals() {
  const log = getCurrentDayLog();
  let totals = { calories: 0, carbs: 0, protein: 0, fat: 0 };
  Object.values(log).forEach(items => {
    items.forEach(item => {
      totals.calories += item.macros.calories;
      totals.carbs += item.macros.carbs;
      totals.protein += item.macros.protein;
      totals.fat += item.macros.fat || 0;
    });
  });
  return totals;
}

function getCategoryTotals(category) {
  const log = getCurrentDayLog();
  let totals = { calories: 0, carbs: 0, protein: 0, fat: 0 };
  if (log[category]) {
    log[category].forEach(item => {
      totals.calories += item.macros.calories;
      totals.carbs += item.macros.carbs;
      totals.protein += item.macros.protein;
      totals.fat += item.macros.fat || 0;
    });
  }
  return totals;
}

function getActiveMacroTargets() {
  if (state.userProfile && isProfileComplete(state.userProfile)) {
    const stored = state.userProfile.targetsByLevel?.[state.activityLevel];
    if (state.userProfile.targetsOverridden && stored) return stored;
    const computed = calculateTargets(state.userProfile, state.activityLevel);
    if (computed) return computed;
    if (stored) return stored;
  }
  return ACTIVITY_LEVELS[state.activityLevel];
}

function updateActivityDropdownLabels() {
  const menu = document.getElementById('activityMenu');
  if (!menu) return;
  const keys = ['low', 'medium', 'high'];
  const items = menu.querySelectorAll('.dropdown-item');
  items.forEach((item) => {
    const key = item.dataset.value;
    if (!keys.includes(key)) return;
    item.textContent = formatActivityLabel(key);
  });
  const selected = menu.querySelector(`.dropdown-item[data-value="${state.activityLevel}"]`);
  const labelEl = document.getElementById('activityLabel');
  if (selected && labelEl) labelEl.textContent = selected.textContent;
}

const STACKED_MODAL_IDS = ['personalizeModal', 'backupDataModal'];

function syncModalOpenState() {
  const anyOpen = Boolean(document.querySelector('.modal-overlay.active'));
  document.documentElement.classList.toggle('modal-open', anyOpen);
}

function syncStackedModalScroll(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay?.classList.contains('active')) return;
  const modal = overlay.querySelector('.modal');
  const body = overlay.querySelector('.modal-body');
  if (!modal || !body) return;
  const needsScroll = body.scrollHeight > body.clientHeight + 1;
  modal.classList.toggle('modal--scrollable', needsScroll);
}

function scheduleStackedModalScrollSync(overlayId) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => syncStackedModalScroll(overlayId));
  });
}

function syncAllStackedModalScroll() {
  STACKED_MODAL_IDS.forEach(syncStackedModalScroll);
}

function openModal(id) {
  const overlay = document.getElementById(id);
  overlay?.classList.add('active');
  syncModalOpenState();
  refreshIcons();
  if (STACKED_MODAL_IDS.includes(id)) {
    const body = overlay?.querySelector('.modal-body');
    const modal = overlay?.querySelector('.modal');
    if (body) body.scrollTop = 0;
    if (modal) modal.scrollTop = 0;
    scheduleStackedModalScrollSync(id);
  }
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  overlay?.querySelector('.modal')?.classList.remove('modal--scrollable');
  overlay?.classList.remove('active');
  hideAllFieldInfoTips();
  syncModalOpenState();
}

function showSaveToast(message = 'Targets Saved') {
  const toast = document.getElementById('saveToast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function getCheckedRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}

function readProfileBodyFromForm() {
  return {
    height: { value: profileHeightInput?.getValue() ?? NaN, unit: profileHeightInput?.getUnit() || 'cm' },
    weight: { value: profileWeightInput?.getValue() ?? NaN, unit: profileWeightInput?.getUnit() || 'kg' },
    age: Math.round(parseInputNumber(document.getElementById('profileAge')?.value)),
    sex: getCheckedRadio('profileSex'),
    dietGoal: getCheckedRadio('profileDietGoal') || 'Maintain',
  };
}

function readTargetsByLevelFromForm() {
  const byLevel = {};
  ACTIVITY_APP_KEYS.forEach((key) => {
    byLevel[key] = {
      calories: Math.round(parseMacroInputNumber(document.getElementById(profileTargetInputId(key, 'calories'))?.value)),
      protein: Math.round(parseMacroInputNumber(document.getElementById(profileTargetInputId(key, 'protein'))?.value)),
      carbs: Math.round(parseMacroInputNumber(document.getElementById(profileTargetInputId(key, 'carbs'))?.value)),
      fat: Math.round(parseMacroInputNumber(document.getElementById(profileTargetInputId(key, 'fat'))?.value)),
    };
  });
  return byLevel;
}

function fillTargetsByLevelFields(targetsByLevel) {
  if (!targetsByLevel) return;
  ACTIVITY_APP_KEYS.forEach((key) => {
    const targets = targetsByLevel[key];
    if (!targets) return;
    PROFILE_MACROS.forEach((macro) => {
      const input = document.getElementById(profileTargetInputId(key, macro));
      if (input) input.value = formatInputNumber(targets[macro]);
    });
  });
}

function updateProfileTargetsFields() {
  const body = readProfileBodyFromForm();
  let hasAny = false;
  ACTIVITY_APP_KEYS.forEach((key) => {
    const computed = calculateTargets(body, key);
    if (!computed) return;
    hasAny = true;
    PROFILE_MACROS.forEach((macro) => {
      if (profileTargetLocks[key]?.[macro]) return;
      const input = document.getElementById(profileTargetInputId(key, macro));
      if (input) input.value = formatInputNumber(computed[macro]);
    });
  });
  if (!hasAny) return;
  syncTargetLockIndicators();
  if (document.getElementById('personalizeModal')?.classList.contains('active')) {
    scheduleStackedModalScrollSync('personalizeModal');
  }
}

function getProfileActivityLevelKey() {
  if (profileDraft?.activityLevel) return profileLevelToAppKey(profileDraft.activityLevel);
  if (state.userProfile?.activityLevel) return profileLevelToAppKey(state.userProfile.activityLevel);
  return state.defaultActivityLevel || 'low';
}

function readProfileDraftFromForm() {
  const body = readProfileBodyFromForm();
  const targetsByLevel = readTargetsByLevelFromForm();
  const profileActivityKey = getProfileActivityLevelKey();
  const activityLevel = appKeyToProfileLevel(profileActivityKey);

  const base = {
    height: { value: body.height.value, unit: body.height.unit },
    weight: { value: body.weight.value, unit: body.weight.unit },
    age: body.age,
    sex: body.sex,
    activityLevel,
    dietGoal: body.dietGoal,
    targetsByLevel,
    calculatedTargets: targetsByLevel[profileActivityKey],
    targetsOverridden: hasAnyTargetFieldLocks(profileTargetLocks),
    targetFieldLocks: profileTargetLocks,
  };
  return sanitizeProfile(base) || base;
}

function fillProfileFormFromDraft(draft) {
  const d = draft || {};
  const age = document.getElementById('profileAge');
  profileHeightInput?.setMeasurement(d.height);
  profileWeightInput?.setMeasurement(d.weight);
  if (age) age.value = d.age != null && Number.isFinite(d.age) ? String(d.age) : '';
  const sex = d.sex || 'F';
  document.querySelectorAll('input[name="profileSex"]').forEach((el) => { el.checked = el.value === sex; });
  const goal = d.dietGoal || 'Maintain';
  document.querySelectorAll('input[name="profileDietGoal"]').forEach((el) => { el.checked = el.value === goal; });
  const byLevel = d.targetsByLevel || buildTargetsByLevel(d, null, d.calculatedTargets);
  fillTargetsByLevelFields(byLevel);
  const bodyForLocks = {
    height: d.height,
    weight: d.weight,
    age: d.age,
    sex: d.sex,
    dietGoal: d.dietGoal,
  };
  profileTargetLocks = d.targetFieldLocks
    ? normalizeTargetFieldLocks(JSON.parse(JSON.stringify(d.targetFieldLocks)))
    : (d.targetsOverridden
      ? inferTargetFieldLocks(bodyForLocks, byLevel)
      : createEmptyTargetFieldLocks());
  syncTargetLockIndicators();
  updateDietGoalHint();
}

function updateProfilePreview() {
  profileDraft = readProfileDraftFromForm();
  updateProfileTargetsFields();
}

function openPersonalizeModal() {
  profileDraft = state.userProfile
    ? JSON.parse(JSON.stringify(state.userProfile))
    : (buildDefaultNewUserProfile(state.defaultActivityLevel) || {
      height: { value: 170, unit: 'cm' },
      weight: { value: 70, unit: 'kg' },
      age: 30,
      sex: 'F',
      activityLevel: appKeyToProfileLevel(state.defaultActivityLevel),
      dietGoal: 'Maintain',
      targetsOverridden: false,
    });
  fillProfileFormFromDraft(profileDraft);
  updateProfilePreview();
  openModal('personalizeModal');
  void saveUserProfile({ auto: true });
}

function resetProfileTargetsToFormula() {
  profileTargetLocks = createEmptyTargetFieldLocks();
  const body = readProfileBodyFromForm();
  const byLevel = {};
  let hasAny = false;
  ACTIVITY_APP_KEYS.forEach((key) => {
    const computed = calculateTargets(body, key);
    if (computed) {
      byLevel[key] = computed;
      hasAny = true;
    }
  });
  if (!hasAny) {
    reportError({ message: 'Enter valid height, weight, and age to calculate targets.' });
    return;
  }
  fillTargetsByLevelFields(byLevel);
  syncTargetLockIndicators();
  profileDraft = readProfileDraftFromForm();
  void saveUserProfile({ auto: true });
}

async function saveUserProfile(options = {}) {
  const { closeModal: shouldClose = false, showToast = false, auto = false } = options;
  const body = readProfileBodyFromForm();
  const targetsByLevel = readTargetsByLevelFromForm();
  const profileActivityKey = profileDraft?.activityLevel
    ? profileLevelToAppKey(profileDraft.activityLevel)
    : (state.userProfile?.activityLevel ? profileLevelToAppKey(state.userProfile.activityLevel) : state.defaultActivityLevel);
  const computed = calculateTargets(body, profileActivityKey);
  if (!computed) {
    if (!auto) reportError({ message: 'Please enter valid height, weight, age, and gender.' });
    return;
  }
  const profileBody = {
    ...body,
    activityLevel: appKeyToProfileLevel(profileActivityKey),
  };
  const overridden = hasAnyTargetFieldLocks(profileTargetLocks)
    || !targetsByLevelMatchFormula(profileBody, targetsByLevel);
  const profile = sanitizeProfile({
    height: body.height,
    weight: body.weight,
    age: body.age,
    sex: body.sex,
    dietGoal: body.dietGoal,
    activityLevel: appKeyToProfileLevel(profileActivityKey),
    targetsByLevel,
    calculatedTargets: targetsByLevel[profileActivityKey],
    targetsOverridden: overridden,
    targetFieldLocks: profileTargetLocks,
  });
  if (!profile) {
    if (!auto) reportError({ message: 'Could not save your profile. Check your inputs.' });
    return;
  }

  state.userProfile = profile;
  state.defaultActivityLevel = profileLevelToAppKey(profile.activityLevel);
  sync.writeUserProfile(profile);
  profileDraft = profile;

  const userId = sync.getCurrentUserId();
  try {
    if (userId) await sync.saveUserProfile(userId, profile, state.defaultActivityLevel);
    applyActivityLevelForDate(getDateKey(state.currentDate));
    updateMacroDisplay();
    if (shouldClose) closeModal('personalizeModal');
    if (showToast) showSaveToast();
  } catch (error) {
    reportError(error, 'Could not save your targets.');
  }
}

function updateMacroDisplay() {
  const targets = getActiveMacroTargets();
  const totals = getTodayTotals();
  function updateMacro(id, current, target) {
    const remaining = target - current;
    const remainingPercentage = target > 0
      ? Math.max(0, Math.min((remaining / target) * 100, 100))
      : 0;
    const valueEl = document.getElementById(id);
    valueEl.textContent = formatNumber(Math.round(remaining));
    valueEl.classList.toggle('is-negative', remaining < 0);
    document.getElementById(id.replace('Value', 'Bar')).style.width = remainingPercentage + '%';
    document.getElementById(id.replace('Value', 'Used')).textContent = formatNumber(Math.round(current));
    document.getElementById(id.replace('Value', 'Target')).textContent = formatNumber(Math.round(target));
  }
  updateMacro('calorieValue', totals.calories, targets.calories);
  updateMacro('carbValue', totals.carbs, targets.carbs);
  updateMacro('proteinValue', totals.protein, targets.protein);
  updateMacro('fatValue', totals.fat, targets.fat);
}

function renderMacroLine(calories, carbs, protein, fat, muted = false) {
  const cls = muted ? 'macro-line muted' : 'macro-line';
  return `<span class="${cls}"><span class="cal">${formatNumber(Math.round(calories))} cal</span><span class="sep">•</span><span class="fat">${formatNumber(Math.round(fat))}g fat</span><span class="sep">•</span><span class="carb">${formatNumber(Math.round(carbs))}g carbs</span><span class="sep">•</span><span class="prot">${formatNumber(Math.round(protein))}g protein</span></span>`;
}

function renderMacroBadges(calories, carbs, protein, fat, shortLabels = false) {
  const carbLabel = shortLabels ? 'carb' : 'carbs';
  const protLabel = shortLabels ? 'pro' : 'protein';
  return `<span class="macro-line macro-badge-row"><span class="macro-badge cal">${formatNumber(Math.round(calories))} cal</span><span class="macro-badge fat">${formatNumber(Math.round(fat))}g fat</span><span class="macro-badge carb">${formatNumber(Math.round(carbs))}g ${carbLabel}</span><span class="macro-badge prot">${formatNumber(Math.round(protein))}g ${protLabel}</span></span>`;
}

function renderFoodLogMacroLine(calories, carbs, protein, fat) {
  return `<span class="macro-line"><span class="cal">${formatNumber(Math.round(calories))} cal</span><span class="sep">•</span><span class="fat">${formatNumber(Math.round(fat))}g fat</span><span class="sep">•</span><span class="carb">${formatNumber(Math.round(carbs))}g carb</span><span class="sep">•</span><span class="prot">${formatNumber(Math.round(protein))}g pro</span></span>`;
}

function renderFoodItemInfoBlock(name, weightLabel, macros) {
  return renderFoodItemInfo(
    name,
    weightLabel,
    renderFoodLogMacroLine(macros.calories, macros.carbs, macros.protein, macros.fat || 0),
  );
}

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function renderFoodLog() {
  const log = getCurrentDayLog();
  const content = document.getElementById('content');
  let html = '';
  ['breakfast', 'lunch', 'dinner', 'snack'].forEach(category => {
    const catTotals = getCategoryTotals(category);
    let listBodyHtml = '';
    if (log[category].length > 0) {
      listBodyHtml = log[category].map((item, idx) =>
        renderSwipeRowLogEntry({
          category,
          index: idx,
          foodName: item.food.name,
          foodInfoHtml: renderFoodItemInfoBlock(item.food.name, `${formatNumber(item.quantity)}${item.unit}`, item.macros),
          deleteIconHtml: SWIPE_DELETE_ICON,
        }),
      ).join('');
    } else {
      listBodyHtml = renderFoodLogEmptyRow();
    }
    html += renderFoodCategoryBlock({
      category,
      categoryTotalsHtml: renderMacroBadges(catTotals.calories, catTotals.carbs, catTotals.protein, catTotals.fat, true),
      listBodyHtml,
    });
  });
  content.innerHTML = html;
  refreshIcons();
}

function openAddFoodModal(defaultCategory = null) {
  state.editingFoodId = null;
  state.defaultCategory = defaultCategory || 'breakfast';
  document.getElementById('addFoodModal').classList.add('active');
  syncModalOpenState();
  document.getElementById('searchInput').value = '';
  searchFoods('');
}
function closeAddFoodModal() {
  document.getElementById('addFoodModal').classList.remove('active');
  syncModalOpenState();
}

function isBuiltInFood(foodId) {
  return DEFAULT_FOODS.some(f => f.id === foodId);
}

async function deleteFoodById(foodId) {
  if (!foodId) return;
  if (isBuiltInFood(foodId)) {
    alert('Built-in foods cannot be deleted.');
    return;
  }
  const food = state.foods.find(f => f.id === foodId);
  if (!food) return;
  if (!confirm(`Delete "${food.name}" from Library? Existing foods already added will stay in your Daily Logs.`)) return;
  try {
    await sync.deleteCustomFood(sync.getCurrentUserId(), food);
    state.foods = state.foods.filter(f => f.id !== foodId);
    state.recentSearches = state.recentSearches.filter(id => id !== foodId);
    if (addToLogResume?.foodId === foodId) {
      addToLogResume = null;
      closeAddToLogModal();
    }
    if (state.editingFoodId === foodId) closeEditFoodModal();
    saveState();
    if (document.getElementById('addFoodModal').classList.contains('active')) {
      searchFoods(document.getElementById('searchInput').value);
    }
    updateMacroDisplay();
    renderFoodLog();
  } catch (error) {
    reportError(error);
  }
}

function searchFoods(query) {
  const results = state.foods.filter(f => 
    f.name.toLowerCase().includes(query.toLowerCase())
  );
  const sorted = results.sort((a, b) => a.name.localeCompare(b.name));
  let html = '';
  sorted.forEach(food => {
    const displayFood = normalizeFood(food);
    const unit = getFoodServingUnit(displayFood);
    const servingSize = displayFood.defaultServingSize;
    const measure = `${formatNumber(servingSize)}${unit}`;
    const servingMacros = getMacrosForFood(displayFood, servingSize, unit);
    html += renderFoodSearchOption({
      foodId: food.id,
      foodName: food.name,
      foodInfoHtml: renderFoodItemInfoBlock(food.name, measure, servingMacros),
      deleteIconHtml: SWIPE_DELETE_ICON,
      isBuiltIn: isBuiltInFood(food.id),
    });
  });
  document.getElementById('searchResults').innerHTML = html || `<div class="empty-state"><img class="empty-state__illustration" src="assets/empty-states/search.png" alt=""><h3 class="empty-state__title">No foods found</h3><p class="empty-state__body">Search or add a new food above.</p></div>`;
  refreshIcons();
}

function selectFoodForLog(foodId) {
  const food = state.foods.find(f => f.id === foodId);
  if (food) {
    const searchQuery = document.getElementById('searchInput')?.value?.trim() || '';
    state.pendingLogAnalyticsSource = searchQuery ? 'search' : 'library';
    state.currentFoodForLog = food;
    state.editingLogItem = null;
    if (!state.recentSearches.includes(foodId)) {
      state.recentSearches.unshift(foodId);
      state.recentSearches = state.recentSearches.slice(0, 3);
    }
    saveState();
    closeAddFoodModal();
    openAddToLogModal();
  }
}

function updateEditFoodModalActions() {
  const deleteFromDatabaseBtn = document.getElementById('deleteFromDatabase');
  const deleteFooter = document.getElementById('editFoodDeleteFooter');
  const showDelete = Boolean(state.editingFoodId) && !isBuiltInFood(state.editingFoodId);
  if (deleteFromDatabaseBtn) deleteFromDatabaseBtn.hidden = !showDelete;
  if (deleteFooter) deleteFooter.hidden = !showDelete;
}

function editFoodInDB(foodId, options = {}) {
  if (!options.preserveAddToLogReturn) {
    addToLogResume = null;
  }
  const food = state.foods.find(f => f.id === foodId);
  if (food) {
    state.editingFoodId = foodId;
    document.getElementById('editFoodName').value = food.name;
    syncInputClearButton(document.getElementById('editFoodName'));
    editFoodReferenceInput?.setMeasurement({
      value: food.servingSize || 100,
      unit: food.servingUnit || 'g',
    });
    syncEditFoodServingUnitLabel();
    document.getElementById('editFoodDefaultServingSize').value = formatInputNumber(getDefaultServingSize(food));
    const servingMacros = getMacrosForFood(food, food.servingSize || 100, food.servingUnit || 'g');
    document.getElementById('editFoodCalories').value = formatInputNumber(servingMacros.calories);
    document.getElementById('editFoodCarbs').value = formatInputNumber(servingMacros.carbs);
    document.getElementById('editFoodProtein').value = formatInputNumber(servingMacros.protein);
    document.getElementById('editFoodFat').value = formatInputNumber(servingMacros.fat);
    updateEditFoodModalActions();
    document.getElementById('editFoodModal').classList.add('active');
    syncModalOpenState();
  }
}

function closeEditFoodModal() {
  const resumeContext = addToLogResume;
  const shouldResumeAddToLog = resumeContext?.foodId && resumeContext.foodId === state.editingFoodId;
  document.getElementById('editFoodModal').classList.remove('active');
  state.editingFoodId = null;
  updateEditFoodModalActions();
  if (shouldResumeAddToLog) {
    resumeAddToLogAfterFoodEdit(resumeContext);
    return;
  }
  addToLogResume = null;
  syncModalOpenState();
}

function hideAddToLogModal() {
  document.getElementById('addToLogModal').classList.remove('active');
  syncModalOpenState();
}

function resumeAddToLogAfterFoodEdit(context = addToLogResume) {
  if (!context) return;
  addToLogResume = null;
  const food = state.foods.find((f) => f.id === context.foodId);
  if (!food) {
    closeAddToLogModal();
    return;
  }
  state.currentFoodForLog = food;
  state.editingLogItem = context.editingLogItem
    ? { category: context.editingLogItem.category, idx: context.editingLogItem.idx }
    : null;
  state.logMeal = context.logMeal || 'breakfast';
  document.getElementById('addToLogModal').classList.add('active');
  syncModalOpenState();
  setDropdownValue('logMealDropdown', state.logMeal);
  updateAddToLogModalActions();
  const libraryUnit = getFoodServingUnit(food);
  let quantity = context.quantity ?? getDefaultServingSize(food);
  if (context.unit && context.unit !== libraryUnit) {
    quantity = convertServingQuantity(quantity, context.unit, libraryUnit);
  }
  setLogServingFields(food, quantity, libraryUnit);
  updateLogFoodPreview();
  refreshIcons();
}

function openEditFoodFromAddToLog() {
  const food = state.currentFoodForLog;
  if (!food?.id || isBuiltInFood(food.id)) return;
  const quantity = parseInputNumber(document.getElementById('foodServingSize').value) || getDefaultServingSize(food);
  let unit = getFoodServingUnit(food);
  if (state.editingLogItem) {
    const item = getCurrentDayLog()[state.editingLogItem.category]?.[state.editingLogItem.idx];
    if (item?.unit) unit = item.unit;
  }
  addToLogResume = {
    foodId: food.id,
    editingLogItem: state.editingLogItem
      ? { category: state.editingLogItem.category, idx: state.editingLogItem.idx }
      : null,
    quantity,
    unit,
    logMeal: state.logMeal || getDropdownValue('logMealDropdown') || state.defaultCategory || 'breakfast',
  };
  hideAddToLogModal();
  editFoodInDB(food.id, { preserveAddToLogReturn: true });
}

async function saveEditedFood() {
  const userId = sync.getCurrentUserId();
  if (!userId) {
    // Edit Saved Food: saving persists to the cloud; this runs if there is no active session (signed out or session expired).
    reportError(new Error('Sign in to save changes to your Food Library.'));
    return;
  }
  const name = document.getElementById('editFoodName').value.trim();
  const reference = editFoodReferenceInput?.getMeasurement() ?? {};
  const servingSize = reference.value;
  const servingUnit = reference.unit;
  const defaultServingSize = parseInputNumber(document.getElementById('editFoodDefaultServingSize').value);
  const caloriesPerServing = parseMacroInputNumber(document.getElementById('editFoodCalories').value);
  const carbsPerServing = parseMacroInputNumber(document.getElementById('editFoodCarbs').value);
  const proteinPerServing = parseMacroInputNumber(document.getElementById('editFoodProtein').value);
  const fatPerServing = parseMacroInputNumber(document.getElementById('editFoodFat').value);
  if (!name || isNaN(servingSize) || servingSize <= 0 || !servingUnit || isNaN(defaultServingSize) || defaultServingSize <= 0) { alert('Please fill in all required fields. Reference size and serving size must be greater than 0.'); return; }
  const servingBase = servingSize * (UNIT_CONVERSIONS[servingUnit] || 1);
  if (!Number.isFinite(servingBase) || servingBase <= 0) {
    alert('Reference size must be greater than 0.');
    return;
  }
  const toPer100 = 100 / servingBase;
  const foodIdx = state.foods.findIndex(f => f.id === state.editingFoodId);
  if (foodIdx === -1) return;
  const updatedFood = normalizeFood({
    ...state.foods[foodIdx],
    name,
    servingSize,
    servingUnit,
    defaultServingSize,
    calories: Math.round((caloriesPerServing * toPer100) * 10) / 10,
    carbs: Math.round((carbsPerServing * toPer100) * 10) / 10,
    protein: Math.round((proteinPerServing * toPer100) * 10) / 10,
    fat: Math.round((fatPerServing * toPer100) * 10) / 10
  });
  try {
    const savedFood = await sync.upsertFood(userId, updatedFood);
    const builtInIds = new Set(DEFAULT_FOODS.map((food) => food.id));
    const mergedFood = sync.replaceFoodInLibrary(state.foods, savedFood, builtInIds, normalizeFood);
    syncFoodSnapshots(mergedFood);
    saveState();
    const shouldResumeAddToLog = addToLogResume?.foodId === mergedFood.id;
    if (shouldResumeAddToLog) {
      state.currentFoodForLog = mergedFood;
    }
    closeEditFoodModal();
    if (!shouldResumeAddToLog && document.getElementById('addFoodModal').classList.contains('active')) {
      searchFoods(document.getElementById('searchInput').value);
    }
    updateMacroDisplay();
    renderFoodLog();
  } catch (error) {
    reportError(error);
  }
}

function getSwipeActionGap() {
  const val = getComputedStyle(document.documentElement).getPropertyValue('--swipe-action-gap').trim();
  const parsed = parseFloat(val);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

function getRowSwipeRevealWidth(row) {
  if (!row) return 48;
  return row.offsetHeight + getSwipeActionGap();
}

function setRowSwipeReveal(row) {
  if (!row) return;
  row.style.setProperty('--swipe-row-reveal', `${getRowSwipeRevealWidth(row)}px`);
}

function initSwipeToDelete(container, onDelete) {
  if (!container || container.dataset.swipeBound === 'true') return;
  container.dataset.swipeBound = 'true';

  let activeSwipe = null;

  function closeOpenRows(except) {
    container.querySelectorAll('.swipe-row.is-open').forEach((row) => {
      if (row !== except) {
        row.classList.remove('is-open');
        row.style.removeProperty('--swipe-row-reveal');
      }
    });
  }

  container.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.swipe-delete');
    if (deleteBtn) {
      e.preventDefault();
      onDelete(deleteBtn);
      return;
    }
    const row = e.target.closest('.swipe-row[data-deletable="true"]');
    if (row && row.dataset.swipeMoved === 'true') {
      e.preventDefault();
      e.stopPropagation();
      delete row.dataset.swipeMoved;
    }
  });

  container.addEventListener('pointerdown', (e) => {
    const content = e.target.closest('.swipe-row[data-deletable="true"] .swipe-content');
    if (!content || e.target.closest('button')) return;
    const row = content.closest('.swipe-row');
    const revealWidth = getRowSwipeRevealWidth(row);
    activeSwipe = {
      row,
      content,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      revealWidth,
      revealThreshold: Math.round(revealWidth * 0.45),
      offset: row.classList.contains('is-open') ? -revealWidth : 0,
      moved: false,
      dragAxis: null
    };
    content.setPointerCapture(e.pointerId);
  });

  container.addEventListener('pointermove', (e) => {
    if (!activeSwipe || e.pointerId !== activeSwipe.pointerId) return;
    const deltaX = e.clientX - activeSwipe.startX;
    const deltaY = e.clientY - activeSwipe.startY;
    if (!activeSwipe.dragAxis && (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)) {
      activeSwipe.dragAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }
    if (activeSwipe.dragAxis !== 'x') return;
    activeSwipe.moved = true;
    const { revealWidth } = activeSwipe;
    const offset = Math.max(-revealWidth, Math.min(0, activeSwipe.offset + deltaX));
    activeSwipe.content.style.transform = `translateX(${offset}px)`;
  });

  function finishSwipe(e) {
    if (!activeSwipe || e.pointerId !== activeSwipe.pointerId) return;
    const { row, content, moved, offset, startX, dragAxis, revealWidth, revealThreshold } = activeSwipe;
    content.style.transform = '';
    if (content.hasPointerCapture(e.pointerId)) content.releasePointerCapture(e.pointerId);
    if (moved && dragAxis === 'x') {
      row.dataset.swipeMoved = 'true';
      const deltaX = e.clientX - startX;
      const endOffset = Math.max(-revealWidth, Math.min(0, offset + deltaX));
      if (endOffset <= -revealThreshold) {
        closeOpenRows(row);
        setRowSwipeReveal(row);
        row.classList.add('is-open');
      } else {
        row.classList.remove('is-open');
        row.style.removeProperty('--swipe-row-reveal');
      }
    }
    activeSwipe = null;
  }

  container.addEventListener('pointerup', finishSwipe);
  container.addEventListener('pointercancel', finishSwipe);
}

function openCreateFoodModal(prefillName = '') {
  closeAddFoodModal();
  document.getElementById('createFoodName').value = prefillName.trim();
  syncInputClearButton(document.getElementById('createFoodName'));
  createFoodReferenceInput?.setMeasurement({ value: 100, unit: 'g' });
  syncCreateFoodServingUnitLabel();
  document.getElementById('createFoodDefaultServingSize').value = '100';
  document.getElementById('createFoodCalories').value = '';
  document.getElementById('createFoodCarbs').value = '';
  document.getElementById('createFoodProtein').value = '';
  document.getElementById('createFoodFat').value = '';
  const addToLogCheckbox = document.getElementById('createFoodAddToLog');
  if (addToLogCheckbox) addToLogCheckbox.checked = true;
  document.getElementById('createFoodModal').classList.add('active');
  syncModalOpenState();
}
function closeCreateFoodModal() {
  document.getElementById('createFoodModal').classList.remove('active');
  syncModalOpenState();
}

async function saveCreatedFood() {
  const name = document.getElementById('createFoodName').value.trim();
  const reference = createFoodReferenceInput?.getMeasurement() ?? {};
  const servingSize = reference.value;
  const servingUnit = reference.unit;
  const defaultServingSize = parseInputNumber(document.getElementById('createFoodDefaultServingSize').value);
  const caloriesPerServing = parseMacroInputNumber(document.getElementById('createFoodCalories').value);
  const carbsPerServing = parseMacroInputNumber(document.getElementById('createFoodCarbs').value);
  const proteinPerServing = parseMacroInputNumber(document.getElementById('createFoodProtein').value);
  const fatPerServing = parseMacroInputNumber(document.getElementById('createFoodFat').value);
  if (!name || isNaN(servingSize) || servingSize <= 0 || !servingUnit || isNaN(defaultServingSize) || defaultServingSize <= 0) { alert('Please fill in all required fields. Reference size and serving size must be greater than 0.'); return; }
  const servingBase = servingSize * (UNIT_CONVERSIONS[servingUnit] || 1);
  if (!Number.isFinite(servingBase) || servingBase <= 0) {
    alert('Reference size must be greater than 0.');
    return;
  }
  const toPer100 = 100 / servingBase;
  const newFood = normalizeFood({
    id: 'custom_' + Date.now(),
    name,
    servingSize,
    servingUnit,
    defaultServingSize,
    calories: Math.round((caloriesPerServing * toPer100) * 10) / 10,
    carbs: Math.round((carbsPerServing * toPer100) * 10) / 10,
    protein: Math.round((proteinPerServing * toPer100) * 10) / 10,
    fat: Math.round((fatPerServing * toPer100) * 10) / 10
  });
  const addToLog = document.getElementById('createFoodAddToLog')?.checked ?? true;
  try {
    const savedFood = await sync.upsertFood(sync.getCurrentUserId(), newFood);
    const normalized = normalizeFood(savedFood);
    state.foods.push(normalized);
    if (!state.recentSearches.includes(savedFood.id)) {
      state.recentSearches.unshift(savedFood.id);
      state.recentSearches = state.recentSearches.slice(0, 3);
    }
    saveState();
    closeCreateFoodModal();

    if (addToLog) {
      await addFoodEntryToDailyLog(normalized, {
        category: state.defaultCategory || 'breakfast',
        analyticsSource: 'new_food',
      });
    } else {
      const searchQuery = document.getElementById('searchInput')?.value?.trim() || '';
      openAddFoodModal(state.defaultCategory);
      if (searchQuery) {
        document.getElementById('searchInput').value = searchQuery;
        searchFoods(searchQuery);
      }
    }
  } catch (error) {
    reportError(error);
  }
}

function setLogServingFields(food, quantity, unit) {
  const servingUnit = unit ?? getFoodServingUnit(food);
  document.getElementById('foodServingSize').value = formatInputNumber(quantity ?? getDefaultServingSize(food));
  document.getElementById('foodServingUnit').textContent = getServingUnitLabel(servingUnit);
}

function updateAddToLogModalActions() {
  const deleteFromLogBtn = document.getElementById('deleteFromLog');
  const deleteFooter = document.getElementById('addToLogDeleteFooter');
  const confirmBtn = document.getElementById('confirmAddToLog');
  const editLibraryLink = document.getElementById('editFoodInLibraryLink');
  const titleEl = document.querySelector('#addToLogModal .modal-header h2');
  const isEditing = Boolean(state.editingLogItem);
  const foodId = state.currentFoodForLog?.id;
  if (deleteFromLogBtn) deleteFromLogBtn.hidden = !isEditing;
  if (deleteFooter) deleteFooter.hidden = !isEditing;
  if (confirmBtn) confirmBtn.textContent = isEditing ? 'Save Changes' : 'Add to Daily Log';
  if (titleEl) titleEl.textContent = isEditing ? 'Edit Daily Log' : 'Add to Daily Log';
  if (editLibraryLink) editLibraryLink.hidden = !foodId || isBuiltInFood(foodId);
}

function openAddToLogModal() {
  if (!state.currentFoodForLog) return;
  document.getElementById('addToLogModal').classList.add('active');
  syncModalOpenState();
  state.logMeal = state.editingLogItem?.category || state.defaultCategory || state.logMeal || 'breakfast';
  setDropdownValue('logMealDropdown', state.logMeal);
  updateAddToLogModalActions();
  if (state.editingLogItem) {
    const item = getCurrentDayLog()[state.editingLogItem.category][state.editingLogItem.idx];
    setLogServingFields(state.currentFoodForLog, item.quantity, item.unit);
  } else {
    setLogServingFields(state.currentFoodForLog);
  }
  updateLogFoodPreview();
}
function closeAddToLogModal() {
  addToLogResume = null;
  document.getElementById('addToLogModal').classList.remove('active');
  syncModalOpenState();
  state.currentFoodForLog = null;
  state.editingLogItem = null;
}

function updateLogFoodPreview() {
  if (!state.currentFoodForLog) return;
  const food = state.currentFoodForLog;
  const quantity = parseInputNumber(document.getElementById('foodServingSize').value) || 0;
  const unit = getFoodServingUnit(food);
  const macros = getMacrosForFood(food, quantity, unit);
  document.getElementById('logFoodPreview').innerHTML = renderFoodItemInfoBlock(
    food.name,
    `${formatNumber(quantity)}${unit}`,
    macros
  );
  refreshIcons();
}

async function addFoodEntryToDailyLog(food, options = {}) {
  const unit = options.unit ?? getFoodServingUnit(food);
  const quantity = options.quantity ?? getDefaultServingSize(food);
  const category = options.category ?? state.logMeal ?? state.defaultCategory ?? 'breakfast';
  const macros = getMacrosForFood(food, quantity, unit);
  const log = getCurrentDayLog();
  const entry = { food, quantity, unit, macros };
  const dateKey = getDateKey(state.currentDate);
  const analyticsSource = options.analyticsSource || null;

  const cloudId = await sync.createLogEntry(sync.getCurrentUserId(), dateKey, category, entry);
  entry.cloudId = cloudId;
  log[category].push(entry);
  saveState();
  updateMacroDisplay();
  renderFoodLog();

  trackDailyLogFoodAdded({
    meal: category,
    source: analyticsSource || 'library',
    dateKey,
    itemCount: getDailyLogItemCount(dateKey),
  });
}

async function addFoodToLog() {
  if (!state.currentFoodForLog) return;
  const food = state.currentFoodForLog;
  const quantity = parseInputNumber(document.getElementById('foodServingSize').value) || getDefaultServingSize(food);
  const unit = getFoodServingUnit(food);
  try {
    await addFoodEntryToDailyLog(food, {
      quantity,
      unit,
      category: state.logMeal || state.defaultCategory || 'breakfast',
      analyticsSource: state.pendingLogAnalyticsSource || 'library',
    });
    state.pendingLogAnalyticsSource = null;
    closeAddToLogModal();
  } catch (error) {
    reportError(error);
  }
}

async function deleteFoodLog(category, idx) {
  const log = getCurrentDayLog();
  const entry = log[category][idx];
  if (!entry) return false;
  try {
    await sync.deleteLogEntry(sync.getCurrentUserId(), entry.cloudId);
    log[category].splice(idx, 1);
    saveState();
    updateMacroDisplay();
    renderFoodLog();
    return true;
  } catch (error) {
    reportError(error);
    return false;
  }
}

function editFoodLog(category, idx) {
  const log = getCurrentDayLog();
  const item = log[category][idx];
  if (!item?.food) return;
  state.currentFoodForLog = item.food;
  state.defaultCategory = category;
  state.editingLogItem = { category, idx };
  openAddToLogModal();
}

function setDropdownValue(dropdownId, value) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;
  const items = dropdown.querySelectorAll('.dropdown-item');
  const labelEl = dropdown.querySelector('.dropdown-trigger-label, #activityLabel');
  items.forEach(item => {
    if (item.dataset.value === value) {
      item.classList.add('selected');
      if (labelEl) labelEl.textContent = item.textContent;
    } else { item.classList.remove('selected'); }
  });
}

function getDropdownValue(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return '';
  const selected = dropdown.querySelector('.dropdown-item.selected');
  return selected ? selected.dataset.value : '';
}

function initDropdown(dropdownId, onChange) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;
  const trigger = dropdown.querySelector('.dropdown-trigger');
  const menu = dropdown.querySelector('.dropdown-menu');
  const labelEl = dropdown.querySelector('.dropdown-trigger-label, #activityLabel');
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.dropdown-menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
    menu.classList.toggle('open');
  });
  menu.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const value = item.dataset.value;
      if (labelEl) labelEl.textContent = item.textContent;
      menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      menu.classList.remove('open');
      if (onChange) onChange(value);
    });
  });
}

initDropdown('activityDropdown', (value) => {
  const dateKey = getDateKey(state.currentDate);
  state.activityLevelsByDate[dateKey] = value;
  state.activityLevel = value;
  saveState();
  updateActivityDropdownLabels();
  updateMacroDisplay();
  persistActivityLevelForDate(value, dateKey).catch(reportError);
});
initDropdown('logMealDropdown', (value) => { state.logMeal = value; });
initSwipeToDelete(document.getElementById('searchResults'), (btn) => deleteFoodById(btn.dataset.foodId));
initSwipeToDelete(document.getElementById('content'), (btn) => deleteFoodLog(btn.dataset.logCategory, Number(btn.dataset.logIndex)));

document.addEventListener('click', (e) => {
  if (e.target.closest('.dropdown')) return;
  document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));
});

document.getElementById('addFoodClose').addEventListener('click', closeAddFoodModal);
document.getElementById('addNewFoodBtn').addEventListener('click', () => openCreateFoodModal(document.getElementById('searchInput').value || ''));
document.getElementById('searchInput').addEventListener('input', (e) => searchFoods(e.target.value));
document.getElementById('editFoodClose').addEventListener('click', closeEditFoodModal);
document.getElementById('editFoodForm').addEventListener('submit', (e) => { e.preventDefault(); saveEditedFood(); });
const deleteFromDatabaseBtn = document.getElementById('deleteFromDatabase');
if (deleteFromDatabaseBtn) {
  deleteFromDatabaseBtn.addEventListener('click', async () => {
    if (!state.editingFoodId) return;
    await deleteFoodById(state.editingFoodId);
  });
}
document.getElementById('createFoodClose').addEventListener('click', closeCreateFoodModal);
document.getElementById('createFoodForm').addEventListener('submit', (e) => { e.preventDefault(); saveCreatedFood(); });
['editFoodServingSize', 'editFoodDefaultServingSize', 'editFoodCalories', 'editFoodCarbs', 'editFoodProtein', 'editFoodFat', 'createFoodDefaultServingSize', 'createFoodCalories', 'createFoodCarbs', 'createFoodProtein', 'createFoodFat', 'foodServingSize'].forEach((id) => {
  const input = document.getElementById(id);
  if (!input) return;
  input.addEventListener('input', (e) => {
    const next = e.target.value.replace(/,/g, '.');
    if (next !== e.target.value) e.target.value = next;
  });
});
document.getElementById('addToLogClose').addEventListener('click', closeAddToLogModal);
document.getElementById('editFoodInLibraryLink')?.addEventListener('click', openEditFoodFromAddToLog);
const deleteFromLogBtn = document.getElementById('deleteFromLog');
if (deleteFromLogBtn) {
  deleteFromLogBtn.addEventListener('click', async () => {
    if (!state.editingLogItem) return;
    const { category, idx } = state.editingLogItem;
    const deleted = await deleteFoodLog(category, idx);
    if (deleted) closeAddToLogModal();
  });
}
document.getElementById('foodServingSize').addEventListener('input', updateLogFoodPreview);
document.getElementById('confirmAddToLog').addEventListener('click', async () => {
  if (state.editingLogItem) {
    const log = getCurrentDayLog();
    const sourceCategory = state.editingLogItem.category;
    const item = log[sourceCategory][state.editingLogItem.idx];
    const quantity = parseInputNumber(document.getElementById('foodServingSize').value) || getDefaultServingSize(item.food);
    const unit = getFoodServingUnit(item.food);
    const targetCategory = state.logMeal || sourceCategory;
    item.quantity = quantity;
    item.unit = unit;
    item.macros = getMacrosForFood(item.food, quantity, unit);
    try {
      if (targetCategory !== sourceCategory) {
        await sync.deleteLogEntry(sync.getCurrentUserId(), item.cloudId);
        const cloudId = await sync.createLogEntry(sync.getCurrentUserId(), getDateKey(state.currentDate), targetCategory, item);
        item.cloudId = cloudId;
        log[sourceCategory].splice(state.editingLogItem.idx, 1);
        log[targetCategory].push(item);
      } else {
        await sync.updateLogEntry(sync.getCurrentUserId(), item, getDateKey(state.currentDate), targetCategory);
      }
      saveState();
      updateMacroDisplay();
      renderFoodLog();
      closeAddToLogModal();
    } catch (error) {
      reportError(error);
    }
  } else {
    await addFoodToLog();
  }
});

document.getElementById('prevBtn').addEventListener('click', async () => {
  const d = new Date(state.currentDate);
  d.setDate(d.getDate() - 1);
  state.currentDate = d;
  updateDateDisplay();
  try {
    setLoadingVisible(true);
    const dateKey = getDateKey(state.currentDate);
    await loadDayLog(dateKey);
    applyActivityLevelForDate(dateKey);
    updateMacroDisplay();
    renderFoodLog();
  } catch (error) {
    reportError(error);
  } finally {
    setLoadingVisible(false);
  }
});
document.getElementById('todayBtn').addEventListener('click', async () => {
  state.currentDate = new Date();
  updateDateDisplay();
  try {
    setLoadingVisible(true);
    const dateKey = getDateKey(state.currentDate);
    await loadDayLog(dateKey);
    applyActivityLevelForDate(dateKey);
    updateMacroDisplay();
    renderFoodLog();
  } catch (error) {
    reportError(error);
  } finally {
    setLoadingVisible(false);
  }
});

function initAppMenu() {
  const dropdown = document.getElementById('appMenuDropdown');
  if (!dropdown) return;
  const trigger = dropdown.querySelector('.dropdown-trigger');
  const menu = dropdown.querySelector('.dropdown-menu');
  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.dropdown-menu.open').forEach((m) => {
      if (m !== menu) m.classList.remove('open');
    });
    menu?.classList.toggle('open');
  });
  document.getElementById('openPersonalizeBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu?.classList.remove('open');
    openPersonalizeModal();
  });
  document.getElementById('openBackupBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu?.classList.remove('open');
    openModal('backupDataModal');
  });
  document.getElementById('openFeedbackBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu?.classList.remove('open');
    openFeedbackModal();
  });
  document.getElementById('menuSignOutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    menu?.classList.remove('open');
    void performSignOut();
  });
}

initAppMenu();
initStickyMacroSummary();
window.addEventListener('resize', syncAllStackedModalScroll);

function initStickyMacroSummary() {
  const summary = document.querySelector('.macros-summary');
  if (!summary || !('IntersectionObserver' in window)) return;

  const sentinel = document.createElement('div');
  sentinel.className = 'macros-summary__sentinel';
  sentinel.setAttribute('aria-hidden', 'true');
  summary.before(sentinel);

  const observer = new IntersectionObserver(([entry]) => {
    summary.classList.toggle('is-stuck', !entry.isIntersecting);
  }, { threshold: 0 });
  observer.observe(sentinel);
}

document.getElementById('personalizeClose')?.addEventListener('click', () => closeModal('personalizeModal'));
document.getElementById('backupDataClose')?.addEventListener('click', () => closeModal('backupDataModal'));
document.getElementById('feedbackClose')?.addEventListener('click', () => closeModal('feedbackModal'));

function openFeedbackModal() {
  resetFeedbackForm();
  openModal('feedbackModal');
  trackFeedbackOpened();
  window.setTimeout(() => document.getElementById('feedbackMessage')?.focus(), 100);
}

function resetFeedbackForm() {
  const form = document.getElementById('feedbackForm');
  form?.reset();
  const fields = document.getElementById('feedbackFields');
  const success = document.getElementById('feedbackSuccess');
  const error = document.getElementById('feedbackError');
  const emailValue = document.getElementById('feedbackShareEmailValue');
  const submit = document.getElementById('feedbackSubmit');
  if (fields) fields.hidden = false;
  if (success) success.hidden = true;
  if (error) { error.hidden = true; error.textContent = ''; }
  if (emailValue) { emailValue.hidden = true; emailValue.textContent = ''; }
  if (submit) {
    submit.disabled = false;
    submit.textContent = 'Send Feedback';
    delete submit.dataset.mode;
  }
  updateFeedbackCharacterCounter();
}

function updateFeedbackCharacterCounter() {
  const messageEl = document.getElementById('feedbackMessage');
  const counterEl = document.getElementById('feedbackMessageCounter');
  if (!messageEl || !counterEl) return;

  const maxLength = Number(messageEl.getAttribute('maxlength')) || 0;
  const length = messageEl.value.length;
  const atLimit = maxLength > 0 && length >= maxLength;

  counterEl.textContent = atLimit ? `${length} / ${maxLength} limit reached` : `${length} / ${maxLength}`;
  counterEl.classList.toggle('form-character-counter--at-limit', atLimit);
}

function initFeedbackForm() {
  const form = document.getElementById('feedbackForm');
  if (!form) return;
  const shareEmailCheckbox = document.getElementById('feedbackShareEmail');
  const emailValueEl = document.getElementById('feedbackShareEmailValue');
  const errorEl = document.getElementById('feedbackError');
  const submitBtn = document.getElementById('feedbackSubmit');
  const fieldsEl = document.getElementById('feedbackFields');
  const successEl = document.getElementById('feedbackSuccess');
  const messageEl = document.getElementById('feedbackMessage');

  messageEl?.addEventListener('input', updateFeedbackCharacterCounter);
  updateFeedbackCharacterCounter();

  shareEmailCheckbox?.addEventListener('change', async () => {
    if (!emailValueEl) return;
    if (shareEmailCheckbox.checked) {
      try {
        const session = await sync.getSession();
        const email = session?.user?.email;
        if (email) {
          emailValueEl.textContent = email;
          emailValueEl.hidden = false;
          return;
        }
      } catch {
        /* fall through and hide */
      }
      emailValueEl.hidden = true;
      emailValueEl.textContent = '';
    } else {
      emailValueEl.hidden = true;
      emailValueEl.textContent = '';
    }
  });

  submitBtn?.addEventListener('click', (e) => {
    if (submitBtn.dataset.mode === 'close') {
      e.preventDefault();
      closeModal('feedbackModal');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn?.dataset.mode === 'close') return;
    if (!messageEl || !submitBtn) return;
    const message = messageEl.value.trim();
    if (!message) {
      if (errorEl) { errorEl.textContent = 'Please write a short message before sending.'; errorEl.hidden = false; }
      messageEl.focus();
      return;
    }
    if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const recommendValue = document.querySelector('input[name="feedbackRecommend"]:checked')?.value;
    const recommend = recommendValue === 'yes' ? true : recommendValue === 'no' ? false : null;
    const shareEmail = !!shareEmailCheckbox?.checked;
    let email = null;
    if (shareEmail) {
      try {
        const session = await sync.getSession();
        email = session?.user?.email || null;
      } catch {
        email = null;
      }
    }

    try {
      await submitFeedback({ message, recommend, shareEmail, email });
      trackFeedbackSubmitted({ recommend, shareEmail });
      if (fieldsEl) fieldsEl.hidden = true;
      if (successEl) successEl.hidden = false;
      refreshIcons();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Close';
      submitBtn.dataset.mode = 'close';
    } catch (err) {
      const message = err?.message || 'Could not send feedback. Please try again.';
      if (errorEl) { errorEl.textContent = message; errorEl.hidden = false; }
      trackFeedbackFailed(err?.message || 'unknown');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Feedback';
    }
  });
}

initFeedbackForm();

initClearOnFocusInputs();
initInputClearButtons();
initProfileMeasureInputs();
initCreateFoodReferenceMeasure();
initEditFoodReferenceMeasure();
initFieldInfoTips();
initAlertDismiss();

document.getElementById('profileAge')?.addEventListener('input', profileBodyChange);

document.querySelectorAll('input[name="profileSex"], input[name="profileDietGoal"]').forEach((el) => {
  el.addEventListener('change', profileBodyChange);
});

initProfileTargetFieldDecorations();

document.getElementById('profileResetTargetsBtn')?.addEventListener('click', resetProfileTargetsToFormula);

document.getElementById('exportBtn').addEventListener('click', async () => {
  try {
    const data = await sync.exportCloudState(sync.getCurrentUserId(), DEFAULT_FOODS, normalizeFood);
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `macro-target-backup-${getDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    reportError(error, 'Could not export your data.');
  }
});

document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!confirm('This will replace all your current data. Continue?')) return;
      setLoadingVisible(true);
      const userId = sync.getCurrentUserId();
      await sync.importCloudState(userId, data, DEFAULT_FOODS, normalizeFood);
      if (data.userProfile) {
        const profile = sanitizeProfile(data.userProfile);
        if (profile) {
          state.userProfile = profile;
          sync.writeUserProfile(profile);
        }
      }
      await reloadSignedInUserState(userId);
      state.dailyLogs = {};
      await loadDayLog(getDateKey(state.currentDate));
      closeModal('backupDataModal');
    } catch (err) {
      reportError(err, 'Invalid backup file or import failed.');
    } finally {
      setLoadingVisible(false);
      e.target.value = '';
    }
  };
  reader.readAsText(file);
});

function updateDateDisplay() {
  const current = new Date(state.currentDate);
  const today = new Date(); today.setHours(0,0,0,0);
  const cmp = new Date(current); cmp.setHours(0,0,0,0);
  const dateEl = document.getElementById('dateDisplay');
  if (cmp.getTime() === today.getTime()) {
    dateEl.textContent = 'Today';
  } else {
    dateEl.textContent = current.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}

async function reloadSignedInUserState(userId, { renderUi = true } = {}) {
  const cloudFoods = await sync.fetchCustomFoods(userId);
  state.foods = sync.mergeFoodLibrary(DEFAULT_FOODS, cloudFoods, normalizeFood);
  const [{ profile: cloudProfile, activityLevel }, cloudActivityByDate] = await Promise.all([
    sync.fetchUserProfile(userId),
    sync.fetchActivityLevelsByDate(userId),
  ]);
  const localProfile = sync.readUserProfile();
  state.userProfile = cloudProfile || localProfile;
  state.defaultActivityLevel = activityLevel || 'low';
  if (state.userProfile && !state.userProfile.activityLevel) {
    state.userProfile.activityLevel = appKeyToProfileLevel(state.defaultActivityLevel);
    sync.writeUserProfile(state.userProfile);
  } else if (cloudProfile) {
    sync.writeUserProfile(cloudProfile);
  }
  const prefs = sync.readLocalPreferences();
  state.recentSearches = prefs.recentSearches || [];
  state.activityLevelsByDate = {
    ...(prefs.activityLevelsByDate || {}),
    ...cloudActivityByDate,
  };
  saveState();
  const dateKey = getDateKey(state.currentDate);
  await loadDayLog(dateKey, userId);
  applyActivityLevelForDate(dateKey);
  if (renderUi) {
    renderSignedInUi();
  }
}

async function initializeSignedInUser(userId) {
  sync.setCurrentUserId(userId);
  setLoadingVisible(true, { hideApp: true });
  try {
    void sync.purgeExpiredDailyLogsRemote().catch((err) => {
      console.warn('[macro-target] Daily Log retention could not run:', err);
    });
    sync.pruneLocalPreferencesDailyLogMetadata();

    const counts = await sync.getCloudDataCounts(userId);
    const cloudIsEmpty = counts.foods === 0 && counts.logs === 0;

    if (cloudIsEmpty) {
      sync.clearFreshAccountLocalState(userId);
    }

    await sync.runNewUserOnboardingIfNeeded(userId, {
      starterFoods: STARTER_FOODS,
      starterLogEntries: STARTER_LOG_ENTRIES,
      normalizeFood,
      getMacrosForFood,
      getTodayDateKey: () => getDateKey(state.currentDate),
      buildDefaultProfile: () => buildDefaultNewUserProfile(state.defaultActivityLevel),
      initialCounts: counts,
    });
    await reloadSignedInUserState(userId, { renderUi: false });
    pruneExpiredLocalDailyLogCaches();
    bootstrappedUserId = userId;
  } finally {
    showSignedInApp();
    renderSignedInUi();
  }
}

let sessionBootstrapInFlight = false;

function dayLogLooksEmpty(dayLog) {
  if (!dayLog) return true;
  return Object.values(dayLog).every((items) => !items?.length);
}

async function handleSession(session) {
  if (!session) return;
  sync.setCurrentUserId(session.user.id);
  if (sessionBootstrapInFlight) return;
  if (bootstrappedUserId === session.user.id) {
    const dateKey = getDateKey(state.currentDate);
    if (dayLogLooksEmpty(state.dailyLogs[dateKey])) {
      try {
        await loadDayLog(dateKey, session.user.id);
        renderSignedInUi();
      } catch (error) {
        reportAuthError(error);
      }
    }
    return;
  }
  sessionBootstrapInFlight = true;
  suppressAuthGate = true;
  setAuthBootstrapping(true);
  try {
    await initializeSignedInUser(session.user.id);
  } catch (error) {
    bootstrappedUserId = null;
    reportAuthError(error);
    revealAuthGate();
  } finally {
    sessionBootstrapInFlight = false;
  }
}

async function boot() {
  const isOAuthReturn = sync.hasAuthCallbackInUrl();
  if (isOAuthReturn) beginAuthBootstrap();

  try {
    sync.initSupabase();

    document.getElementById('googleSignInBtn')?.addEventListener('click', async () => {
      try {
        reportAuthError({ message: '' });
        beginAuthBootstrap();
        await sync.signInWithGoogle();
      } catch (error) {
        revealAuthGate();
        reportAuthError(error);
      }
    });

    const callbackError = sync.getAuthCallbackError();
    if (callbackError) {
      sync.clearAuthCallbackFromUrl();
      reportAuthError(new Error(callbackError));
      revealAuthGate();
      return;
    }

    if (isOAuthReturn) {
      try {
        let session = await sync.finishAuthFromUrl();
        if (!session) {
          await new Promise((resolve) => window.setTimeout(resolve, 100));
          session = await sync.getSession();
        }
        if (session) {
          await handleSession(session);
          return;
        }
        reportAuthError(new Error('Google sign-in could not be completed. Please try again.'));
        revealAuthGate();
        return;
      } catch (error) {
        reportAuthError(error);
        revealAuthGate();
        return;
      }
    }

    const session = await sync.getSession();
    if (session) {
      if (!isOAuthReturn) beginAuthBootstrap();
      await handleSession(session);
    } else {
      revealAuthGate();
    }
  } catch (error) {
    reportAuthError(error);
    revealAuthGate();
  } finally {
    initialAuthSettled = true;
    registerAuthListener();
    if (document.documentElement.classList.contains('is-app-ready')) {
      endAuthBootstrap();
    } else if (!document.documentElement.classList.contains('is-auth-loading')
      && !document.documentElement.classList.contains('is-auth-callback')) {
      endAuthBootstrap();
    }
  }
}

Object.assign(window, {
  openAddFoodModal,
  selectFoodForLog,
  editFoodInDB,
  editFoodLog,
});

boot();
