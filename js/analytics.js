const LOGGING_DAY_PREFIX = 'macroGaLoggingDay:';
const SESSION_START_KEY = 'macroGaSessionStart:';

function track(eventName, params = {}) {
  if (typeof window.__macroTrack !== 'function') return;
  window.__macroTrack(eventName, params);
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

/** Fires when the user opens the in-app Send Feedback modal. */
export function trackFeedbackOpened() {
  track('feedback_opened');
}

/** Fires after a feedback row has been written to Supabase. */
export function trackFeedbackSubmitted({ recommend, shareEmail }) {
  track('feedback_submitted', {
    recommend: typeof recommend === 'boolean' ? String(recommend) : 'skipped',
    share_email: shareEmail ? 'true' : 'false',
  });
}

/** Fires when a feedback submission fails. */
export function trackFeedbackFailed(reason) {
  track('feedback_failed', { reason: reason || 'unknown' });
}
