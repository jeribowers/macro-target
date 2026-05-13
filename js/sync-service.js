import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const MIGRATION_PREFIX = 'macroTrackerMigrated_';
const PREFERENCES_KEY = 'macroTrackerPreferences';
const LEGACY_STATE_KEY = 'macroTrackerState';

let client = null;
let currentUserId = null;

function getRedirectUrl() {
  const path = window.location.pathname.replace(/\/$/, '');
  return `${window.location.origin}${path || ''}`;
}

function toErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}

function gramsForQuantity(quantity, unit) {
  const conversions = { g: 1, ml: 1, oz: 28.35, cup: 240, tbsp: 15, tsp: 5, piece: 100 };
  const amount = Number(quantity) || 0;
  return amount * (conversions[unit] || 1);
}

export function initSupabase() {
  if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR_PROJECT')) {
    throw new Error('Supabase is not configured. Copy config.example.js to config.js and add your project values.');
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export function getClient() {
  return client;
}

export function getCurrentUserId() {
  return currentUserId;
}

export function setCurrentUserId(userId) {
  currentUserId = userId || null;
}

export async function getSession() {
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(toErrorMessage(error, 'Could not read your sign-in session.'));
  return data.session;
}

export function onAuthStateChange(callback) {
  return client.auth.onAuthStateChange((_event, session) => {
    setCurrentUserId(session?.user?.id || null);
    callback(session);
  });
}

export async function signInWithGoogle() {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getRedirectUrl() },
  });
  if (error) throw new Error(toErrorMessage(error, 'Google sign-in failed.'));
}

export async function signOut() {
  const { error } = await client.auth.signOut();
  if (error) throw new Error(toErrorMessage(error, 'Sign-out failed.'));
}

export async function isAllowedUser(email) {
  if (!email) return false;
  const { data, error } = await client
    .from('allowed_users')
    .select('email')
    .eq('email', email)
    .maybeSingle();
  if (error) throw new Error(toErrorMessage(error, 'Could not verify account access.'));
  return Boolean(data);
}

export function hasMigrated(userId) {
  return localStorage.getItem(`${MIGRATION_PREFIX}${userId}`) === '1';
}

export function markMigrated(userId) {
  localStorage.setItem(`${MIGRATION_PREFIX}${userId}`, '1');
}

export function readLegacyLocalState() {
  const saved = localStorage.getItem(LEGACY_STATE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export function readLocalPreferences() {
  const saved = localStorage.getItem(PREFERENCES_KEY);
  if (!saved) return { recentSearches: [] };
  try {
    const parsed = JSON.parse(saved);
    return { recentSearches: parsed.recentSearches || [] };
  } catch {
    return { recentSearches: [] };
  }
}

export function saveLocalPreferences(preferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
    recentSearches: preferences.recentSearches || [],
  }));
}

export function rowToFood(row) {
  const servingUnit = row.serving_unit || row.unit || 'g';
  const servingSize = Number(row.serving_size ?? row.default_grams ?? 100) || 100;
  const defaultServingSize = Number(row.default_serving_size ?? row.default_grams ?? servingSize) || servingSize;
  return {
    id: row.external_id || row.id,
    cloudId: row.id,
    name: row.name,
    servingSize,
    servingUnit,
    defaultServingSize,
    calories: Number(row.cal100 ?? 0),
    carbs: Number(row.carb100 ?? 0),
    protein: Number(row.prot100 ?? 0),
    fat: Number(row.fat100 ?? 0),
  };
}

export function foodToRow(food, userId) {
  return {
    user_id: userId,
    external_id: String(food.id).startsWith('custom_') ? food.id : null,
    name: food.name,
    unit: food.servingUnit || 'g',
    default_grams: gramsForQuantity(food.defaultServingSize ?? food.servingSize ?? 100, food.servingUnit || 'g'),
    serving_size: food.servingSize ?? 100,
    serving_unit: food.servingUnit || 'g',
    default_serving_size: food.defaultServingSize ?? food.servingSize ?? 100,
    cal100: food.calories ?? 0,
    carb100: food.carbs ?? 0,
    prot100: food.protein ?? 0,
    fat100: food.fat ?? 0,
    updated_at: new Date().toISOString(),
  };
}

export function rowToLogItem(row, foodsByKey) {
  const foodKey = row.food_external_id || row.name;
  const food = foodsByKey.get(foodKey) || foodsByKey.get(row.name) || {
    id: row.food_external_id || `remote_${row.id}`,
    name: row.name,
    servingSize: 100,
    servingUnit: row.unit || 'g',
    defaultServingSize: row.quantity || 100,
    calories: row.calories || 0,
    carbs: row.carbs || 0,
    protein: row.protein || 0,
    fat: row.fat || 0,
  };
  return {
    cloudId: row.id,
    food,
    quantity: Number(row.quantity ?? row.grams ?? 100),
    unit: row.unit || 'g',
    macros: {
      calories: Number(row.calories ?? 0),
      carbs: Number(row.carbs ?? 0),
      protein: Number(row.protein ?? 0),
      fat: Number(row.fat ?? 0),
    },
  };
}

export function logItemToRow(item, userId, logDate, meal) {
  const unit = item.unit || 'g';
  const quantity = Number(item.quantity ?? 0);
  return {
    user_id: userId,
    log_date: logDate,
    meal,
    name: item.food.name,
    food_external_id: item.food.id,
    quantity,
    unit,
    grams: gramsForQuantity(quantity, unit),
    calories: item.macros?.calories ?? 0,
    protein: item.macros?.protein ?? 0,
    carbs: item.macros?.carbs ?? 0,
    fat: item.macros?.fat ?? 0,
    updated_at: new Date().toISOString(),
  };
}

function buildFoodLookup(foods) {
  const lookup = new Map();
  foods.forEach((food) => {
    lookup.set(food.id, food);
    lookup.set(food.name, food);
    if (food.cloudId) lookup.set(food.cloudId, food);
  });
  return lookup;
}

export async function fetchCustomFoods(userId) {
  const { data, error } = await client
    .from('foods')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw new Error(toErrorMessage(error, 'Could not load your custom foods.'));
  return (data || []).map(rowToFood);
}

export async function createCustomFood(userId, food) {
  const { data, error } = await client
    .from('foods')
    .insert(foodToRow(food, userId))
    .select('*')
    .single();
  if (error) throw new Error(toErrorMessage(error, 'Could not save the new food.'));
  return rowToFood(data);
}

export async function updateCustomFood(userId, food) {
  if (!food.cloudId) throw new Error('This food is not saved to your account yet.');
  const { data, error } = await client
    .from('foods')
    .update(foodToRow(food, userId))
    .eq('id', food.cloudId)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw new Error(toErrorMessage(error, 'Could not update the food.'));
  return rowToFood(data);
}

export async function deleteCustomFood(userId, food) {
  if (!food.cloudId) return;
  const { error } = await client
    .from('foods')
    .delete()
    .eq('id', food.cloudId)
    .eq('user_id', userId);
  if (error) throw new Error(toErrorMessage(error, 'Could not delete the food.'));
}

export async function fetchActivityLevel(userId) {
  const { data, error } = await client
    .from('user_settings')
    .select('activity_level')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(toErrorMessage(error, 'Could not load your activity level.'));
  return data?.activity_level || 'medium';
}

export async function saveActivityLevel(userId, activityLevel) {
  const { error } = await client
    .from('user_settings')
    .upsert({
      user_id: userId,
      activity_level: activityLevel,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw new Error(toErrorMessage(error, 'Could not save your activity level.'));
}

export async function fetchLogEntriesForDate(userId, logDate, foods) {
  const lookup = buildFoodLookup(foods);
  const { data, error } = await client
    .from('log_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .order('created_at');
  if (error) throw new Error(toErrorMessage(error, 'Could not load your food log.'));
  const grouped = { breakfast: [], lunch: [], dinner: [], snack: [] };
  (data || []).forEach((row) => {
    const meal = row.meal || 'breakfast';
    if (!grouped[meal]) grouped[meal] = [];
    grouped[meal].push(rowToLogItem(row, lookup));
  });
  return grouped;
}

export async function createLogEntry(userId, logDate, meal, item) {
  const { data, error } = await client
    .from('log_entries')
    .insert(logItemToRow(item, userId, logDate, meal))
    .select('*')
    .single();
  if (error) throw new Error(toErrorMessage(error, 'Could not add that food to your log.'));
  return data.id;
}

export async function updateLogEntry(userId, item, logDate, meal) {
  if (!item.cloudId) throw new Error('This log entry is not saved to your account yet.');
  const { error } = await client
    .from('log_entries')
    .update(logItemToRow(item, userId, logDate, meal))
    .eq('id', item.cloudId)
    .eq('user_id', userId);
  if (error) throw new Error(toErrorMessage(error, 'Could not update that log entry.'));
}

export async function deleteLogEntry(userId, cloudId) {
  if (!cloudId) return;
  const { error } = await client
    .from('log_entries')
    .delete()
    .eq('id', cloudId)
    .eq('user_id', userId);
  if (error) throw new Error(toErrorMessage(error, 'Could not delete that log entry.'));
}

export async function clearAllLogs(userId) {
  const { error } = await client
    .from('log_entries')
    .delete()
    .eq('user_id', userId);
  if (error) throw new Error(toErrorMessage(error, 'Could not clear your logs.'));
}

export async function uploadLocalState(userId, localState, defaultFoods, normalizeFood) {
  const customFoods = (localState.foods || [])
    .filter((food) => !defaultFoods.some((builtIn) => builtIn.id === food.id))
    .map(normalizeFood);

  for (const food of customFoods) {
    const { error } = await client
      .from('foods')
      .insert(foodToRow(food, userId));
    if (error) throw new Error(toErrorMessage(error, 'Could not upload your custom foods.'));
  }

  const rows = [];
  Object.entries(localState.dailyLogs || {}).forEach(([logDate, dayLog]) => {
    Object.entries(dayLog || {}).forEach(([meal, items]) => {
      (items || []).forEach((item) => {
        rows.push(logItemToRow({
          food: normalizeFood(item.food),
          quantity: item.quantity,
          unit: item.unit,
          macros: item.macros,
        }, userId, logDate, meal));
      });
    });
  });

  if (rows.length > 0) {
    const { error } = await client.from('log_entries').insert(rows);
    if (error) throw new Error(toErrorMessage(error, 'Could not upload your food logs.'));
  }

  if (localState.activityLevel) {
    await saveActivityLevel(userId, localState.activityLevel);
  }
}

export async function exportCloudState(userId, defaultFoods, normalizeFood) {
  const [foods, logsResult, activityLevel] = await Promise.all([
    fetchCustomFoods(userId),
    client.from('log_entries').select('*').eq('user_id', userId).order('log_date'),
    fetchActivityLevel(userId),
  ]);
  if (logsResult.error) throw new Error(toErrorMessage(logsResult.error, 'Could not export your logs.'));

  const mergedFoods = [...defaultFoods.map(normalizeFood), ...foods.map(normalizeFood)];
  const lookup = buildFoodLookup(mergedFoods);
  const dailyLogs = {};
  (logsResult.data || []).forEach((row) => {
    if (!dailyLogs[row.log_date]) {
      dailyLogs[row.log_date] = { breakfast: [], lunch: [], dinner: [], snack: [] };
    }
    const meal = row.meal || 'breakfast';
    if (!dailyLogs[row.log_date][meal]) dailyLogs[row.log_date][meal] = [];
    dailyLogs[row.log_date][meal].push(rowToLogItem(row, lookup));
  });

  return {
    dailyLogs,
    foods: mergedFoods,
    recentSearches: readLocalPreferences().recentSearches,
    activityLevel,
  };
}

export async function importCloudState(userId, payload, defaultFoods, normalizeFood) {
  await clearAllLogs(userId);

  const { data: existingFoods, error: existingFoodsError } = await client
    .from('foods')
    .select('id')
    .eq('user_id', userId);
  if (existingFoodsError) throw new Error(toErrorMessage(existingFoodsError, 'Could not prepare your food library for import.'));

  if ((existingFoods || []).length > 0) {
    const { error } = await client.from('foods').delete().eq('user_id', userId);
    if (error) throw new Error(toErrorMessage(error, 'Could not replace your custom foods.'));
  }

  const customFoods = (payload.foods || [])
    .filter((food) => !defaultFoods.some((builtIn) => builtIn.id === food.id))
    .map(normalizeFood);

  for (const food of customFoods) {
    const { error } = await client.from('foods').insert(foodToRow(food, userId));
    if (error) throw new Error(toErrorMessage(error, 'Could not import your custom foods.'));
  }

  const rows = [];
  Object.entries(payload.dailyLogs || {}).forEach(([logDate, dayLog]) => {
    Object.entries(dayLog || {}).forEach(([meal, items]) => {
      (items || []).forEach((item) => {
        rows.push(logItemToRow({
          food: normalizeFood(item.food),
          quantity: item.quantity,
          unit: item.unit,
          macros: item.macros,
        }, userId, logDate, meal));
      });
    });
  });

  if (rows.length > 0) {
    const { error } = await client.from('log_entries').insert(rows);
    if (error) throw new Error(toErrorMessage(error, 'Could not import your food logs.'));
  }

  if (payload.activityLevel) {
    await saveActivityLevel(userId, payload.activityLevel);
  }

  saveLocalPreferences({ recentSearches: payload.recentSearches || [] });
}
