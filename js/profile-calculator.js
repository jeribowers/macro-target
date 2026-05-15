const ACTIVITY_FACTORS = { low: 1.2, medium: 1.55, high: 1.725 };
const GOAL_ADJUSTMENTS = { Maintain: 0, Lose: -300, Gain: 300 };
const SEX_OFFSETS = { M: 5, F: -161, Other: -78 };

export const PROFILE_VERSION = 1;
export const ACTIVITY_APP_KEYS = ['low', 'medium', 'high'];
export const TARGET_MACROS = ['calories', 'fat', 'carbs', 'protein'];

export const ACTIVITY_LEVEL_NAMES = {
  low: { display: 'Light', abbrev: 'Low' },
  medium: { display: 'Moderate', abbrev: 'Med' },
  high: { display: 'Intense', abbrev: 'High' },
};

export function formatActivityLevelHeading(appKey) {
  const names = ACTIVITY_LEVEL_NAMES[appKey] || ACTIVITY_LEVEL_NAMES.medium;
  return names.display;
}

export function createEmptyTargetFieldLocks() {
  const locks = {};
  ACTIVITY_APP_KEYS.forEach((key) => {
    locks[key] = { calories: false, fat: false, carbs: false, protein: false };
  });
  return locks;
}

export function normalizeTargetFieldLocks(raw) {
  const locks = createEmptyTargetFieldLocks();
  if (!raw || typeof raw !== 'object') return locks;
  ACTIVITY_APP_KEYS.forEach((key) => {
    const level = raw[key];
    if (!level || typeof level !== 'object') return;
    TARGET_MACROS.forEach((macro) => {
      if (level[macro] === true) locks[key][macro] = true;
    });
  });
  return locks;
}

export function inferTargetFieldLocks(profileBody, targetsByLevel) {
  const locks = createEmptyTargetFieldLocks();
  ACTIVITY_APP_KEYS.forEach((key) => {
    const computed = calculateTargets(profileBody, key);
    const stored = targetsByLevel?.[key];
    if (!computed || !stored) return;
    TARGET_MACROS.forEach((macro) => {
      if (Math.round(Number(stored[macro])) !== computed[macro]) {
        locks[key][macro] = true;
      }
    });
  });
  return locks;
}

export function hasAnyTargetFieldLocks(locks) {
  return ACTIVITY_APP_KEYS.some((key) => TARGET_MACROS.some((macro) => locks[key]?.[macro]));
}

function normalizeTargetsObject(targets) {
  if (!targets || typeof targets !== 'object') return null;
  const calories = Math.round(Number(targets.calories));
  const protein = Math.round(Number(targets.protein));
  const carbs = Math.round(Number(targets.carbs));
  const fat = Math.round(Number(targets.fat));
  if (![calories, protein, carbs, fat].every((n) => Number.isFinite(n) && n >= 0)) return null;
  return { calories, protein, carbs, fat };
}

export function buildTargetsByLevel(profileBody, rawByLevel, fallbackTargets) {
  const byLevel = {};
  ACTIVITY_APP_KEYS.forEach((key) => {
    const fromRaw = rawByLevel?.[key] ? normalizeTargetsObject(rawByLevel[key]) : null;
    const fromCalc = calculateTargets(profileBody, key);
    const fromFallback = key === profileLevelToAppKey(profileBody.activityLevel || 'Med')
      ? normalizeTargetsObject(fallbackTargets)
      : null;
    byLevel[key] = fromRaw || fromFallback || fromCalc;
  });
  return byLevel;
}

export function appKeyToProfileLevel(key) {
  if (key === 'low') return 'Low';
  if (key === 'high') return 'High';
  return 'Med';
}

export function profileLevelToAppKey(level) {
  if (level === 'Low') return 'low';
  if (level === 'High') return 'high';
  return 'medium';
}

export function heightToCm(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === 'in' ? n * 2.54 : n;
}

export function weightToKg(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === 'lb' ? n * 0.453592 : n;
}

const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

function getUserRegion() {
  try {
    const tags = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
    for (const tag of tags) {
      if (!tag) continue;
      const locale = new Intl.Locale(tag);
      if (locale.region) return locale.region.toUpperCase();
    }
  } catch {
    /* Intl.Locale may be unavailable */
  }
  const match = String(navigator.language || '').match(/-([A-Za-z]{2,3})$/);
  return match ? match[1].toUpperCase() : '';
}

/** Default height/weight units from browser locale; falls back to cm/kg when unknown. */
export function getDefaultMeasureUnits() {
  const imperial = IMPERIAL_REGIONS.has(getUserRegion());
  return imperial
    ? { heightUnit: 'in', weightUnit: 'lb' }
    : { heightUnit: 'cm', weightUnit: 'kg' };
}

/** Default personalize targets for new accounts (170 cm / 70 kg baseline, locale-aware units). */
export function buildDefaultNewUserProfile(activityKey = 'medium') {
  const units = getDefaultMeasureUnits();
  const heightCm = 170;
  const weightKg = 70;
  const heightValue = units.heightUnit === 'in' ? Math.round(heightCm / 2.54) : heightCm;
  const weightValue = units.weightUnit === 'lb' ? Math.round(weightKg / 0.453592) : weightKg;
  const activityLevel = appKeyToProfileLevel(activityKey);
  const body = {
    height: { value: heightValue, unit: units.heightUnit },
    weight: { value: weightValue, unit: units.weightUnit },
    age: 30,
    sex: 'F',
    dietGoal: 'Maintain',
    activityLevel,
  };
  const targetsByLevel = {};
  ACTIVITY_APP_KEYS.forEach((key) => {
    targetsByLevel[key] = calculateTargets(body, key);
  });
  return sanitizeProfile({
    ...body,
    targetsByLevel,
    targetsOverridden: false,
    targetFieldLocks: createEmptyTargetFieldLocks(),
  });
}

export function convertHeightValue(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  const cm = heightToCm(value, fromUnit);
  if (cm == null) return null;
  return toUnit === 'in' ? cm / 2.54 : cm;
}

export function convertWeightValue(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  const kg = weightToKg(value, fromUnit);
  if (kg == null) return null;
  return toUnit === 'lb' ? kg / 0.453592 : kg;
}

export function calculateTargets(profile, activityKey) {
  const heightCm = heightToCm(profile.height?.value, profile.height?.unit || 'cm');
  const weightKg = weightToKg(profile.weight?.value, profile.weight?.unit || 'kg');
  const age = Number(profile.age);
  const sex = profile.sex;
  if (!heightCm || !weightKg || !Number.isFinite(age) || age < 1 || age > 120) return null;
  if (!SEX_OFFSETS[sex]) return null;

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + SEX_OFFSETS[sex];
  const factor = ACTIVITY_FACTORS[activityKey] ?? ACTIVITY_FACTORS.medium;
  const tdee = bmr * factor;
  const goalAdj = GOAL_ADJUSTMENTS[profile.dietGoal] ?? 0;
  const calories = Math.round(tdee + goalAdj);

  const protein = Math.round((calories * 0.3) / 4);
  const carbs = Math.round((calories * 0.4) / 4);
  const fat = Math.round((calories * 0.3) / 9);

  return { calories, protein, carbs, fat };
}

export function formatActivityLabel(appKey) {
  const names = ACTIVITY_LEVEL_NAMES[appKey] || ACTIVITY_LEVEL_NAMES.medium;
  return names.display;
}

export function isProfileComplete(profile) {
  if (!profile?.height?.value || !profile?.weight?.value || !profile?.age || !profile?.sex) return false;
  if (!profile.dietGoal) return false;
  return calculateTargets(profile, profileLevelToAppKey(profile.activityLevel || 'Med')) != null;
}

export function sanitizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const sex = ['M', 'F', 'Other'].includes(raw.sex) ? raw.sex : null;
  const activityLevel = ['Low', 'Med', 'High'].includes(raw.activityLevel) ? raw.activityLevel : 'Med';
  const dietGoal = ['Maintain', 'Lose', 'Gain'].includes(raw.dietGoal) ? raw.dietGoal : 'Maintain';
  const heightUnit = raw.height?.unit === 'in' ? 'in' : 'cm';
  const weightUnit = raw.weight?.unit === 'lb' ? 'lb' : 'kg';
  const heightVal = Number(raw.height?.value);
  const weightVal = Number(raw.weight?.value);
  const age = Math.round(Number(raw.age));
  if (!sex || !Number.isFinite(heightVal) || heightVal <= 0) return null;
  if (!Number.isFinite(weightVal) || weightVal <= 0) return null;
  if (!Number.isFinite(age) || age < 1 || age > 120) return null;

  const profile = {
    profileVersion: PROFILE_VERSION,
    height: { value: heightVal, unit: heightUnit },
    weight: { value: weightVal, unit: weightUnit },
    age,
    sex,
    activityLevel,
    dietGoal,
    targetsOverridden: Boolean(raw.targetsOverridden),
    calculatedTargets: null,
    targetsByLevel: null,
  };

  profile.activityLevel = activityLevel;
  const targetsByLevel = buildTargetsByLevel(
    profile,
    raw.targetsByLevel,
    raw.calculatedTargets,
  );
  if (!targetsByLevel.low || !targetsByLevel.medium || !targetsByLevel.high) return null;

  profile.targetsByLevel = targetsByLevel;
  profile.calculatedTargets = targetsByLevel[profileLevelToAppKey(activityLevel)];
  if (!profile.calculatedTargets) return null;

  let targetFieldLocks = normalizeTargetFieldLocks(raw.targetFieldLocks);
  if (!hasAnyTargetFieldLocks(targetFieldLocks) && profile.targetsOverridden) {
    targetFieldLocks = inferTargetFieldLocks(profile, targetsByLevel);
  }
  profile.targetFieldLocks = targetFieldLocks;
  profile.targetsOverridden = hasAnyTargetFieldLocks(targetFieldLocks) || profile.targetsOverridden;

  return profile;
}

export function targetsMatchFormula(profile, targets, activityKey) {
  const computed = calculateTargets(profile, activityKey);
  if (!computed || !targets) return false;
  return (
    computed.calories === targets.calories
    && computed.protein === targets.protein
    && computed.carbs === targets.carbs
    && computed.fat === targets.fat
  );
}

export function targetsByLevelMatchFormula(profileBody, targetsByLevel) {
  return ACTIVITY_APP_KEYS.every((key) => targetsMatchFormula(profileBody, targetsByLevel[key], key));
}
