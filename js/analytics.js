const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const LOGGING_DAY_PREFIX = 'macroGaLoggingDay:';

function isTrackingEnabled() {
  return typeof window.gtag === 'function' && !LOCAL_HOSTS.has(location.hostname);
}

function isDebugMode() {
  return /(?:^|[?&])ga_debug=1(?:&|$)/.test(location.search);
}

function track(eventName, params = {}) {
  if (!isTrackingEnabled()) return;
  const safe = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    if (typeof value === 'string' || typeof value === 'number') safe[key] = value;
  });
  if (isDebugMode()) safe.debug_mode = true;
  window.gtag('event', eventName, safe);
}

/**
 * P0 — Daily Log habit events (see ANALYTICS.md).
 * @param {{ meal: string, source: 'search'|'library'|'new_food', dateKey: string, itemCount: number }} opts
 */
export function trackDailyLogFoodAdded({ meal, source, dateKey, itemCount }) {
  track('food_logged', { meal, source });

  try {
    const dayFlagKey = `${LOGGING_DAY_PREFIX}${dateKey}`;
    if (sessionStorage.getItem(dayFlagKey) !== '1') {
      track('logging_day', { date: dateKey });
      sessionStorage.setItem(dayFlagKey, '1');
    }
  } catch {
    track('logging_day', { date: dateKey });
  }

  track('logging_day_summary', { date: dateKey, item_count: itemCount });
}
