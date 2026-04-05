# PropManager (hmomanager)

Express serves the static PropManager UI and a small **AI proxy** (`POST /api/ai/messages`). The app uses **Supabase** for auth and data from the browser.

## Setup

1. Copy [.env.example](.env.example) to `.env` and fill in values.
2. `npm install`
3. `npm start` — opens the server (default [http://localhost:3000](http://localhost:3000)).

### Environment variables

| Variable | Where |
|----------|--------|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Browser via `/config.js`; anon key must stay public; protect data with RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — used to verify JWTs on `/api/ai/messages`. Never expose to the client. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_API_URL` | **Server only** — Anthropic calls are proxied; keys are not injected into `window.ENV`. |
| `CORS_ORIGIN` | Optional — comma-separated allowed origins in production (omit for permissive dev CORS). |
| `WORKER_URL` | Used by auth flows (e.g. email redirect). |

## Dashboard scripts

**Source (edit these):**

- [src/dashboard/state.js](src/dashboard/state.js) — initial `state` object (empty portfolio seed; real data loads from Supabase after login).
- [src/dashboard/sections/](src/dashboard/sections/) — UI and Supabase logic split into **51** files by named `// ── … ──` section headers (largest areas: rent, modals, property detail, deal analyzer, etc.).

**Build:** [public/index.html](public/index.html) loads only [public/js/dashboard.bundle.js](public/js/dashboard.bundle.js) (esbuild concatenates sections + IIFE). `npm start` runs `npm run build:dashboard` first. The bundle is ~10k lines of **generated** output — that is expected; you normally edit the smaller files under `src/dashboard/`.

To re-apply plan transforms from a monolithic `public/js/dashboard.js` (e.g. after merging upstream), run:

`python3 scripts/finalize-dashboard.py`

That writes `src/dashboard/state.js`, refreshes `src/dashboard/sections/` via `scripts/split-dashboard-sections.js`, then run `npm run build:dashboard`.

To split an ad-hoc `public/js/dashboard-app.js` into sections without the rest of finalize, run: `node scripts/split-dashboard-sections.js`

## Tests

`npm test` — HTTP checks for `/api/health` and the AI proxy (401/503 behaviour).

## Supabase RLS checklist (audit)

Confirm **Row Level Security** is enabled and policies restrict data by `org_id` (or equivalent) for every table the browser touches, including direct `fetch` to REST from:

- Tenant portal, gallery, rooms, and other `public/js/*.js` clients.

Test with two org accounts: users must not read or write another organisation’s rows.
