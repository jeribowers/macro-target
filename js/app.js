import * as sync from './sync-service.js';

const ACTIVITY_LEVELS = {
  low: { calories: 1200, protein: 120, carbs: 115, fat: 45, label: 'Low (1,200)' },
  medium: { calories: 1700, protein: 121, carbs: 184, fat: 53, label: 'Med (1,700)' },
  high: { calories: 2000, protein: 127, carbs: 234, fat: 61, label: 'High (2,000)' }
};

const DEFAULT_FOODS = [
  { id: 'chicken_breast', name: 'Chicken Breast', servingSize: 100, servingUnit: 'g', calories: 165, carbs: 0, protein: 31, fat: 3.6 },
  { id: 'brown_rice', name: 'Brown Rice', servingSize: 100, servingUnit: 'g', calories: 111, carbs: 23, protein: 2.6, fat: 0.9 },
  { id: 'broccoli', name: 'Broccoli', servingSize: 100, servingUnit: 'g', calories: 34, carbs: 7, protein: 2.8, fat: 0.4 },
  { id: 'egg', name: 'Egg', servingSize: 100, servingUnit: 'g', calories: 155, carbs: 1.1, protein: 13, fat: 11 },
  { id: 'salmon', name: 'Salmon', servingSize: 100, servingUnit: 'g', calories: 206, carbs: 0, protein: 22, fat: 13 },
  { id: 'sweet_potato', name: 'Sweet Potato', servingSize: 100, servingUnit: 'g', calories: 86, carbs: 20, protein: 1.6, fat: 0.1 },
  { id: 'banana', name: 'Banana', servingSize: 100, servingUnit: 'g', calories: 89, carbs: 23, protein: 1.1, fat: 0.3 },
  { id: 'greek_yogurt', name: 'Greek Yogurt', servingSize: 100, servingUnit: 'g', calories: 59, carbs: 3.3, protein: 10, fat: 0.4 },
  { id: 'almonds', name: 'Almonds', servingSize: 100, servingUnit: 'g', calories: 579, carbs: 22, protein: 21, fat: 50 },
  { id: 'oats', name: 'Oats', servingSize: 100, servingUnit: 'g', calories: 389, carbs: 66, protein: 17, fat: 7 },
  { id: 'apple', name: 'Apple', servingSize: 100, servingUnit: 'g', calories: 52, carbs: 14, protein: 0.3, fat: 0.2 },
  { id: 'tuna', name: 'Canned Tuna', servingSize: 100, servingUnit: 'g', calories: 98, carbs: 0, protein: 22, fat: 1 },
];

let state = {
  currentDate: new Date(), activityLevel: 'medium', dailyLogs: {},
  foods: DEFAULT_FOODS.map(normalizeFood), recentSearches: [],
  currentFoodForLog: null, editingFoodId: null,
  editingLogItem: null, defaultCategory: null, logMeal: 'breakfast'
};

function getDateKey(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d.toISOString().split('T')[0]; }

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

function getServingUnitLabel(unit) {
  const labels = { g: 'g', ml: 'ml', oz: 'oz', cup: 'cup', tbsp: 'tbsp', tsp: 'teaspoon', piece: 'piece' };
  return labels[unit] || unit;
}

function saveState() {
  sync.saveLocalPreferences({ recentSearches: state.recentSearches });
}

function reportError(error, fallback = 'Something went wrong while saving your data.') {
  alert(error?.message || fallback);
}

function reportAuthError(error) {
  const message = document.getElementById('authError');
  if (!message) return;
  message.textContent = error?.message || '';
}

function setAuthVisible(showAuth) {
  const authGate = document.getElementById('authGate');
  const appContainer = document.querySelector('.app-container');
  if (authGate) authGate.hidden = !showAuth;
  if (appContainer) appContainer.hidden = showAuth;
  if (showAuth) setLoadingVisible(false);
}

function setLoadingVisible(visible) {
  const loading = document.getElementById('appLoading');
  const authGate = document.getElementById('authGate');
  const appContainer = document.querySelector('.app-container');
  if (loading) loading.hidden = !visible;
  if (visible) {
    if (authGate) authGate.hidden = true;
    if (appContainer) appContainer.hidden = false;
  }
}

async function loadDayLog(dateKey) {
  const userId = sync.getCurrentUserId();
  if (!userId) return;
  state.dailyLogs[dateKey] = await sync.fetchLogEntriesForDate(userId, dateKey, state.foods);
}

async function persistActivityLevel(level) {
  const userId = sync.getCurrentUserId();
  if (!userId) return;
  await sync.saveActivityLevel(userId, level);
}

const UNIT_CONVERSIONS = { g: 1, ml: 1, oz: 28.35, cup: 240, tbsp: 15, tsp: 5, piece: 100 };

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

function updateMacroDisplay() {
  const targets = ACTIVITY_LEVELS[state.activityLevel];
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

function renderFoodItemInfo(name, weightLabel, macros) {
  return `
    <div class="food-info">
      <div class="food-name-row">
        <p class="food-name">${name}</p>
        <p class="food-weight">${weightLabel}</p>
      </div>
      <p class="food-macros">${renderFoodLogMacroLine(macros.calories, macros.carbs, macros.protein, macros.fat || 0)}</p>
    </div>`;
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
    html += `<div class="food-category">
      <div class="food-category-shell">
        <div class="food-category-header">
          <div class="food-category-title">
            <h3>${category}</h3>
            <div class="category-total">${renderMacroBadges(catTotals.calories, catTotals.carbs, catTotals.protein, catTotals.fat, true)}</div>
          </div>
          <button class="add-food-header btn-secondary" onclick="openAddFoodModal('${category}')">+ Add</button>
        </div>
        <div class="food-list">`;
    if (log[category].length > 0) {
      log[category].forEach((item, idx) => {
        html += `
          <div class="swipe-row" data-deletable="true" data-log-category="${category}" data-log-index="${idx}">
            <button type="button" class="swipe-delete" data-log-category="${category}" data-log-index="${idx}" aria-label="Delete ${item.food.name}">Delete</button>
            <div class="food-item swipe-content">
              ${renderFoodItemInfo(item.food.name, `${formatNumber(item.quantity)}${item.unit}`, item.macros)}
              <div class="food-actions">
                <button onclick="editFoodLog('${category}', ${idx})" title="Edit" aria-label="Edit"><i data-lucide="pencil"></i></button>
              </div>
            </div>
          </div>`;
      });
    } else {
      html += `<div class="food-item"><div class="food-info"><p class="food-macros">No foods logged.</p></div></div>`;
    }
    html += '</div></div></div>';
  });
  content.innerHTML = html;
  refreshIcons();
}

function openAddFoodModal(defaultCategory = null) {
  state.editingFoodId = null;
  state.defaultCategory = defaultCategory || 'breakfast';
  document.getElementById('addFoodModal').classList.add('active');
  document.getElementById('searchInput').value = '';
  searchFoods('');
}
function closeAddFoodModal() { document.getElementById('addFoodModal').classList.remove('active'); }

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
  if (!confirm(`Delete "${food.name}" from food database? Existing foods already logged will stay in your daily logs.`)) return;
  try {
    await sync.deleteCustomFood(sync.getCurrentUserId(), food);
    state.foods = state.foods.filter(f => f.id !== foodId);
    state.recentSearches = state.recentSearches.filter(id => id !== foodId);
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
    const optionBody = `<div class="food-option swipe-content" onclick="selectFoodForLog('${food.id}')">
      ${renderFoodItemInfo(food.name, measure, servingMacros)}
      <div class="actions">
        <button class="btn-primary btn-icon" onclick="event.stopPropagation(); selectFoodForLog('${food.id}')" title="Add" aria-label="Add"><i data-lucide="plus"></i></button>
        <button class="btn-secondary btn-icon" onclick="event.stopPropagation(); editFoodInDB('${food.id}')" title="Edit" aria-label="Edit"><i data-lucide="pencil"></i></button>
      </div>
    </div>`;
    if (isBuiltInFood(food.id)) {
      html += optionBody;
    } else {
      html += `<div class="swipe-row" data-food-id="${food.id}" data-deletable="true">
        <button type="button" class="swipe-delete" data-food-id="${food.id}" aria-label="Delete ${food.name}">Delete</button>
        ${optionBody}
      </div>`;
    }
  });
  document.getElementById('searchResults').innerHTML = html || '<p class="search-empty">No foods found</p>';
  refreshIcons();
}

function selectFoodForLog(foodId) {
  const food = state.foods.find(f => f.id === foodId);
  if (food) {
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

function editFoodInDB(foodId) {
  const food = state.foods.find(f => f.id === foodId);
  if (food) {
    state.editingFoodId = foodId;
    document.getElementById('editFoodName').value = food.name;
    document.getElementById('editFoodServingSize').value = formatInputNumber(food.servingSize || 100);
    setDropdownValue('editFoodServingUnitDropdown', food.servingUnit || 'g');
    document.getElementById('editFoodDefaultServingSize').value = formatInputNumber(getDefaultServingSize(food));
    const servingMacros = getMacrosForFood(food, food.servingSize || 100, food.servingUnit || 'g');
    document.getElementById('editFoodCalories').value = formatInputNumber(servingMacros.calories);
    document.getElementById('editFoodCarbs').value = formatInputNumber(servingMacros.carbs);
    document.getElementById('editFoodProtein').value = formatInputNumber(servingMacros.protein);
    document.getElementById('editFoodFat').value = formatInputNumber(servingMacros.fat);
    document.getElementById('editFoodModal').classList.add('active');
  }
}

function closeEditFoodModal() {
  document.getElementById('editFoodModal').classList.remove('active');
  state.editingFoodId = null;
}

async function saveEditedFood() {
  const name = document.getElementById('editFoodName').value.trim();
  const servingSize = parseInputNumber(document.getElementById('editFoodServingSize').value);
  const servingUnit = getDropdownValue('editFoodServingUnitDropdown');
  const defaultServingSize = parseInputNumber(document.getElementById('editFoodDefaultServingSize').value);
  const caloriesPerServing = parseMacroInputNumber(document.getElementById('editFoodCalories').value);
  const carbsPerServing = parseMacroInputNumber(document.getElementById('editFoodCarbs').value);
  const proteinPerServing = parseMacroInputNumber(document.getElementById('editFoodProtein').value);
  const fatPerServing = parseMacroInputNumber(document.getElementById('editFoodFat').value);
  if (!name || isNaN(servingSize) || servingSize <= 0 || !servingUnit || isNaN(defaultServingSize) || defaultServingSize <= 0) { alert('Please fill in all required fields. Reference size and serving size must be greater than 0.'); return; }
  const servingBase = servingSize * (UNIT_CONVERSIONS[servingUnit] || 1);
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
    const savedFood = await sync.upsertFood(sync.getCurrentUserId(), updatedFood);
    state.foods[foodIdx] = normalizeFood(savedFood);
    saveState();
    closeEditFoodModal();
    if (document.getElementById('addFoodModal').classList.contains('active')) {
      searchFoods(document.getElementById('searchInput').value);
    }
  } catch (error) {
    reportError(error);
  }
}

function initSwipeToDelete(container, onDelete) {
  if (!container || container.dataset.swipeBound === 'true') return;
  container.dataset.swipeBound = 'true';

  const SWIPE_WIDTH = 88;
  const SWIPE_THRESHOLD = 44;
  let activeSwipe = null;

  function closeOpenRows(except) {
    container.querySelectorAll('.swipe-row.is-open').forEach((row) => {
      if (row !== except) row.classList.remove('is-open');
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
    activeSwipe = {
      row,
      content,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offset: row.classList.contains('is-open') ? -SWIPE_WIDTH : 0,
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
    const offset = Math.max(-SWIPE_WIDTH, Math.min(0, activeSwipe.offset + deltaX));
    activeSwipe.content.style.transform = `translateX(${offset}px)`;
  });

  function finishSwipe(e) {
    if (!activeSwipe || e.pointerId !== activeSwipe.pointerId) return;
    const { row, content, moved, offset, startX, dragAxis } = activeSwipe;
    content.style.transform = '';
    if (content.hasPointerCapture(e.pointerId)) content.releasePointerCapture(e.pointerId);
    if (moved && dragAxis === 'x') {
      row.dataset.swipeMoved = 'true';
      const deltaX = e.clientX - startX;
      const endOffset = Math.max(-SWIPE_WIDTH, Math.min(0, offset + deltaX));
      if (endOffset <= -SWIPE_THRESHOLD) {
        closeOpenRows(row);
        row.classList.add('is-open');
      } else {
        row.classList.remove('is-open');
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
  document.getElementById('createFoodServingSize').value = '100';
  setDropdownValue('createFoodServingUnitDropdown', 'g');
  document.getElementById('createFoodDefaultServingSize').value = '100';
  document.getElementById('createFoodCalories').value = '';
  document.getElementById('createFoodCarbs').value = '';
  document.getElementById('createFoodProtein').value = '';
  document.getElementById('createFoodFat').value = '';
  document.getElementById('createFoodModal').classList.add('active');
}
function closeCreateFoodModal() { document.getElementById('createFoodModal').classList.remove('active'); }

async function saveCreatedFood() {
  const name = document.getElementById('createFoodName').value.trim();
  const servingSize = parseInputNumber(document.getElementById('createFoodServingSize').value);
  const servingUnit = getDropdownValue('createFoodServingUnitDropdown');
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
  try {
    const savedFood = await sync.upsertFood(sync.getCurrentUserId(), newFood);
    state.foods.push(normalizeFood(savedFood));
    state.currentFoodForLog = normalizeFood(savedFood);
    state.editingLogItem = null;
    state.logMeal = state.defaultCategory || 'breakfast';
    document.getElementById('foodServingSize').value = formatInputNumber(getDefaultServingSize(savedFood));
    document.getElementById('foodServingUnit').textContent = getServingUnitLabel(getFoodServingUnit(savedFood));
    if (!state.recentSearches.includes(savedFood.id)) {
      state.recentSearches.unshift(savedFood.id);
      state.recentSearches = state.recentSearches.slice(0, 3);
    }
    closeCreateFoodModal();
    await addFoodToLog();
  } catch (error) {
    reportError(error);
  }
}

function setLogServingFields(food, quantity) {
  const unit = getFoodServingUnit(food);
  document.getElementById('foodServingSize').value = formatInputNumber(quantity ?? getDefaultServingSize(food));
  document.getElementById('foodServingUnit').textContent = getServingUnitLabel(unit);
}

function updateAddToLogModalActions() {
  const deleteFromLogBtn = document.getElementById('deleteFromLog');
  const confirmBtn = document.getElementById('confirmAddToLog');
  const isEditing = Boolean(state.editingLogItem);
  if (deleteFromLogBtn) deleteFromLogBtn.hidden = !isEditing;
  if (confirmBtn) confirmBtn.textContent = isEditing ? 'Save changes' : 'Add to Log';
}

function openAddToLogModal() {
  if (!state.currentFoodForLog) return;
  document.getElementById('addToLogModal').classList.add('active');
  state.logMeal = state.editingLogItem?.category || state.defaultCategory || state.logMeal || 'breakfast';
  setDropdownValue('logMealDropdown', state.logMeal);
  updateAddToLogModalActions();
  if (state.editingLogItem) {
    const item = getCurrentDayLog()[state.editingLogItem.category][state.editingLogItem.idx];
    setLogServingFields(state.currentFoodForLog, item.quantity);
  } else {
    setLogServingFields(state.currentFoodForLog);
  }
  updateLogFoodPreview();
}
function closeAddToLogModal() { document.getElementById('addToLogModal').classList.remove('active'); state.currentFoodForLog = null; state.editingLogItem = null; }

function updateLogFoodPreview() {
  if (!state.currentFoodForLog) return;
  const food = state.currentFoodForLog;
  const quantity = parseInputNumber(document.getElementById('foodServingSize').value) || 0;
  const unit = getFoodServingUnit(food);
  const macros = getMacrosForFood(food, quantity, unit);
  document.getElementById('logFoodPreview').innerHTML = renderFoodItemInfo(
    food.name,
    `${formatNumber(quantity)}${unit}`,
    macros
  );
}

async function addFoodToLog() {
  if (!state.currentFoodForLog) return;
  const food = state.currentFoodForLog;
  const category = state.logMeal || state.defaultCategory || 'breakfast';
  const quantity = parseInputNumber(document.getElementById('foodServingSize').value) || getDefaultServingSize(food);
  const unit = getFoodServingUnit(food);
  const macros = getMacrosForFood(food, quantity, unit);
  const log = getCurrentDayLog();
  const entry = { food, quantity, unit, macros };
  try {
    const cloudId = await sync.createLogEntry(sync.getCurrentUserId(), getDateKey(state.currentDate), category, entry);
    entry.cloudId = cloudId;
    log[category].push(entry);
    saveState();
    updateMacroDisplay();
    renderFoodLog();
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
  state.activityLevel = value;
  saveState();
  updateMacroDisplay();
  persistActivityLevel(value).catch(reportError);
});
initDropdown('logMealDropdown', (value) => { state.logMeal = value; });
initDropdown('createFoodServingUnitDropdown');
initDropdown('editFoodServingUnitDropdown');
initSwipeToDelete(document.getElementById('searchResults'), (btn) => deleteFoodById(btn.dataset.foodId));
initSwipeToDelete(document.getElementById('content'), (btn) => deleteFoodLog(btn.dataset.logCategory, Number(btn.dataset.logIndex)));

document.addEventListener('click', () => { document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open')); });

document.getElementById('addFoodClose').addEventListener('click', closeAddFoodModal);
document.getElementById('addNewFoodBtn').addEventListener('click', () => openCreateFoodModal(document.getElementById('searchInput').value || ''));
document.getElementById('searchInput').addEventListener('input', (e) => searchFoods(e.target.value));
document.getElementById('editFoodClose').addEventListener('click', closeEditFoodModal);
document.getElementById('cancelEditFood').addEventListener('click', closeEditFoodModal);
document.getElementById('editFoodForm').addEventListener('submit', (e) => { e.preventDefault(); saveEditedFood(); });
document.getElementById('createFoodClose').addEventListener('click', closeCreateFoodModal);
document.getElementById('cancelCreateFood').addEventListener('click', closeCreateFoodModal);
document.getElementById('createFoodForm').addEventListener('submit', (e) => { e.preventDefault(); saveCreatedFood(); });
['editFoodServingSize', 'editFoodDefaultServingSize', 'editFoodCalories', 'editFoodCarbs', 'editFoodProtein', 'editFoodFat', 'createFoodServingSize', 'createFoodDefaultServingSize', 'createFoodCalories', 'createFoodCarbs', 'createFoodProtein', 'createFoodFat', 'foodServingSize'].forEach((id) => {
  const input = document.getElementById(id);
  if (!input) return;
  input.addEventListener('input', (e) => {
    const next = e.target.value.replace(/,/g, '.');
    if (next !== e.target.value) e.target.value = next;
  });
});
document.getElementById('createFoodServingSize').addEventListener('focus', (e) => {
  e.target.value = '';
});
document.getElementById('createFoodServingSize').addEventListener('blur', (e) => {
  if (e.target.value === '' || e.target.value === '-') {
    e.target.value = '100';
  }
});
document.getElementById('createFoodDefaultServingSize').addEventListener('focus', (e) => {
  e.target.value = '';
});
document.getElementById('createFoodDefaultServingSize').addEventListener('blur', (e) => {
  if (e.target.value === '' || e.target.value === '-') {
    e.target.value = '100';
  }
});
['editFoodCalories', 'editFoodCarbs', 'editFoodProtein', 'editFoodFat', 'createFoodCalories', 'createFoodCarbs', 'createFoodProtein', 'createFoodFat'].forEach((id) => {
  const input = document.getElementById(id);
  if (!input) return;
  input.addEventListener('blur', (e) => {
    if (e.target.value === '' || e.target.value === '-') {
      e.target.value = '0';
    }
  });
});
document.getElementById('addToLogClose').addEventListener('click', closeAddToLogModal);
document.getElementById('cancelAddToLog').addEventListener('click', closeAddToLogModal);
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
document.getElementById('foodServingSize').addEventListener('focus', (e) => {
  e.target.value = '';
});
document.getElementById('foodServingSize').addEventListener('blur', (e) => {
  if (e.target.value === '' || e.target.value === '-') {
    const fallback = state.currentFoodForLog ? getDefaultServingSize(state.currentFoodForLog) : 100;
    e.target.value = formatInputNumber(fallback);
    updateLogFoodPreview();
  }
});
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
    await loadDayLog(getDateKey(state.currentDate));
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
    await loadDayLog(getDateKey(state.currentDate));
    updateMacroDisplay();
    renderFoodLog();
  } catch (error) {
    reportError(error);
  } finally {
    setLoadingVisible(false);
  }
});

// Settings
document.getElementById('settingsBtn').addEventListener('click', () => {
  updateDeviceUploadSection();
  document.getElementById('settingsModal').classList.add('active');
});
document.getElementById('settingsClose').addEventListener('click', () => document.getElementById('settingsModal').classList.remove('active'));

document.getElementById('uploadDeviceBtn')?.addEventListener('click', async () => {
  const userId = sync.getCurrentUserId();
  const legacy = sync.readLegacyLocalState();
  if (!userId || !sync.legacyHasUploadableData(legacy, DEFAULT_FOODS)) return;
  if (!confirm('Upload foods and logs saved on this device to your account?')) return;
  try {
    setLoadingVisible(true);
    await sync.uploadLocalState(userId, legacy, DEFAULT_FOODS, normalizeFood);
    sync.markMigrated(userId);
    await reloadSignedInUserState(userId);
    updateDeviceUploadSection();
    document.getElementById('settingsModal').classList.remove('active');
  } catch (error) {
    reportError(error, 'Could not upload data from this device.');
  } finally {
    setLoadingVisible(false);
  }
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  try {
    const data = await sync.exportCloudState(sync.getCurrentUserId(), DEFAULT_FOODS, normalizeFood);
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `macro-tracker-backup-${getDateKey(new Date())}.json`;
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
      await sync.importCloudState(sync.getCurrentUserId(), data, DEFAULT_FOODS, normalizeFood);
      const userId = sync.getCurrentUserId();
      await reloadSignedInUserState(userId);
      state.activityLevel = await sync.fetchActivityLevel(userId);
      state.dailyLogs = {};
      await loadDayLog(getDateKey(state.currentDate));
      const prefs = sync.readLocalPreferences();
      state.recentSearches = prefs.recentSearches || [];
      setDropdownValue('activityDropdown', state.activityLevel);
      updateDateDisplay();
      updateMacroDisplay();
      renderFoodLog();
      document.getElementById('settingsModal').classList.remove('active');
    } catch (err) {
      reportError(err, 'Invalid backup file or import failed.');
    } finally {
      setLoadingVisible(false);
      e.target.value = '';
    }
  };
  reader.readAsText(file);
});

document.getElementById('clearLogsBtn').addEventListener('click', async () => {
  if (!confirm('Clear all logged foods? Your custom food database will be kept.')) return;
  try {
    setLoadingVisible(true);
    await sync.clearAllLogs(sync.getCurrentUserId());
    state.dailyLogs = {};
    saveState();
    updateMacroDisplay();
    renderFoodLog();
    document.getElementById('settingsModal').classList.remove('active');
  } catch (error) {
    reportError(error);
  } finally {
    setLoadingVisible(false);
  }
});

function updateDateDisplay() {
  const current = new Date(state.currentDate);
  const today = new Date(); today.setHours(0,0,0,0);
  const cmp = new Date(current); cmp.setHours(0,0,0,0);
  if (cmp.getTime() === today.getTime()) {
    document.getElementById('dateDisplay').textContent = 'Today';
  } else {
    document.getElementById('dateDisplay').textContent = current.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}

async function reloadSignedInUserState(userId) {
  const cloudFoods = await sync.fetchCustomFoods(userId);
  state.foods = sync.mergeFoodLibrary(DEFAULT_FOODS, cloudFoods, normalizeFood);
  state.activityLevel = await sync.fetchActivityLevel(userId);
  const prefs = sync.readLocalPreferences();
  state.recentSearches = prefs.recentSearches || [];
  await loadDayLog(getDateKey(state.currentDate));
  setDropdownValue('activityDropdown', state.activityLevel);
  updateDateDisplay();
  updateMacroDisplay();
  renderFoodLog();
  refreshIcons();
}

function updateDeviceUploadSection() {
  const section = document.getElementById('deviceUploadSection');
  if (!section) return;
  const legacy = sync.readLegacyLocalState();
  section.hidden = !sync.legacyHasUploadableData(legacy, DEFAULT_FOODS);
}

async function initializeSignedInUser(userId) {
  setLoadingVisible(true);
  try {
    const legacy = sync.readLegacyLocalState();
    if (await sync.shouldUploadLocalState(userId, legacy, DEFAULT_FOODS)) {
      await sync.uploadLocalState(userId, legacy, DEFAULT_FOODS, normalizeFood);
      sync.markMigrated(userId);
    }
    await reloadSignedInUserState(userId);
  } finally {
    setLoadingVisible(false);
    updateDeviceUploadSection();
  }
}

async function handleSession(session) {
  if (!session) {
    if (!sync.hasAuthCallbackInUrl()) setAuthVisible(true);
    return;
  }
  try {
    const allowed = await sync.isAllowedUser(session.user.email);
    if (!allowed) {
      await sync.signOut();
      reportAuthError(new Error('This Google account does not have access yet.'));
      setAuthVisible(true);
      return;
    }
    setAuthVisible(false);
    await initializeSignedInUser(session.user.id);
  } catch (error) {
    reportAuthError(error);
    setAuthVisible(true);
  }
}

async function boot() {
  try {
    sync.initSupabase();
    document.getElementById('googleSignInBtn')?.addEventListener('click', async () => {
      try {
        reportAuthError({ message: '' });
        await sync.signInWithGoogle();
      } catch (error) {
        reportAuthError(error);
      }
    });
    document.getElementById('signOutBtn')?.addEventListener('click', async () => {
      try {
        await sync.signOut();
      } catch (error) {
        reportError(error);
      }
    });
    sync.onAuthStateChange((session) => {
      if (session) void handleSession(session);
    });

    const callbackError = sync.getAuthCallbackError();
    if (callbackError) {
      sync.clearAuthCallbackFromUrl();
      reportAuthError(new Error(callbackError));
      setAuthVisible(true);
      return;
    }

    if (sync.hasAuthCallbackInUrl()) {
      setLoadingVisible(true);
      try {
        await sync.finishAuthFromUrl();
      } catch (error) {
        reportAuthError(error);
        setAuthVisible(true);
        return;
      } finally {
        setLoadingVisible(false);
      }
    }

    const session = await sync.getSession();
    if (session) await handleSession(session);
    else setAuthVisible(true);
  } catch (error) {
    reportAuthError(error);
    setAuthVisible(true);
  }
}

Object.assign(window, {
  openAddFoodModal,
  selectFoodForLog,
  editFoodInDB,
  editFoodLog,
});

boot();
