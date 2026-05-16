/** Shared HTML fragments for Daily Log and food search. */

export function renderFoodItemInfo(name, weightLabel, macroLineHtml) {
  return `
    <div class="food-info">
      <div class="food-name-row">
        <p class="food-name">${name}</p>
        <p class="food-weight">${weightLabel}</p>
      </div>
      <p class="food-macros">${macroLineHtml}</p>
    </div>`;
}

export function renderFoodLogEmptyRow(message = 'No foods added.') {
  return `<div class="food-item"><div class="food-info"><p class="food-macros">${message}</p></div></div>`;
}

export function renderSwipeRowLogEntry({ category, index, foodName, foodInfoHtml, deleteIconHtml }) {
  return `
    <div class="swipe-row" data-deletable="true" data-log-category="${category}" data-log-index="${index}">
      <button type="button" class="swipe-delete" data-log-category="${category}" data-log-index="${index}" aria-label="Delete ${foodName}">${deleteIconHtml}</button>
      <div class="food-item swipe-content">
        ${foodInfoHtml}
        <div class="food-actions">
          <button onclick="editFoodLog('${category}', ${index})" title="Edit" aria-label="Edit"><i data-lucide="pencil"></i></button>
        </div>
      </div>
    </div>`;
}

export function renderFoodCategoryBlock({ category, categoryTotalsHtml, listBodyHtml }) {
  return `<div class="food-category">
      <div class="food-category-shell">
        <div class="food-category-header">
          <div class="food-category-title">
            <h3>${category}</h3>
            <div class="category-total">${categoryTotalsHtml}</div>
          </div>
          <button class="add-food-header btn-secondary" onclick="openAddFoodModal('${category}')">+ Add</button>
        </div>
        <div class="food-list">${listBodyHtml}</div>
      </div>
    </div>`;
}

export function renderFoodSearchOption({ foodId, foodName, foodInfoHtml, deleteIconHtml, isBuiltIn }) {
  const optionBody = `<div class="food-option swipe-content" onclick="selectFoodForLog('${foodId}')">
      ${foodInfoHtml}
      <div class="actions">
        <button class="btn-primary btn-icon" onclick="event.stopPropagation(); selectFoodForLog('${foodId}')" title="Add" aria-label="Add"><i data-lucide="plus"></i></button>
        <button class="btn-secondary btn-icon" onclick="event.stopPropagation(); editFoodInDB('${foodId}')" title="Edit in Library" aria-label="Edit in Library"><i data-lucide="pencil"></i></button>
      </div>
    </div>`;
  if (isBuiltIn) return optionBody;
  return `<div class="swipe-row" data-food-id="${foodId}" data-deletable="true">
      <button type="button" class="swipe-delete" data-food-id="${foodId}" aria-label="Delete ${foodName}">${deleteIconHtml}</button>
      ${optionBody}
    </div>`;
}
