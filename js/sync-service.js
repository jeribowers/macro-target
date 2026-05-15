import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

import {
  sanitizeProfile,
  isProfileComplete,
  buildDefaultNewUserProfile,
  profileLevelToAppKey,
} from './profile-calculator.js';

const MIGRATION_PREFIX = 'macroTrackerMigrated_';
const STARTER_SEED_PREFIX = 'macroTrackerStarterSeeded_';
const ONBOARDING_PREFIX = 'macroTrackerOnboarded_';
const PREFERENCES_KEY = 'macroTrackerPreferences';
const LEGACY_STATE_KEY = 'macroTrackerState';
const USER_PROFILE_KEY = 'userProfile';

let client = null;
let currentUserId = null;

function getRedirectUrl() {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function hasAuthCallbackInUrl() {
  const url = new URL(window.location.href);
  if (url.searchParams.has('code')) return true;
  if (url.searchParams.has('error')) return true;
  if (url.hash.includes('access_token=')) return true;
  return false;
}

export function getAuthCallbackError() {
  const url = new URL(window.location.href);
  const error = url.searchParams.get('error_description') || url.searchParams.get('error');
  return error ? decodeURIComponent(error.replace(/\+/g, ' ')) : '';
}

export function clearAuthCallbackFromUrl() {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  window.history.replaceState({}, '', url.toString());
}

export async function finishAuthFromUrl() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new Error(toErrorMessage(error, 'Google sign-in could not be completed.'));
    clearAuthCallbackFromUrl();
    return data.session;
  }
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(toErrorMessage(error, 'Could not read your sign-in session.'));
  if (data.session) clearAuthCallbackFromUrl();
  return data.session;
}

function toErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  return error.message || fallback;
}

function isMissingUserProfileColumn(error) {
  const message = toErrorMessage(error, '').toLowerCase();
  return message.includes('user_profile') && (
    message.includes('does not exist')
    || message.includes('could not find')
    || message.includes('schema cache')
  );
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
        flowType: 'pkce',
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
  return client.auth.onAuthStateChange((event, session) => {
    setCurrentUserId(session?.user?.id || null);
    callback(event, session);
  });
}

export async function signInWithGoogle() {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getRedirectUrl() },
  });
  if (error) throw new Error(toErrorMessage(error, 'Google sign-in failed.'));
}

function clearPersistedAuthSession() {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('sb-') && key.includes('auth-token')) {
      localStorage.removeItem(key);
    }
  });
}

export async function signOut() {
  const TIMEOUT_MS = 4000;
  const localSignOut = client.auth.signOut({ scope: 'local' });
  const timeout = new Promise((resolve) => {
    window.setTimeout(() => resolve({ error: { message: 'Sign-out timed out.' } }), TIMEOUT_MS);
  });
  const { error } = await Promise.race([localSignOut, timeout]);
  if (error) {
    clearPersistedAuthSession();
    const retry = await client.auth.signOut({ scope: 'local' });
    if (retry.error) throw new Error(toErrorMessage(retry.error, 'Sign-out failed.'));
  }
  window.setTimeout(() => {
    void client.auth.signOut({ scope: 'global' }).catch(() => {});
  }, 0);
}

export async function isAllowedUser(email) {
  if (!email) return false;
  const { data, error } = await client
    .from('allowed_users')
    .select('email')
    .ilike('email', email.trim())
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

export function hasStarterFoodsSeeded(userId) {
  return localStorage.getItem(`${STARTER_SEED_PREFIX}${userId}`) === '1';
}

export function markStarterFoodsSeeded(userId) {
  localStorage.setItem(`${STARTER_SEED_PREFIX}${userId}`, '1');
}

export function hasCompletedOnboarding(userId) {
  return localStorage.getItem(`${ONBOARDING_PREFIX}${userId}`) === '1';
}

export function markOnboardingComplete(userId) {
  localStorage.setItem(`${ONBOARDING_PREFIX}${userId}`, '1');
  markStarterFoodsSeeded(userId);
}

export function filterStarterFoods(starterFoods) {
  return (starterFoods || []).filter((food) => {
    const id = String(food?.id ?? '').trim().toLowerCase();
    const name = String(food?.name ?? '').trim().toLowerCase();
    return id !== 'test' && name !== 'test';
  });
}

export async function seedStarterFoodsIfNeeded(userId, starterFoods, normalizeFood) {
  const foods = filterStarterFoods(starterFoods);
  if (!userId || !foods.length) return false;

  const existing = await fetchCustomFoods(userId);
  if (existing.length > 0) {
    markStarterFoodsSeeded(userId);
    return false;
  }

  for (const food of foods) {
    await upsertFood(userId, normalizeFood(food));
  }
  markStarterFoodsSeeded(userId);
  return true;
}

export async function seedDefaultProfileIfNeeded(userId, buildDefaultProfile = buildDefaultNewUserProfile) {
  if (!userId) return false;

  const { data, error } = await client
    .from('user_settings')
    .select('user_profile')
    .eq('user_id', userId)
    .maybeSingle();
  if (error && !isMissingUserProfileColumn(error)) {
    throw new Error(toErrorMessage(error, 'Could not check your profile.'));
  }

  const existing = sanitizeProfile(data?.user_profile);
  if (existing && isProfileComplete(existing)) return false;

  const profile = typeof buildDefaultProfile === 'function'
    ? buildDefaultProfile()
    : buildDefaultNewUserProfile();
  if (!profile) return false;

  const activityKey = profileLevelToAppKey(profile.activityLevel);
  await saveUserProfile(userId, profile, activityKey);
  return true;
}

export async function seedStarterLogEntriesIfNeeded(
  userId,
  logDate,
  starterEntries,
  normalizeFood,
  getMacrosForFood,
) {
  if (!userId || !logDate || !starterEntries?.length || typeof getMacrosForFood !== 'function') {
    return false;
  }

  const { logs } = await getCloudDataCounts(userId);
  if (logs > 0) return false;

  const foods = await fetchCustomFoods(userId);
  if (!foods.length) return false;

  const byId = new Map(foods.map((food) => [food.id, food]));
  let created = false;
  for (const entry of starterEntries) {
    const food = byId.get(entry.foodId);
    if (!food) continue;
    const normalized = normalizeFood(food);
    const unit = normalized.servingUnit || 'g';
    const quantity = normalized.defaultServingSize ?? normalized.servingSize ?? 100;
    const macros = getMacrosForFood(normalized, quantity, unit);
    await createLogEntry(userId, logDate, entry.meal || 'breakfast', {
      food: normalized,
      quantity,
      unit,
      macros,
    });
    created = true;
  }
  return created;
}

export async function runNewUserOnboardingIfNeeded(userId, options = {}) {
  if (!userId) return;

  const {
    starterFoods = [],
    starterLogEntries = [],
    normalizeFood,
    getMacrosForFood,
    getTodayDateKey,
    buildDefaultProfile,
  } = options;

  const counts = await getCloudDataCounts(userId);
  const cloudIsEmpty = counts.foods === 0 && counts.logs === 0;
  if (cloudIsEmpty) {
    localStorage.removeItem(`${ONBOARDING_PREFIX}${userId}`);
    localStorage.removeItem(`${STARTER_SEED_PREFIX}${userId}`);
  } else if (hasCompletedOnboarding(userId)) {
    return;
  }
  const { data: settingsRow, error: settingsError } = await client
    .from('user_settings')
    .select('user_profile')
    .eq('user_id', userId)
    .maybeSingle();
  if (settingsError && !isMissingUserProfileColumn(settingsError)) {
    throw new Error(toErrorMessage(settingsError, 'Could not check your profile.'));
  }
  const hasCompleteProfile = isProfileComplete(sanitizeProfile(settingsRow?.user_profile));

  if (!cloudIsEmpty && counts.foods > 0 && counts.logs > 0 && hasCompleteProfile) {
    markOnboardingComplete(userId);
    return;
  }

  if (typeof normalizeFood === 'function') {
    await seedStarterFoodsIfNeeded(userId, starterFoods, normalizeFood);
  }
  await seedDefaultProfileIfNeeded(userId, buildDefaultProfile);
  if (typeof getMacrosForFood === 'function') {
    const logDate = typeof getTodayDateKey === 'function'
      ? getTodayDateKey()
      : new Date().toISOString().slice(0, 10);
    await seedStarterLogEntriesIfNeeded(
      userId,
      logDate,
      starterLogEntries,
      normalizeFood,
      getMacrosForFood,
    );
  }

  markOnboardingComplete(userId);
}

export function legacyHasUploadableData(localState, defaultFoods) {
  if (!localState || typeof localState !== 'object') return false;
  const customFoods = (localState.foods || []).filter(
    (food) => !defaultFoods.some((builtIn) => builtIn.id === food.id)
  );
  if (customFoods.length > 0) return true;
  const dailyLogs = localState.dailyLogs || {};
  return Object.values(dailyLogs).some((dayLog) =>
    Object.values(dayLog || {}).some((items) => (items || []).length > 0)
  );
}

export async function getCloudDataCounts(userId) {
  const [foodsResult, logsResult] = await Promise.all([
    client.from('foods').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    client.from('log_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  if (foodsResult.error) throw new Error(toErrorMessage(foodsResult.error, 'Could not check your saved foods.'));
  if (logsResult.error) throw new Error(toErrorMessage(logsResult.error, 'Could not check your food log.'));
  return { foods: foodsResult.count ?? 0, logs: logsResult.count ?? 0 };
}

export async function shouldUploadLocalState(userId, localState, defaultFoods) {
  if (!legacyHasUploadableData(localState, defaultFoods)) return false;
  if (!hasMigrated(userId)) return true;
  const counts = await getCloudDataCounts(userId);
  return counts.foods === 0 && counts.logs === 0;
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

const VALID_APP_ACTIVITY_LEVELS = new Set(['low', 'medium', 'high']);

function normalizeAppActivityLevel(level) {
  return VALID_APP_ACTIVITY_LEVELS.has(level) ? level : 'medium';
}

export function readLocalPreferences() {
  const saved = localStorage.getItem(PREFERENCES_KEY);
  if (!saved) return { recentSearches: [], activityLevelsByDate: {} };
  try {
    const parsed = JSON.parse(saved);
    return {
      recentSearches: parsed.recentSearches || [],
      activityLevelsByDate: parsed.activityLevelsByDate || {},
    };
  } catch {
    return { recentSearches: [], activityLevelsByDate: {} };
  }
}

export function saveLocalPreferences(preferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
    recentSearches: preferences.recentSearches || [],
    activityLevelsByDate: preferences.activityLevelsByDate || {},
  }));
}

export function readUserProfile() {
  const saved = localStorage.getItem(USER_PROFILE_KEY);
  if (!saved) return null;
  try {
    return sanitizeProfile(JSON.parse(saved));
  } catch {
    return null;
  }
}

export function writeUserProfile(profile) {
  if (!profile) {
    localStorage.removeItem(USER_PROFILE_KEY);
    return;
  }
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
}

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function dedupeCloudFoodRows(rows) {
  const byKey = new Map();
  (rows || []).forEach((row) => {
    const key = row.external_id || row.id;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      return;
    }
    const existingUpdated = Date.parse(existing.updated_at || '') || 0;
    const nextUpdated = Date.parse(row.updated_at || '') || 0;
    if (nextUpdated >= existingUpdated) {
      byKey.set(key, row);
    }
  });
  return Array.from(byKey.values());
}

export function rowToFood(row) {
  const servingUnit = row.serving_unit || row.unit || 'g';
  const servingSize = toPositiveNumber(row.serving_size) ?? 100;
  const defaultServingSize = toPositiveNumber(row.default_serving_size) ?? servingSize;
  return {
    id: row.external_id || row.id,
    cloudId: row.id,
    name: row.name,
    servingSize,
    servingUnit,
    defaultServingSize,
    calories: Number(row.cal100 ?? row.calories ?? 0),
    carbs: Number(row.carb100 ?? row.carbs ?? row.carbs_g ?? 0),
    protein: Number(row.prot100 ?? row.protein ?? row.protein_g ?? 0),
    fat: Number(row.fat100 ?? row.fat ?? row.fat_g ?? 0),
  };
}

function toMacroNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function foodMacroColumns(food) {
  const calories = toMacroNumber(food.calories);
  const carbs = toMacroNumber(food.carbs);
  const protein = toMacroNumber(food.protein);
  const fat = toMacroNumber(food.fat);
  return {
    cal100: calories,
    carb100: carbs,
    prot100: protein,
    fat100: fat,
    calories,
    carbs_g: carbs,
    protein_g: protein,
    fat_g: fat,
  };
}

export function foodToRow(food, userId) {
  return {
    user_id: userId,
    external_id: String(food.id),
    name: food.name,
    unit: food.servingUnit || 'g',
    default_grams: gramsForQuantity(food.defaultServingSize ?? food.servingSize ?? 100, food.servingUnit || 'g'),
    serving_size: food.servingSize ?? 100,
    serving_unit: food.servingUnit || 'g',
    default_serving_size: food.defaultServingSize ?? food.servingSize ?? 100,
    ...foodMacroColumns(food),
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
    calories: toMacroNumber(item.macros?.calories),
    protein: toMacroNumber(item.macros?.protein),
    carbs: toMacroNumber(item.macros?.carbs),
    fat: toMacroNumber(item.macros?.fat),
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

export function foodDiffersFromDefault(food, defaultFood, normalizeFood) {
  if (!defaultFood) return true;
  const base = normalizeFood(defaultFood);
  const candidate = normalizeFood(food);
  return base.servingSize !== candidate.servingSize
    || base.servingUnit !== candidate.servingUnit
    || base.defaultServingSize !== candidate.defaultServingSize
    || base.calories !== candidate.calories
    || base.carbs !== candidate.carbs
    || base.protein !== candidate.protein
    || base.fat !== candidate.fat
    || base.name !== candidate.name;
}

export function mergeFoodLibrary(defaultFoods, cloudFoods, normalizeFood) {
  const builtInIds = new Set(defaultFoods.map((food) => food.id));
  const overrides = new Map();
  const customFoods = [];

  cloudFoods.forEach((cloudFood) => {
    const normalized = normalizeFood(cloudFood);
    if (builtInIds.has(normalized.id)) {
      overrides.set(normalized.id, normalized);
      return;
    }
    customFoods.push(normalized);
  });

  const mergedBuiltIns = defaultFoods.map((defaultFood) => {
    const override = overrides.get(defaultFood.id);
    if (!override) return normalizeFood(defaultFood);
    return normalizeFood({
      ...defaultFood,
      ...override,
      id: defaultFood.id,
    });
  });

  return [...mergedBuiltIns, ...customFoods];
}

export function replaceFoodInLibrary(foods, savedFood, defaultFoodIds, normalizeFood) {
  const normalized = normalizeFood(savedFood);
  const idx = foods.findIndex((food) => food.id === normalized.id);
  const merged = idx >= 0 && defaultFoodIds.has(normalized.id)
    ? normalizeFood({ ...foods[idx], ...normalized, id: normalized.id })
    : normalized;
  if (idx >= 0) {
    foods[idx] = merged;
  } else {
    foods.push(merged);
  }
  return merged;
}

export async function fetchCustomFoods(userId) {
  const { data, error } = await client
    .from('foods')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(toErrorMessage(error, 'Could not load your custom foods.'));
  return dedupeCloudFoodRows(data).map(rowToFood);
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

async function findFoodRowId(userId, externalId, cloudId) {
  if (cloudId) return cloudId;

  const { data, error } = await client
    .from('foods')
    .select('id')
    .eq('user_id', userId)
    .eq('external_id', externalId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(toErrorMessage(error, 'Could not save the food.'));
  return data?.[0]?.id ?? null;
}

export async function upsertFood(userId, food) {
  const payload = foodToRow(food, userId);
  const existingId = await findFoodRowId(userId, payload.external_id, food.cloudId);

  if (existingId) {
    return updateCustomFood(userId, { ...food, cloudId: existingId });
  }

  try {
    return await createCustomFood(userId, food);
  } catch (error) {
    const message = toErrorMessage(error, '');
    if (!message.includes('duplicate key')) throw error;

    const retryId = await findFoodRowId(userId, payload.external_id, null);
    if (!retryId) throw error;
    return updateCustomFood(userId, { ...food, cloudId: retryId });
  }
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

export async function fetchUserProfile(userId) {
  const { data, error } = await client
    .from('user_settings')
    .select('user_profile, activity_level')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    if (isMissingUserProfileColumn(error)) {
      const activityLevel = await fetchActivityLevel(userId);
      return { profile: readUserProfile(), activityLevel };
    }
    throw new Error(toErrorMessage(error, 'Could not load your profile.'));
  }
  const profile = sanitizeProfile(data?.user_profile) || readUserProfile();
  return { profile, activityLevel: data?.activity_level || 'medium' };
}

export async function saveActivityLevel(userId, activityLevel) {
  const level = normalizeAppActivityLevel(activityLevel);
  const { error } = await client
    .from('user_settings')
    .upsert({
      user_id: userId,
      activity_level: level,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw new Error(toErrorMessage(error, 'Could not save your activity level.'));
}

export async function fetchActivityLevelForDate(userId, logDate) {
  const { data, error } = await client
    .from('daily_activity_levels')
    .select('activity_level')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .maybeSingle();
  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('daily_activity_levels')) {
      return null;
    }
    throw new Error(toErrorMessage(error, 'Could not load activity level for this day.'));
  }
  return data?.activity_level ? normalizeAppActivityLevel(data.activity_level) : null;
}

export async function fetchActivityLevelsByDate(userId) {
  const { data, error } = await client
    .from('daily_activity_levels')
    .select('log_date, activity_level')
    .eq('user_id', userId);
  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('daily_activity_levels')) {
      return {};
    }
    throw new Error(toErrorMessage(error, 'Could not load your activity levels.'));
  }
  const byDate = {};
  (data || []).forEach((row) => {
    if (!row?.log_date) return;
    byDate[row.log_date] = normalizeAppActivityLevel(row.activity_level);
  });
  return byDate;
}

export async function saveActivityLevelForDate(userId, logDate, activityLevel) {
  const level = normalizeAppActivityLevel(activityLevel);
  const { error } = await client
    .from('daily_activity_levels')
    .upsert({
      user_id: userId,
      log_date: logDate,
      activity_level: level,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,log_date' });
  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('daily_activity_levels')) {
      return;
    }
    throw new Error(toErrorMessage(error, 'Could not save activity level for this day.'));
  }
}

function toAppActivityLevel(level) {
  if (level === 'low' || level === 'medium' || level === 'high') return level;
  if (level === 'Low') return 'low';
  if (level === 'High') return 'high';
  return 'medium';
}

export async function saveUserProfile(userId, profile, activityLevel) {
  const appLevel = toAppActivityLevel(activityLevel || profile?.activityLevel);
  const level = ['low', 'medium', 'high'].includes(appLevel) ? appLevel : 'medium';
  if (profile) writeUserProfile(profile);
  const { error } = await client
    .from('user_settings')
    .upsert({
      user_id: userId,
      activity_level: level,
      user_profile: profile,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) {
    if (isMissingUserProfileColumn(error)) {
      await saveActivityLevel(userId, level);
      return;
    }
    throw new Error(toErrorMessage(error, 'Could not save your profile.'));
  }
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
  const foodsToUpload = (localState.foods || [])
    .map(normalizeFood)
    .filter((food) => {
      const builtIn = defaultFoods.find((defaultFood) => defaultFood.id === food.id);
      if (!builtIn) return true;
      return foodDiffersFromDefault(food, builtIn, normalizeFood);
    });

  for (const food of foodsToUpload) {
    await upsertFood(userId, food);
  }

  const { logs: existingLogCount } = await getCloudDataCounts(userId);
  const rows = [];
  if (existingLogCount === 0) {
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
  }

  if (rows.length > 0) {
    const { error } = await client.from('log_entries').insert(rows);
    if (error) throw new Error(toErrorMessage(error, 'Could not upload your food logs.'));
  }

  if (localState.activityLevel) {
    await saveActivityLevel(userId, localState.activityLevel);
  }

  const localProfile = readUserProfile();
  if (localProfile) {
    await saveUserProfile(userId, localProfile, localState.activityLevel);
  }
}

export async function exportCloudState(userId, defaultFoods, normalizeFood) {
  const [foods, logsResult, activityLevel, activityLevelsByDate, profileResult] = await Promise.all([
    fetchCustomFoods(userId),
    client.from('log_entries').select('*').eq('user_id', userId).order('log_date'),
    fetchActivityLevel(userId),
    fetchActivityLevelsByDate(userId),
    fetchUserProfile(userId),
  ]);
  if (logsResult.error) throw new Error(toErrorMessage(logsResult.error, 'Could not export your logs.'));

  const mergedFoods = mergeFoodLibrary(defaultFoods, foods, normalizeFood);
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
    activityLevelsByDate,
    userProfile: profileResult.profile || readUserProfile(),
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

  const foodsToImport = (payload.foods || []).map(normalizeFood);
  for (const food of foodsToImport) {
    const builtIn = defaultFoods.find((defaultFood) => defaultFood.id === food.id);
    if (builtIn) {
      if (!foodDiffersFromDefault(food, builtIn, normalizeFood)) continue;
      await upsertFood(userId, food);
      continue;
    }
    await upsertFood(userId, food);
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

  if (payload.userProfile) {
    const profile = sanitizeProfile(payload.userProfile);
    if (profile) {
      writeUserProfile(profile);
      await saveUserProfile(userId, profile, payload.activityLevel);
    }
  } else if (payload.activityLevel) {
    await saveActivityLevel(userId, payload.activityLevel);
  }

  const activityLevelsByDate = payload.activityLevelsByDate || {};
  await Promise.all(
    Object.entries(activityLevelsByDate).map(([logDate, level]) =>
      saveActivityLevelForDate(userId, logDate, level),
    ),
  );

  saveLocalPreferences({
    recentSearches: payload.recentSearches || [],
    activityLevelsByDate,
  });
}
