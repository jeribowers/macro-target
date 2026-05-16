import { GA_MEASUREMENT_ID } from '../config.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const LOGGING_DAY_PREFIX = 'macroGaLoggingDay:';
const SESSION_START_KEY = 'macroGaSessionStart:';

function isTrackingEnabled() {
  return typeof window.gtag === 'function' && !LOCAL_HOSTS.has(location.hostname) && Boolean(GA_MEASUREMENT_ID);
}

function isDebugMode() {
  return /(?:^|[?&])ga_debug=1(?:&|$)/.test(location.search);
}

function track(eventName, params = {}) {
  if (!isTrackingEnabled()) return;
  const safe = { send_to: GA_MEASUREMENT_ID };
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    if (typeof value === 'string' || typeof value === 'number') safe[key] = value;
  });
  if (isDebugMode()) safe.debug_mode = true;
  window.gtag('event', eventName, safe);
}

/** Fires once per browser session after sign-in — use to verify custom events reach GA. */
export function trackSessionStart() {
  try {
    if (sessionStorage.getItem(SESSION_START_KEY) === '1') return;
    sessionStorage.setItem(SESSION_START_KEY, '1');
  } catch {
    /* private mode */
  }
  track('analytics_session_start');
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
      track('logging_day', { log_date: dateKey });
      sessionStorage.setItem(dayFlagKey, '1');
    }
  } catch {
    track('logging_day', { log_date: dateKey });
  }

  track('logging_day_summary', { log_date: dateKey, item_count: itemCount });
}
