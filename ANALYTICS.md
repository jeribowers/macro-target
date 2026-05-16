# Analytics — Macro Target

Product analytics plan for [macrotarget.app](https://macrotarget.app/). **Primary tool: Google Analytics 4 (GA4)** so reporting stays in one place. **Supabase** is noted only where GA is a poor fit or duplicate data already exists server-side.

---

## Implementation status

| Priority | Scope | Status |
|----------|--------|--------|
| **P0** | Daily Log habit — `food_logged`, `logging_day`, `logging_day_summary`, `analytics_session_start` | **Complete** |
| **P1** | Activation — `login`, `profile_complete`, `screen_view`, auth errors | **Not started** |
| **P2** | Features — library CRUD, `data_export`, `data_import`, `targets_saved` | **Not started** |
| **P3** | Quality — `sync_error`, `save_error`; enhanced scroll/time | **Not started** |

Automatic GA events (page views, scroll, engagement, device) are live via the base tag in `index.html`.

---

## Goals

Understand whether people **reach value** (sign in, log food, set targets), **come back** (logging days, retention), and **use key features** (library, export/import, personalize targets)—without collecting health content or personal identifiers in GA.

---

## Tools

| Tool | Role |
|------|------|
| **GA4** | Traffic, devices, engagement, funnels, custom events. Default for product questions. |
| **Supabase (Postgres)** | Source of truth for food logs, library, profiles. Use for exact per-user / per-day metrics when GA is blocked, incomplete, or awkward to aggregate. |

### Why GA first

- One dashboard for you as the product owner  
- Realtime, explorations, and standard reports without building admin UI  
- Good for **behavioral** signals (clicks, screens, sessions)

### When Supabase is suggested

| Situation | Reason |
|-----------|--------|
| “How many **logging days** per user this month?” | GA can approximate with events; Supabase already has `daily_logs` — exact SQL. |
| “Total items logged on days with 1+ items” | Same — daily log rows are authoritative. |
| Ad blockers | ~10–40% of visits may never hit GA; DB still has synced data for signed-in users. |
| Very small user count | GA may threshold or hide rows; SQL does not. |

**Recommendation:** Implement **custom events in GA** for the questions you care about in one place. Add **optional** Supabase admin queries later if you need audit-grade numbers or blocker-proof reporting.

---

## Privacy & data rules

**Send to GA**

- Event names and **counts** (e.g. `items_added: 3`)  
- Coarse parameters (`screen_name`, `meal`, `change_type`)  
- Page title / screen name (no PII)

**Never send to GA**

- Email, name, Google user id  
- Food names, macros, weights, ages, or export file contents  
- Anything that could identify a person or their diet in a report

**Environment**

- Tracking runs on **production** (`macrotarget.app`) only — not `localhost`.  
- Measurement ID: `G-PJX4FZMC5E` (in `config.js` as `GA_MEASUREMENT_ID`).  
- Debug: append `?ga_debug=1` and use **Admin → DebugView** (not for normal reporting).

---

## Caveats & limitations

Read these before interpreting GA numbers.

| Caveat | What it means |
|--------|----------------|
| **Ad blockers** | Many visits never send data to GA. Signed-in usage in Supabase can be higher than GA shows. |
| **Safari Private / strict privacy** | Often blocks analytics entirely (page and custom events). Test in a normal browser window. |
| **localhost** | No tracking — production (`macrotarget.app`) only. |
| **DebugView** | For testing only. Requires `?ga_debug=1` on the URL. Custom events do not appear there without it. |
| **DebugView UX** | Event names often appear in **Top events** (top-right card, **scroll inside the card**). The center timeline can look empty when nothing arrived in the last few seconds. Pick the correct **Debug Device** (not `0`). |
| **Reports lag** | **Reports → Engagement → Events** can take **24–48 hours** for new custom event names. Use **Realtime** or DebugView for same-day checks. |
| **Small user base** | GA may hide or threshold rows. Supabase SQL is better for exact per-user stats. |
| **PWA / cache** | An old home-screen install may serve stale JS. Open from the browser with a hard refresh (`Cmd + Shift + R`) when verifying changes. |

---

## Currently tracked (live)

| What | Why it’s useful | Tool | How |
|------|-----------------|------|-----|
| **Page views** | Sessions and “Macro Target” traffic | GA4 | Automatic `page_view` via gtag in `index.html` |
| **Active users / unique visitors** | How many people used the app | GA4 | Standard reports (Users, Active users) |
| **Device category** | Desktop vs mobile | GA4 | Automatic (device report) |
| **Engagement time** | Rough time on site | GA4 | Automatic (if Enhanced measurement → engagement enabled in stream) |
| **Scroll** | Content engagement | GA4 | Automatic (Enhanced measurement → scroll, if enabled) |
| **Outbound clicks** | Clicks leaving the site | GA4 | Automatic (Enhanced measurement, if enabled) |
| **Item added to Daily Log** | Core habit | GA4 | `food_logged` (`meal`, `source`) via `js/analytics.js` + `__macroTrack` |
| **Session started** | Pipeline check after sign-in | GA4 | `analytics_session_start` (once per browser session) |
| **Logging day** | Retention | GA4 | `logging_day` (`log_date`) — once per date per session |
| **Items per logging day** | Depth on active days | GA4 | `logging_day_summary` (`log_date`, `item_count`) — after each add |

**Not yet tracked:** screens/modals, library CRUD, export/import, targets saves, sign-in funnel. See [Planned tracking](#planned-tracking).

**Verify in GA (testing):**

1. Ad blocker off. Open **https://macrotarget.app/?ga_debug=1** (hard refresh; normal browser, not Private).
2. Sign in → **Admin → DebugView** → **Debug Device** → select your device (not `0`).
3. Check **Top events** (scroll the card) for `analytics_session_start`, then add food and look for `food_logged`, `logging_day`, `logging_day_summary`.

**Verify in GA (ongoing):** Reports → **Realtime** → event count by name. See [Caveats & limitations](#caveats--limitations) for delays and blockers.

---

## Planned tracking

Custom events below are **not implemented** unless marked **Live** in [Implementation status](#implementation-status) or the Daily Log table.

### Traffic & navigation — P1 (not started)

| Metric | Why it’s useful | Tool | GA event (proposed) | Parameters | Status |
|--------|-----------------|------|---------------------|------------|--------|
| **Unique visitors** | Reach | GA4 | (built-in) | — | Live (automatic) |
| **Screen / area viewed** | Which parts of the app are used (app is one URL) | GA4 | `screen_view` | `screen_name`: `daily_log`, `food_library`, `targets_modal`, `settings_modal`, `auth` | Not started |
| **Time on screen** | Where people stall or engage | GA4 | Derived from engagement + `screen_view` | — | Not started |
| **Scroll depth** | Skimming vs reading (e.g. targets form) | GA4 | `scroll` (enhanced) or manual on key modals | Optional | Partial (enhanced) |

### Activation & auth — P1 (not started)

| Metric | Why it’s useful | Tool | GA event | Parameters | Status |
|--------|-----------------|------|----------|------------|--------|
| **Sign-in started** | Funnel top | GA4 | `login_start` | `method`: `google` | Not started |
| **Sign-in success** | Completed access | GA4 | `login` | `method`: `google` | Not started |
| **Sign-in error** | Auth friction | GA4 | `login_error` | `error_type` (coarse, no message text) | Not started |
| **Profile / targets complete** | Onboarding quality | GA4 | `profile_complete` | — | Not started |

### Core habit — Daily Log

| Metric | Why it’s useful | Tool | GA event | Parameters | Status |
|--------|-----------------|------|----------|------------|--------|
| **Item added to Daily Log** | Core product value | GA4 | `food_logged` | `meal`, `source`: `search` \| `library` \| `new_food` | **Live** |
| **Item removed from log** | Editing behavior | GA4 | `food_log_removed` | `meal` | Not started |
| **Session started** | Verify custom events reach GA | GA4 | `analytics_session_start` | — | **Live** (once per session after sign-in) |
| **Logging day** | Retention (“did they log today?”) | GA4 | `logging_day` | `log_date` as `YYYY-MM-DD` | **Live** (once per date per browser session) |
| **Items per logging day** | Depth of use on active days | GA4 | `logging_day_summary` | `log_date`, `item_count` | **Live** (after each add, cumulative count for that date) |

**Supabase alternative (optional):**  
`SELECT date, COUNT(*) FROM daily log entries GROUP BY date` — use for “days with 1+ items” and “items per day” across all users without event design.

### Food Library — P2 (not started)

| Metric | Why it’s useful | Tool | GA event | Parameters | Status |
|--------|-----------------|------|----------|------------|--------|
| **Food created in library** | Catalog growth | GA4 | `library_food_created` | — | Not started |
| **Food edited in library** | Maintenance | GA4 | `library_food_edited` | — | Not started |
| **Food deleted from library** | Churn of catalog | GA4 | `library_food_deleted` | — | Not started |

### Data management (Settings) — P2 (not started)

| Metric | Why it’s useful | Tool | GA event | Parameters | Status |
|--------|-----------------|------|----------|------------|--------|
| **Export success** | Backup / trust behavior | GA4 | `data_export` | — | Not started |
| **Import success** | Restore / migration | GA4 | `data_import` | — | Not started |
| **Import failure** | Broken files or errors | GA4 | `data_import_error` | `error_type` (coarse) | Not started |

### Personalize Targets — P2 (not started)

| Metric | Why it’s useful | Tool | GA event | Parameters | Status |
|--------|-----------------|------|----------|------------|--------|
| **Targets saved** | Feature adoption | GA4 | `targets_saved` | `change_type`: `profile` \| `macros` \| `activity_levels` \| `reset_defaults` | Not started |
| **Modal opened** | Interest in customization | GA4 | `targets_opened` | — | Not started |

### Reliability — P3 (not started)

| Metric | Why it’s useful | Tool | GA event | Parameters | Status |
|--------|-----------------|------|----------|------------|--------|
| **Sync error** | Silent failures | GA4 | `sync_error` | `operation` (coarse) | Not started |
| **Save error** | Data loss risk | GA4 | `save_error` | `context`: `profile` \| `food` \| `log` | Not started |

---

## What’s missing (recommended additions)

| Area | Metric | Why |
|------|--------|-----|
| **Retention** | Return within 7 days | Habit vs one-time try |
| **Retention** | Logging days per week | Stronger than page views for this product |
| **Discovery** | Activity level changed on Daily Log | Uses multipliers—are defaults wrong? |
| **Discovery** | Date navigation (not “today”) | Backfilling vs same-day only |
| **Quality** | Search used vs manual add | UX of add-food flow |
| **Distribution** | PWA / standalone display mode | Home-screen install (if detectable) |

These can stay in GA as events; **logging days per week** is the one metric most worth a **Supabase** backup report if GA feels light.

---

## GA vs Supabase — quick reference

| Your question | Best in GA4 | Supabase if… |
|---------------|-------------|--------------|
| How many unique visitors? | Yes | You need exact allowed-user list |
| What “pages” / areas? | Yes (`screen_view` events) | — |
| Time on site / scroll? | Yes (enhanced + engagement) | — |
| Foods added to library? | Yes (`library_food_created`) | Exact totals per account |
| Days with 1+ log items; items per day? | Yes (with `logging_day` / summary events) | You want blocker-proof or per-user admin numbers |
| Export / import frequency? | Yes (`data_export` / `data_import`) | Audit trail in DB (not built today) |
| Personalize targets changes? | Yes (`targets_saved`) | Full before/after history (don’t put in GA) |

---

## Where to look in GA4

| Question | Report |
|----------|--------|
| Live usage now | Reports → **Realtime** |
| Unique users over time | Reports → **Acquisition** or **User** → Active users |
| Page / screen popularity | Reports → **Engagement** → Pages and screens |
| Custom actions (after implemented) | **Explore** → Free form, or **Reports → Engagement → Events** |
| Testing a change | Admin → **DebugView** with `?ga_debug=1`; event names in **Top events** (scroll the card) |
| Same-day custom events | Reports → **Realtime** (not DebugView without `?ga_debug=1`) |

Register custom events as **key events** in GA only if you use them as goals (e.g. `food_logged`, `logging_day`).

---

## Implementation notes (for developers)

- **Config:** `GA_MEASUREMENT_ID` in `config.js` / `config.example.js`.  
- **Loader:** Inline gtag bootstrap in `index.html` (skips localhost).  
- **Helper:** `js/analytics.js` — `trackDailyLogFoodAdded()` for P0 events; no-ops on localhost; sanitizes parameters.  
- **SPA:** Fire `screen_view` when opening modals (Personalize, Settings) and major UI states—not only initial load.  
- **Do not** duplicate Supabase row data in GA; send **counts and action types** only.

---

## Summary

| Priority | Track in GA4 | Status |
|----------|----------------|--------|
| **P0 (habit)** | `food_logged`, `logging_day`, `logging_day_summary`, `analytics_session_start` | **Complete** |
| **P1 (activation)** | `login`, `profile_complete`, `screen_view` | **Not started** |
| **P2 (features)** | `library_food_*`, `data_export`, `data_import`, `targets_saved` | **Not started** |
| **P3 (quality)** | `sync_error`, `login_error`, scroll/time via enhanced measurement | **Not started** |

**Supabase:** Optional later for admin dashboards on logging days and per-user stats when GA is incomplete. See [Caveats & limitations](#caveats--limitations) before trusting GA alone.
