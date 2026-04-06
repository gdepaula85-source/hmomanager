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
| `RESEND_API_KEY` | **Server only** — `POST /api/email/send` sends via [Resend](https://resend.com) (tenant rent reminders, manager reports). Verify `landlordapp.io` in Resend and set `MAIL_FROM` if needed. |
| `MAIL_FROM` | Optional — default `LandlordApp <noreply@landlordapp.io>`; must use a verified domain in Resend. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **Server only** — Stripe API + webhook signing for subscriptions. |
| `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_BUSINESS` | Stripe recurring price IDs mapped to in-app plans. |
| `APP_BASE_URL` | Optional — base URL used by Stripe success/cancel and portal return URLs (defaults to `http://localhost:3000`). |

## Email (two tiers)

1. **Platform / auth** — Sign-up, password reset, and magic links are handled by **Supabase Auth** (configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) in the Supabase dashboard if you want emails to go through Resend or your Hostinger mailbox). Subscription/receipt emails typically come from **Stripe** (or your billing provider) if you use it.

2. **Org / tenant-facing** — Rent reminders, weekly/monthly reports, and other actions from **Settings → Email** use **`POST /api/email/send`** on this Node server. Messages are sent **From** `noreply@landlordapp.io` (or `MAIL_FROM`) with **Reply-To** set to the organisation’s `billing_email` or `owner_email` (see `organisations` table). No per-client API keys in the browser.

**Database:** Run [`db/organisations_email_settings.sql`](db/organisations_email_settings.sql) on Supabase if `email_settings` is not already on `organisations` (stores trigger toggles and manager email per org).

**DNS:** In the Resend dashboard, add and verify the `landlordapp.io` domain; use the DNS records they show (SPF/DKIM). This is independent of Hostinger mailbox creation for `admin@`.

**Resend “senders”:** After the domain is verified, you do **not** need a separate “Add sender” action in Resend. You may send from any address on that domain, for example `noreply@landlordapp.io`, `billing@landlordapp.io`, or `support@landlordapp.io`, by setting `MAIL_FROM` (default is `LandlordApp <noreply@landlordapp.io>`). The app uses Resend’s REST API from [`server.js`](server.js) (`POST https://api.resend.com/emails`), which is equivalent to the official `resend` Node SDK.

**Scheduled automation** (weekly/monthly without clicking the button) is not implemented yet; use an external cron or Supabase `pg_cron` later to call a secured endpoint or queue jobs.

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

`npm test` — HTTP checks for `/api/health`, the AI proxy (401/503), and `/api/email/send` (401/503).

## Stripe subscriptions

- Frontend uses:
  - `POST /api/stripe/create-checkout-session` (starts Stripe Checkout for a plan)
  - `POST /api/stripe/create-portal-session` (opens Stripe Billing Portal)
- Stripe webhook endpoint: `POST /api/stripe/webhook`
  - Handles `checkout.session.completed` and `customer.subscription.*`
  - Syncs `organisations.plan`, `organisations.status`, `stripe_customer_id`, `stripe_subscription_id`, and `mrr`

## Supabase RLS checklist (audit)

Confirm **Row Level Security** is enabled and policies restrict data by `org_id` (or equivalent) for every table the browser touches, including direct `fetch` to REST from:

- Tenant portal, gallery, rooms, and other `public/js/*.js` clients.

Test with two org accounts: users must not read or write another organisation’s rows.
