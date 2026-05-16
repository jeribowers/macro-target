# Macro Target

A personal macro-tracking PWA. Log meals, manage a Food Library, set targets, and sync data across devices. Install it on your iPhone home screen for a native-like experience.

## URLs


| What                             | URL                                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Production app**               | [https://macrotarget.app/](https://macrotarget.app/)                                                                       |
| **GitHub repository**            | [https://github.com/jeribowers/macro-target](https://github.com/jeribowers/macro-target)                                   |
| **Supabase project** (dashboard) | [https://supabase.com/dashboard/project/crhpnplqqwfgkmmulvuz](https://supabase.com/dashboard/project/crhpnplqqwfgkmmulvuz) |
| **Supabase API**                 | `https://crhpnplqqwfgkmmulvuz.supabase.co`                                                                                 |
| **Local dev**                    | [http://localhost:5173/](http://localhost:5173/) (Vite; use port **5173**)                                                 |


## Tech stack


| Layer                        | Technology                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| **Production UI**            | Vanilla HTML, CSS, ES modules (`index.html`, `js/`, `styles/`)                       |
| **PWA**                      | `manifest.json`, Apple touch icons, standalone display                               |
| **Icons**                    | [Lucide](https://lucide.dev/) (CDN)                                                  |
| **Backend**                  | [Supabase](https://supabase.com/) — Postgres, Row Level Security (RLS), Google OAuth |
| **Analytics**                | [Google Analytics 4](https://analytics.google.com/) — production only (see [ANALYTICS.md](./ANALYTICS.md)) |
| **Hosting**                  | [GitHub Pages](https://pages.github.com/) — deploys from `main` at repo root         |
| **Dev server**               | [Vite](https://vitejs.dev/) — serves the static app locally on port 5173             |
| **In repo (not production)** | React 18 + Recharts under `src/` — experimental rewrite; not wired to `index.html`   |


Shared UI tokens and patterns: see [STYLEGUIDE.md](./STYLEGUIDE.md).

## What the app does

- **Daily Log** — log foods by meal; navigate by date; activity level per day.
- **Food Library** — saved foods with macros; starter foods for new users.
- **Targets** — calorie and macro goals from profile/settings.
- **Sync** — signed-in users sync to Supabase; access is limited to emails in `allowed_users`.
- **Export / import** — JSON backup from Settings (⚙).
- **Retention** — Daily Log entries and per-day activity are purged after **30 days** (server-side); Food Library is kept.

## Repository layout

```
macro-target/
├── index.html              # Production app shell
├── manifest.json           # PWA manifest
├── config.js               # Supabase URL + anon key, GA measurement ID (see Configuration)
├── config.example.js       # Template for config.js
├── ANALYTICS.md            # What we track, planned events, GA vs Supabase
├── js/
│   ├── app.js              # Main app logic
│   ├── sync-service.js     # Supabase auth + data sync
│   └── …                   # Components, templates, profile helpers
├── styles/                 # CSS (tokens in styles/tokens.css)
├── public/                 # Static assets (e.g. manifest copy)
├── supabase/migrations/    # SQL migrations (schema + RLS)
├── src/                    # React rewrite (not used in production)
├── package.json            # Vite dev tooling + token check script
└── STYLEGUIDE.md           # Design system
```

## Prerequisites

- **Node.js** 18+ and npm
- **Git**
- **Supabase CLI** (optional, for migrations): [install guide](https://supabase.com/docs/guides/cli)
- **GitHub CLI** (`gh`) — optional, for repo/Pages management
- Access to the Supabase project and an **allowed** Google account (email must exist in `allowed_users`)

## Configuration

1. Copy the example config:
  ```bash
   cp config.example.js config.js
  ```
2. In the [Supabase dashboard](https://supabase.com/dashboard/project/crhpnplqqwfgkmmulvuz) → **Project Settings** → **API**, copy:
  - **Project URL** → `SUPABASE_URL`
  - **anon public** key → `SUPABASE_ANON_KEY`
3. Set `GA_MEASUREMENT_ID` to your GA4 web stream measurement ID (`G-…`), or leave empty to disable analytics locally and on production.
4. Never put the **service role** key in client code or `config.js`. It belongs only in server-side/Edge Function environments.

The anon key is designed to be public in the browser; security comes from RLS policies, not hiding the anon key.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/)

Vite serves `index.html` and ES modules from the repo root. No production build step is required for the shipped app.

### Supabase auth (Google) for localhost

In Supabase → **Authentication** → **URL configuration**, ensure **Redirect URLs** includes:

- `http://localhost:5173/`
- `http://127.0.0.1:5173/` (if you use that host)

For production, include:

- `https://macrotarget.app/`

Google OAuth must be enabled under **Authentication** → **Providers** → **Google**, with credentials from Google Cloud Console.

Sign-in uses **Google only**. After OAuth, the app checks `allowed_users` for the signed-in email; others see an access-denied message.

## Database and migrations

Schema and RLS live in `supabase/migrations/`. Main tables:


| Table                   | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `allowed_users`         | Emails permitted to use the app                |
| `foods`                 | Food Library per user                          |
| `log_entries`           | Daily Log lines                                |
| `user_settings`         | Profile JSON, default activity level           |
| `daily_activity_levels` | Per-date activity (light / moderate / intense) |


Apply migrations to the linked project:

```bash
supabase login
supabase link --project-ref crhpnplqqwfgkmmulvuz
supabase db push
```

To allow a new user, insert their email into `allowed_users` (via SQL editor or a new migration). Example:

```sql
insert into public.allowed_users (email) values ('person@example.com')
on conflict (email) do nothing;
```

## Deployment (production)

The live app is **static files on GitHub Pages**, not a Vite `dist/` build.

1. Commit and push to `main` on [https://github.com/jeribowers/macro-target](https://github.com/jeribowers/macro-target)
2. GitHub Pages redeploys automatically (usually within ~30 seconds)
3. Public URL: [https://macrotarget.app/](https://macrotarget.app/)

**Pages settings:** Repository → **Settings** → **Pages** → Source: deploy from branch `**main`**, folder `**/ (root)**`.

After deploy, pull-to-refresh on the installed PWA (or close and reopen) to pick up changes.

## Install on iPhone (PWA)

1. Open **Safari** (required for Add to Home Screen)
2. Go to [https://macrotarget.app/](https://macrotarget.app/)
3. Share → **Add to Home Screen**
4. Name it (e.g. “Macro Target”) → **Add**

The app opens standalone without browser chrome.

## npm scripts


| Script        | Command                | Purpose                                                                    |
| ------------- | ---------------------- | -------------------------------------------------------------------------- |
| Dev server    | `npm run dev`          | Vite on [http://localhost:5173/](http://localhost:5173/)                   |
| Preview build | `npm run preview`      | Preview Vite production build (`dist/`) — not used for GitHub Pages deploy |
| Build         | `npm run build`        | Vite build to `dist/` — for React/experiments only                         |
| Design tokens | `npm run check:tokens` | Ensures no raw colors outside `styles/tokens.css`                          |


## Backup and restore

1. In the app, open **Settings** (⚙)
2. **Export** — save the JSON file (iCloud, email, etc.)
3. **Import** — choose a previously exported file

Cloud-synced data also lives in Supabase for signed-in users.

## Troubleshooting

**“Supabase is not configured”**  
Copy `config.example.js` to `config.js` and set real `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

**Google sign-in fails or redirects to a blank page**  
Check Supabase redirect URLs match exactly how you open the app (localhost vs production path).

**“This Google account does not have access yet”**  
Add the account email to `allowed_users` in Supabase.

**Changes not visible on phone**  
Force-quit the PWA and reopen, or refresh in Safari first to bust cache.

**Data missing after changing URL**  
Browser storage is per-origin. Stay on the same URL, or export before switching hosts.

**App icon is a screenshot**  
Confirm `icon-180x180.png` and `icon-512x512.png` exist and load at  
[https://macrotarget.app/icon-180x180.png](https://macrotarget.app/icon-180x180.png)

## React code in `src/`

`src/App.jsx` and `src/main.jsx` are a separate React + Supabase experiment. Production still runs `index.html` + `js/app.js`. Do not point GitHub Pages at `dist/` unless you intentionally migrate the stack.

## Security notes

- All Supabase tables use **RLS**; users only read/write their own rows (except `allowed_users`, which authenticated users can read for their own email check).
- Auth is enforced by Supabase; the client checks `allowed_users` for product access control.
- Do not commit service role keys or Google OAuth client secrets to the repo.

## Related docs

- [STYLEGUIDE.md](./STYLEGUIDE.md) — typography, colors, components, UI rules
- [ANALYTICS.md](./ANALYTICS.md) — GA4 setup, what is tracked today, planned events, privacy, GA vs Supabase
- [Supabase docs](https://supabase.com/docs)
- [Vite docs](https://vitejs.dev/)

