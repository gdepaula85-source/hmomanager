# LandlordApp.io — AI Agent Knowledge Base

A comprehensive reference for training AI agents to answer questions about LandlordApp.io: what it is, who it's for, every feature, the data model, pricing, billing, technical architecture, common workflows, and troubleshooting.

---

## 1. Product overview

**LandlordApp.io** is a property management SaaS purpose-built for **HMO landlords**, **Rent-to-Rent (R2R) operators**, **Service Accommodation (SA) operators**, **letting agents**, and **portfolio managers** in the United Kingdom.

**Tagline:** "Built for HMO & R2R operators who mean business."

**One-line pitch:** Manage every room, tenant, rent payment, contractor, landlord, expense, compliance certificate, and Airbnb income stream from a single dashboard — without spreadsheets.

**Founder:** Gleydson De Paula. Built the platform after years of running HMOs, R2R deals and Airbnb properties out of multiple disconnected spreadsheets. Could not find a tool on the market that treated HMOs as first-class citizens (most pretend each room is a separate property, or each HMO is a single let — neither model works).

**Core philosophy:**
- Rooms are first-class entities (not afterthoughts).
- Hybrid operators (HMO + SA + R2R) get one unified portfolio view.
- Generic "single-let" assumptions are explicitly rejected.
- Built by a working operator, not a software company guessing at landlord needs.

---

## 2. Target users (operator personas)

### 2a. HMO landlords
- Manage portfolios from 1 to 60+ House-in-Multiple-Occupation properties.
- Need: per-room rent tracking, weekly/4-weekly/monthly schedules, HMO licence + gas safety + EICR + fire-alarm compliance, tenant document vault, contractor coordination.
- Pain point: most software treats an HMO as a single let with rooms tacked on. Doesn't work.

### 2b. Rent-to-Rent (R2R) operators
- Lease properties from landlords, sublet rooms.
- Need: separate landlord rent from tenant rent per property, real margin analysis, void cost tracking, deal analysis before signing.
- Pain point: generic property software collapses everything into "rent" — useless when you need to see both sides of the deal.

### 2c. Letting agents (small / mid-size)
- Manage 10–200 properties on behalf of landlords.
- Need: branded landlord statements, rent reconciliation, contractor jobs, compliance calendar, multi-owner dashboard.
- Pain point: enterprise letting-agent software costs £200/mo+ with weeks of onboarding. The boutique-agent tier didn't exist.

### 2d. Portfolio managers
- 10+ properties; need analytical views, not operational.
- Need: real P&L per property, cash-flow forecast, AI portfolio agent, expense trend analysis, multi-company filtering.
- Pain point: spreadsheets break down past property #8.

### 2e. Service Accommodation (SA) operators
- Run Airbnb / Booking.com / SpareRoom alongside (or instead of) tenancy lets.
- Need: separate SA income tracking, hybrid HMO+SA portfolio views, P&L that splits the two sources.
- Pain point: every SA tool ignores tenanted income, every tenancy tool ignores Airbnb.

---

## 3. Pricing tiers (current as of 2026-04-25)

| Plan | Price (GBP/mo) | Properties | Tenants | Users (seats) |
|---|---|---|---|---|
| **Free** | £0 | 3 | 15 | 2 |
| **Trial** (auto-applied) | £0 | 5 | 30 | 3 |
| **Starter** | £49 | 15 | 75 | 3 |
| **Professional** | £89 | 25 | Unlimited | 5 |
| **Business** | £149 | 60 | Unlimited | 15 |
| **Enterprise** | £299 | Unlimited | Unlimited | Unlimited |

Caps configurable per-tenant via the **Superadmin → Plans & Pricing** card. Custom plan tiers can be added too — unknown plan keys default to UNLIMITED on the DB trigger so they never hard-cap.

**Special billing flags on `organisations`:**
- `billing_override = 'free'` — indefinite free grant (FREE GRANT / partner orgs / demo accounts). Bypasses both plan caps and the Stripe checkout gate.
- `free_until = <date>` — time-boxed free grant. Auto-expires when the date passes.
- `stripe_subscription_id = 'manual'` — admin-granted paid plan without Stripe billing.

**Trial period:** 14 days from signup. After trial ends, accounts on `plan='free'` revert to free-tier limits; accounts that started a paid plan need active Stripe subscription.

---

## 4. Architecture & tech stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JavaScript (no React). Bundled by **esbuild** from `src/dashboard/sections/*.js` into `public/js/dashboard.bundle.js`. |
| Server | **Node.js + Express 5**. Single `server.js` file (~2300 lines). |
| Database | **Supabase Postgres** with full RLS (Row Level Security) on every table. Org isolation via `org_members`. |
| Auth | **Supabase Auth** (email/password + future OAuth). |
| Storage | **Supabase Storage** buckets: `property-docs`, `tenant-docs`, `room-photos`, `blog-images`. |
| Payments | **Stripe** (live mode in prod). Checkout sessions + customer portal + webhooks. |
| Email | **Resend** (transactional emails, lifecycle emails). |
| AI | **Anthropic Claude API** (`/api/ai/messages`) via `ANTHROPIC_API_KEY` env. Used for the Portfolio AI Agent and Deal Analyzer AI verdict. |
| Hosting | **Hostinger** (Node app + static via zip-upload). |
| Domain | landlordapp.io (production) — pointing at Supabase project `kzumoubhxdoqqcucdact`. |

**File layout:**
```
public/                    Static assets + HTML pages (deploy)
  index.html               App shell — dashboard SPA entry point
  superadmin.html          Superadmin panel
  login.html               Login + signup + demo button
  rooms.html               Public-facing rooms / vacancies page
  propmanager-landing.html Marketing landing page
  blog/                    DB-backed blog (server-rendered)
  operators/               5 SEO operator pages (HMO / R2R / agents / portfolio / SA)
  css/                     Stylesheets
  js/                      Pre-built bundles
src/dashboard/             Source for dashboard.bundle.js
  app.js                   Main application orchestrator
  sections/                ~60 modular sections (numbered for build order)
scripts/build-dashboard.js esbuild script
db/                        SQL migrations
docs/                      Internal docs (this file lives here)
server.js                  Node entrypoint
package.json               Dependencies + scripts
```

**Build & deploy:**
- After editing any `src/dashboard/**/*.js`: run `node scripts/build-dashboard.js`. Output is `public/js/dashboard.bundle.js`.
- Server's `cacheBustHtml` middleware in `server.js` automatically stamps a fresh `?v=BUILD_TS` query string on every JS/CSS reference in served HTML, so no manual version bumps needed.
- Deploy: zip `public/`, `src/`, `scripts/`, `package.json`, `package-lock.json`, `server.js` → upload to Hostinger → restart Node process.

---

## 5. Database model (top-level tables)

All operational tables have an `org_id uuid REFERENCES organisations(id) ON DELETE CASCADE` column and are scoped via RLS policies that match against `org_members.user_id = auth.uid()`.

### Core tables

| Table | Purpose | Key columns |
|---|---|---|
| `organisations` | Top-level tenant entity (an "org" = one customer) | `id`, `name`, `owner_email`, `plan`, `status`, `trial_ends_at`, `stripe_customer_id`, `stripe_subscription_id`, `billing_override`, `billing_override_note`, `free_until`, `free_until_note`, `currency`, `language`, `app_config` (jsonb) |
| `org_members` | Links auth users to orgs | `id`, `org_id`, `user_id`, `role` (admin/manager/maintenance/viewer) |
| `properties` | The portfolio | `id`, `org_id`, `name`, `address`, `postcode`, `area`, `type`, `rooms`, `occupied`, `rent`, `landlord_rent`, `landlord_id`, `landlord_name`, `ownership_type` (owned/managed), `letting_type` (hmo/whole), `bedrooms`, `room_list` (jsonb), `mortgage` (jsonb), `purchase_info` (jsonb), `gallery` (jsonb), `inspections` (jsonb), `is_str_enabled`, `status` (active/archived), `archived_at` |
| `tenants` | All tenants (active + inactive) | `id`, `org_id`, `name`, `property_id`, `property_name`, `room_number`, `room_type`, `rent`, `freq` (weekly/4-weekly/monthly), `pay_day`, `pay_day_of_month`, `method` (bank/cash), `status` (active/inactive), `arrears`, `deposit`, `deposit_status`, `whatsapp`, `email`, `start_date`, `move_in`, `notice_date`, `move_out_date`, `dob`, `nationality`, `payment_history` (jsonb) |
| `payments` | Every rent / SA payment, scheduled or paid | `id`, `org_id`, `tenant_id`, `tenant_name`, `property_name`, `amount`, `method`, `status` (scheduled/paid/overdue), `due_date`, `paid_date`, `income_source` (rent/airbnb), `period_start`, `period_end` |
| `landlords` | Property owners (for managed properties) | `id`, `org_id`, `name`, `phone`, `email`, `bank`, `sort_code`, `account_no`, `notes` |
| `landlord_payments` | Landlord rent owed / paid (per property per month) | `id`, `org_id`, `landlord_id`, `property_id`, `month_key`, `amount`, `due_date`, `paid_date`, `status` |
| `companies` | Multi-company filter (operating Ltd companies) | `id`, `org_id`, `name`, `company_no`, `vat_no`, `director`, `address`, `email`, `phone`, `whatsapp`, `color` |
| `maintenance` | Repair / inspection jobs | `id`, `org_id`, `property_id`, `property_name`, `room_number`, `issue`, `category`, `priority` (low/medium/high/urgent), `status` (open/in_progress/resolved), `notes`, `logged_date`, `resolved_date`, `scheduled_date`, `scheduled_time`, `contractor`, `job_cost`, `invoice_url` |
| `expenses` | Recurring + one-off costs | `id`, `org_id`, `category`, `description`, `amount`, `type` (property/staff/overhead/actual), `status` (estimated/confirmed), `freq`, `recurring`, `start_date`, `property_id`, `property_name`, `receipt_url` |
| `contractors` | Trade contacts for maintenance | `id`, `org_id`, `name`, `trade`, `phone`, `whatsapp`, `email` |
| `property_docs` | Property-level docs (gas certs, EICR, EPC, HMO licence) | `id`, `org_id`, `property_id`, `name`, `type`, `expires_at`, `storage_path` |
| `tenant_docs` | Tenant docs (passport, RTR, references) | `id`, `org_id`, `tenant_id`, `name`, `type`, `storage_path` |

### Supporting tables

| Table | Purpose |
|---|---|
| `superadmin_allowlist` | Email/user-id allowlist for the superadmin panel |
| `saas_config` | Superadmin-managed JSON config (plan_config, etc.) |
| `email_log` | Audit trail of transactional emails sent |
| `blog_posts` | DB-backed blog (draft + published) |
| `rooms` | Standalone rooms data (legacy — most usage is via `properties.room_list`) |
| `void_dates` | Per-room vacancy start dates (for void cost tracking) |
| `daily_insights` | AI-generated portfolio insights (cached daily) |
| `rent_schedule` | Pre-computed rent schedule rows |

### Critical functions

| Function | Returns | Used by |
|---|---|---|
| `is_superadmin_user()` | bool | RLS policies on superadmin-only tables; server admin endpoints |
| `_current_user_org_ids()` | setof uuid | RLS policies (security definer to avoid recursion on `org_members`) |
| `_plan_caps(plan)` | (max_properties, max_tenants, max_users) | `enforce_plan_limits` trigger; client `_dmPlanCaps` |
| `enforce_plan_limits()` | trigger | Attached to properties / tenants / org_members BEFORE INSERT/UPDATE. Bypassed when `billing_override='free'` or `free_until >= today` |
| `get_organisation_public_brand(org_id)` | (org_name, tagline, whatsapp, whatsapp_skipped, logo_url) | Public `/rooms.html` page |
| `refresh_demo_org()` | void | Daily pg_cron job that resets the demo org |

---

## 6. Feature pages (in the dashboard)

### 6a. Dashboard
- **5-tile KPI strip** at top: Total Rent, Collected, Outstanding, Vacancy %, STR Income (5th tile only when at least one SA-enabled property exists).
- **Today's actions** card — overdue rent, upcoming rent due, urgent maintenance.
- **Stale-period nudge** — flags SA properties without an income entry for the current month.
- **AI Portfolio Agent** — natural-language questions about your portfolio.
- **12-month expense trend** bars.

### 6b. Properties
- Card grid view (default) and list view.
- Filter chips: All / 🏠 Owned / 🤝 Managed / Profitable / Loss-Making / Has Vacancies / 🛏️ Airbnb / Archived.
- Each card shows: name, address, occupancy %, income / mo, landlord cost / mo, profit / mo, badges (Managed/Owned + Active/Archived + 🛏️ Airbnb).
- Click a card → property detail modal with tabs: **Details · Rooms · Tenants · Finance · Docs**.
- **Add Property** modal — wide format matching tenant detail. Includes: classification, ownership, letting type, address, area, type, rooms / bedrooms, landlord rent, landlord, mortgage, purchase info, optional **🛏️ Generates Airbnb / Rent-to-SA income** checkbox.
- **Deal Analyzer** button (top right) opens the analyser tool.
- **Public Rooms page** — `/rooms.html?org=<org-id>` is a public-facing vacancy listing with org branding (tagline, WhatsApp, logo).

### 6c. Property Detail Modal
- **Details tab**: name, type, classification (Owned/Managed + HMO/Whole + 🛏️ Airbnb), address, area, rooms/bedrooms, mortgage details (Owned only), purchase info (Owned only), landlord (Managed only), maps URL, notes, operating company.
- **Rooms tab**: list of rooms with rent, status, occupant. Set per-room rent and status.
- **Tenants tab**: tenants assigned to this property. Add tenant directly.
- **Finance tab**:
  - This-month income/costs breakdown.
  - **Pink STR block** (when SA enabled) — this-month + all-time SA totals + recent entries + "Log STR income" button.
  - Landlord payment schedule rows.
  - Recent payments / arrears.
- **Docs tab**: Gas cert, EICR, EPC, HMO licence with expiry tracking. Upload via Supabase Storage `property-docs` bucket.

### 6d. Tenants
- Card grid filtered by All / Active / Inactive / Arrears.
- Each card: photo / initial, name, room, property, rent / freq, payment status pill.
- Click → tenant detail modal with tabs: **Details · Rent · Documents · Notes**.
- **Add Tenant** modal — same wide format as Add Property.
- **Tenancy agreement generator** — AST + Excluded Licence templates.
- **Tenant onboarding link** — generates a public link the tenant fills in to provide ID, RTR, payment details.
- **Tenant portal** — published at `/tenant-portal.html` for tenants to log in, see rent due, upload docs, log issues.

### 6e. Rent
- KPI strip: Collected / Due Today / Overdue / Cash count / Bank count.
- Filter pills: All / 🏠 Tenant rent / 🛏️ Airbnb (last two only shown when any SA property exists).
- Tabs: Collected · Due Today · Tomorrow · Overdue · Cash · Scheduled.
- Each row → mark paid (bank or cash), edit, send reminder via WhatsApp.
- **Total Rent Arrears** banner removed (was producing misleading numbers); arrears now visible via the Tenants → Arrears filter.

### 6f. Maintenance
- KPI strip: Open / In Progress / Resolved / Total Spent / Avg Days to Resolve.
- Tabs: Requests (default) · Kanban · Contractors.
- **Recurring Maintenance** modal — 4 built-in templates (Annual Gas Safety, EICR 5-yearly, Fire alarm test, Quarterly deep clean). Templates ship **disabled by default** (opt-in per template). When enabled, jobs auto-create across all active properties as their next due date approaches.
- Per-job actions: Start / Resolve / Edit / WhatsApp contractor / Send to contractor (creates a public job page they can update without an account).
- **Auto-seed dedupe** uses `issue` text (since the `recurringTpl` tag wasn't being persisted to DB).

### 6g. Expenses
- Tabs: Overview · All Expenses · Budgets · Receipts.
- Categories: Property (utilities, repairs, council tax) / Staff (cleaners, sourcers) / Overhead (software, legal) / Actual (one-off jobs).
- Recurring vs one-off toggle.
- Receipt upload to Supabase Storage.
- Budget per category — visualized as bars on Overview.
- **12-month spend trend** chart at bottom.
- **Upcoming Bills** list (recurring + scheduled) for next 30 days.

### 6h. Reports
- Tabs: P&L · Cash Flow · Forecast.
- **Period filter pills**: This Month · Last Month · This Quarter · YTD · Last Year · All Time · Custom.
- **Property type filter pills**: All / 🏠 Owned / 🤝 Managed / 🏘️ HMO / 🛏️ Airbnb / SA.
- KPI strip: Period Income / LL Costs / Expenses / Net Profit.
- Per-property P&L table with sortable columns.
- **Revenue Breakdown card** (P&L only, when STR > 0): Tenant rent / Airbnb / Total.
- **PDF export** — landlord-branded; 7-column with Airbnb column when SA exists, 5-column otherwise.
- **PDF + AI** — appends an AI portfolio analysis page.
- **CSV export** — all data flat.
- **Accounting Export** — Xero / QuickBooks / Sage / FreeAgent compatible CSV.

### 6i. Landlords
- List of landlord owners (only relevant when org has Managed properties).
- Per-landlord modal: contact, bank details, properties they own, monthly rent owed, year-to-date payment status.
- **Landlord statement PDF** — branded monthly statement with rent received, deductions, maintenance costs, your fee, net payout.

### 6j. Diary
- Calendar view: month / week / day.
- Events: maintenance scheduled, rent due dates, property inspections, tenant move-ins/outs.

### 6k. Rooms (public-facing)
- `/rooms.html?org=<org-id>` is a public-facing vacancies page.
- Lists rooms across the portfolio that are vacant or coming available.
- Pulls org branding (logo, tagline, WhatsApp) from `get_organisation_public_brand(org_id)` SECURITY DEFINER function.

### 6l. Settings
- Sub-tabs: General · Email · Companies · Billing.
- **General**: org name, currency, language, date format, branding (logo upload), public listings tagline.
- **Email**: SMTP settings (default uses Resend), reminder templates, lifecycle email config.
- **Companies**: manage operating Ltd companies (multi-company filter source).
- **Billing**: subscription summary, plan upgrade button, manage Stripe portal, invoice history.

### 6m. Users
- Manage staff with role-based access: Admin · Manager · Maintenance · Viewer.
- Each role has different page visibility (e.g. Maintenance only sees Maintenance + Diary).

### 6n. Deal Analyzer
- **Strategy toggles:**
  - **Top:** Rent-to-Rent (R2R) / Owned (BTL).
  - **Below:** 🏘️ HMO / 🏡 Whole / 🛏️ SA / Airbnb.
- **HMO inputs:** rooms, rent / room (wk or mo), occupancy, plus running costs. **Per-room rent overrides** in expandable `<details>` block: leave blank to use flat rent; fill any to override that specific room's rent.
- **Whole inputs:** single tenant rent.
- **SA inputs:** nightly rate, occupancy %, monthly cleaning fee, platform fee % (Airbnb/Booking commission).
- **Owned-only inputs:** purchase price, deposit %, renovation, mortgage rate, mortgage term.
- **Outputs:** monthly net, annual net, profit margin, void buffer (Whole) or break-even rooms (HMO), gross yield / net yield / cash ROI / payback (Owned). Plus 12-month projection chart and 5-year outlook with 3% growth + 2% cost inflation.
- **Save scenarios** — name and persist; load later, side-by-side comparison.
- **AI Deal Analysis** — Claude-powered verdict with strengths, risks, suggestions. Opt-in (button click).

### 6o. Superadmin panel (`/superadmin.html`)
**Access:** users in `superadmin_allowlist` (by email or user_id). Default seeds: `g.depaula85@gmail.com`, `gleydson@reservationsdirect.co.uk`, `admin@landlordapp.io`.

**Pages:**
- **Dashboard** — total orgs, MRR, active count, churn, growth.
- **Companies / Trials / Cancelled** — org list with quick-status / quick-plan / quick-edit. Per-org modal: status, plan, FREE GRANT / billing override, free_until date, members, password reset, usage stats.
- **Activity / Audit Log** — every superadmin action.
- **Plans & Pricing** — edit plan tiers (price, max properties, max users, features, ∞ unlimited). **+ Add Plan** card to create custom tiers.
- **All Users** — every auth user across all orgs.
- **Blog** — DB-backed blog editor (Title, slug, category, author, read time, excerpt, cover image upload, body HTML, tags, draft/publish, image insertion at cursor).
- **Superadmin Access** — manage who else can access the panel.

---

## 7. Service Accommodation (SA / STR / Airbnb) module — detail

### Why it exists
LandlordApp is for hybrid operators. Many landlords run HMO + Airbnb on the same property, or compare an SA conversion vs keeping it as HMO. SA is a first-class strategy, not an afterthought.

### Data model
- `properties.is_str_enabled` — boolean flag per property.
- `payments.income_source` — enum: `'rent'` (default) | `'airbnb'`.
- `payments.period_start`, `payments.period_end` — optional date range an SA payment covers.

### UI surfaces
- **Property card badge:** 🛏️ Airbnb pill (when `is_str_enabled`).
- **Properties filter chip:** "🛏️ Airbnb" pill (only renders when ≥1 STR property).
- **Property Detail → Details tab:** "🛏️ Generates Airbnb / Rent-to-SA income" checkbox (pink-bordered).
- **Property Detail → Finance tab:** dedicated pink STR block with this-month + all-time totals, recent entries, "📅 No STR income for {month}" nudge, "+ Log STR income" button.
- **Log STR Income modal:** amount, optional period dates, paid date, method, notes.
- **Dashboard:** 5-tile KPI strip with 🛏️ STR income tile (only when STR property exists). Stale-period nudge listing properties missing this month's entry.
- **Rent page:** "All sources / 🏠 Tenant rent / 🛏️ Airbnb" filter pill row (only when STR property exists).
- **P&L report:** Revenue Breakdown card (Tenant rent / Airbnb / Total) when STR > 0.
- **PDF P&L:** 7-column table with red-highlighted Airbnb column when STR exists; falls back to 5-column otherwise.
- **Arrears report:** explicitly tenant-scoped (SA has no arrears concept).

### Phase 2 ideas (deferred — see [docs/str-phase-2-ideas.md](str-phase-2-ideas.md))
30-day decision rule based on customer demand:
- iCal sync from Airbnb / Booking.com
- Gross/net split with platform fees
- Occupancy & nightly-rate reports
- CSV import
- Per-platform tagging

---

## 8. Plan-limit enforcement (defense in depth)

**Three layers** all enforce the same caps, all bypassed by `billing_override='free'` or `free_until >= today`:

1. **DB trigger `enforce_plan_limits()`** — fires `BEFORE INSERT/UPDATE` on `properties`, `tenants`, `org_members`. Counts current rows scoped to org, raises exception if next insert would exceed cap. Returns errcode `P0001` with message `"Plan limit reached: max <N> properties for plan <plan>."`.
2. **Client-side gate `_dmPlanCaps()`** in [src/dashboard/sections/35-export-import.js](../src/dashboard/sections/35-export-import.js) — runs before "Add Property" modal opens. Same logic as trigger.
3. **CSV import gate `_dmValidatePlanLimitBeforeImport()`** — runs before bulk import.

**Caps table** (in `_plan_caps()` SQL function, also mirrored in client):

| Plan | Properties | Tenants | Users |
|---|---|---|---|
| free | 3 | 15 | 2 |
| trial | 5 | 30 | 3 |
| starter | 15 | 75 | 3 |
| professional | 25 | UNLIMITED | 5 |
| business | 60 | UNLIMITED | 15 |
| enterprise | UNLIMITED | UNLIMITED | UNLIMITED |
| (unknown) | UNLIMITED | UNLIMITED | UNLIMITED |

Custom plan keys added via the superadmin **+ Add Plan** card default to UNLIMITED on the trigger so they never hard-cap.

---

## 9. Stripe checkout flow

1. User clicks "Upgrade" on Settings → Billing OR on the landing page pricing card.
2. Client calls `startStripeCheckout(plan)` which:
   - Validates plan is in allowlist `[starter, professional, business, enterprise, free]`.
   - Hits `POST /api/stripe/create-checkout-session` with `{ orgId, plan }` + Bearer token.
3. Server validates JWT, looks up org member row, looks up `STRIPE_PRICE_<PLAN>` env var, creates Stripe Checkout Session, returns URL.
4. Client redirects to Stripe.
5. On success, Stripe redirects to `?stripe=success&session_id=...`.
6. Webhook `POST /api/stripe/webhook` updates `organisations.stripe_subscription_id` + `plan` + `status`.

**Env vars required:**
- `STRIPE_SECRET_KEY` (sk_live_... in prod)
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PROFESSIONAL`
- `STRIPE_PRICE_BUSINESS`
- `STRIPE_PRICE_ENTERPRISE` (hardcoded fallback `price_1TPooTJ78dmPbvOx3o1uyxDw` in `server.js` if env missing)
- `APP_BASE_URL=https://landlordapp.io`

**Bypassing checkout (testing / partner orgs):** set `billing_override='free'` or `stripe_subscription_id='manual'` on the org row. The `hasBillingExemptionOrSubscription()` function in [04-auth-org-provisioning.js](../src/dashboard/sections/04-auth-org-provisioning.js) honors all three signals: `billing_override`, `free_until`, `stripe_subscription_id` (looking for `'manual'` or `'sub_*'` prefix).

---

## 10. Demo account

**Credentials:**
- Email: `demo@landlordapp.io`
- Password: `DemoAccount2026!`

**Setup (one-time):**
1. Create the auth user in Supabase Dashboard with auto-confirm.
2. Run [db/demo_seed.sql](../db/demo_seed.sql) — wipes + re-seeds the demo org with realistic data.
3. Run [db/FIX_demo_org_membership.sql](../db/FIX_demo_org_membership.sql) — links the auth user to the demo org as admin.
4. Run [db/demo_seed_schedule.sql](../db/demo_seed_schedule.sql) — installs `pg_cron` job that calls `public.refresh_demo_org()` daily at 03:00 UTC.

**Demo org content:**
- 1 organisation (id: `00000000-0000-0000-0000-00000000d3d0`, plan: business, FREE GRANT)
- 1 limited company ("Demo Properties Ltd")
- 3 landlords
- 5 properties (4 HMO + 1 owned whole-let, across London + Manchester; one SA-enabled)
- 12 tenants distributed across HMOs + the whole-let
- 5 maintenance jobs (mix of open / in-progress / resolved)
- ~24 payments (last month paid, current month scheduled, one tenant overdue for realistic arrears)
- 5 recurring expenses
- 1 SA / Airbnb payout entry on the STR-enabled property

**Login button** on `/login.html`: "🚀 Try the demo — no signup". Calls `handleDemoLogin()` which signs in with the credentials above.

**Daily auto-reset** at 03:00 UTC ensures every visitor gets a clean sandbox.

---

## 11. AI Portfolio Agent

- **Endpoint:** `POST /api/ai/messages` (proxies to Claude API).
- **Auth:** required Bearer token; rate-limited 80/min by `aiLimiter`.
- **Use cases:**
  - Plain-English questions over portfolio data: "Which property has the highest void days year-to-date?"
  - Deal Analyzer verdicts (strengths / risks / suggestions on a deal).
  - Daily portfolio insights (cached in `daily_insights` table).
- **Env:** `ANTHROPIC_API_KEY` (sk-ant-...) + `ANTHROPIC_API_URL` (default https://api.anthropic.com/v1/messages).

---

## 12. Roles & permissions

| Role | Pages they see |
|---|---|
| **admin** | Everything |
| **manager** | Dashboard, Properties, Tenants, Rent, Maintenance, Landlords, Rooms, Diary, Expenses, Reports |
| **maintenance** | Maintenance, Diary |
| **viewer** | Dashboard, Properties, Tenants, Reports (read-only) |

Stored in `org_members.role`. Page visibility enforced client-side via `state.roles`. RLS at DB level still scopes by org.

---

## 13. Common workflows

### Create a property → tenant → first rent payment
1. Properties → **+ Add Property** → fill in address, type, classification, rooms, landlord rent.
2. New property card appears. Click → Rooms tab → set per-room rents.
3. Tenants → **+ Add Tenant** → choose property, room, name, rent, frequency, start date.
4. Tenant card appears with "Due [date]" pill.
5. Rent page → click the row → Mark paid (bank or cash).

### Log SA / Airbnb income
1. Properties → click property → Details tab → tick "🛏️ Generates Airbnb / Rent-to-SA income" → Save.
2. Reload → property now shows pink STR block on Finance tab.
3. Click "+ Log STR income" → enter amount, period dates (optional), paid date, method, notes.
4. Dashboard's 5th KPI tile updates immediately.

### Generate landlord statement
1. Landlords → click landlord card → "📄 Statement PDF" button.
2. Choose month / quarter.
3. Branded PDF generates: rent received, maintenance deductions, your fee (configurable in Settings → General), net payout. Email or download.

### Run a deal analysis
1. Properties → **Deal Analyzer** button.
2. Pick R2R or Owned + HMO/Whole/SA.
3. Fill in inputs (rent / room or nightly rate, costs, occupancy, etc.).
4. Live KPIs update on every keystroke.
5. (HMO) Optionally expand "Set individual room rents" for non-uniform pricing.
6. Click "Analyze Deal" for AI verdict.
7. "Save Scenario" to persist; load later for side-by-side comparison.

### Bulk import via CSV
1. Settings → Import → choose entity (properties / tenants).
2. Download template, fill in.
3. Upload — preview shows what will be imported, plan-limit gate validates.
4. Confirm.

---

## 14. Known issues & troubleshooting

### "Property limit reached" but billing_override is set
- Check `organisations.billing_override` is exactly the string `'free'` (lowercase, no whitespace).
- Verify the user's session is loading that org — `state._currentOrg.billing_override` should be `'free'` in DevTools console.
- If the column doesn't exist on the env, run [db/add_billing_override_columns.sql](../db/add_billing_override_columns.sql).

### "Could not create your organisation"
- Check RLS policies on `organisations` and `org_members` allow INSERT for authenticated users — fix is [db/FIX_org_creation_on_signup.sql](../db/FIX_org_creation_on_signup.sql).

### "Infinite recursion detected in policy for relation org_members"
- The `org_members` policy can't subquery `org_members`. Fix: [db/FIX_org_members_infinite_recursion.sql](../db/FIX_org_members_infinite_recursion.sql) splits into self-row policy + SECURITY DEFINER helper.

### "Could not delete: violates foreign key constraint"
- FKs need ON DELETE CASCADE. Fix: [db/FIX_org_delete_cascade.sql](../db/FIX_org_delete_cascade.sql) loops every FK pointing at `organisations(id)` and rewrites with cascade.

### Maintenance jobs auto-spawning every render
- Templates default to `disabled:true` since v40. Existing orgs with the old enabled defaults need: delete the auto-created rows + reset `app_config.config.recurringMaint` to `[]`.

### Demo login: "Demo account unavailable"
- Auth user not created → create in Supabase Auth panel.
- Email not confirmed → `update auth.users set email_confirmed_at = now() where email = 'demo@landlordapp.io';`.
- org_members link missing → run [db/FIX_demo_org_membership.sql](../db/FIX_demo_org_membership.sql).

### Bundle showing old version after deploy
- Server's `cacheBustHtml` middleware auto-stamps fresh `?v=<BUILD_TS>` on every request — so a cached bundle should always be replaced. If still stale: hard-refresh (Ctrl+Shift+R) and check Network tab — `dashboard.bundle.js?v=...` should differ between requests.

### Stripe checkout: "Unsupported plan selected"
- Client allowlist in `startStripeCheckout` was missing the plan name. Currently allows: `starter`, `professional`, `business`, `enterprise`, `free`.

---

## 15. SEO & content

**Public pages:**
- `/` and `/propmanager-landing.html` — marketing landing.
- `/operators/hmo-landlords.html` — HMO operator SEO page.
- `/operators/r2r-operators.html` — R2R operator SEO page.
- `/operators/letting-agents.html` — letting agent SEO page.
- `/operators/portfolio-managers.html` — portfolio manager SEO page.
- `/operators/service-accommodation.html` — SA operator SEO page.
- `/blog/` — listing of published posts (server-rendered from `blog_posts` table).
- `/blog/<slug>` — individual posts.
- `/rooms.html?org=<id>` — public-facing vacancy listing per org.

Each page has unique `<title>`, meta description, canonical link, Open Graph tags, structured `article:published_time` (where relevant).

---

## 16. Brand & voice guidelines

**Brand colors:**
- Primary green: `#00B894` (var `--green`)
- Dark green: `#007A62`
- SA / Airbnb red: `#FF5A5F`
- Cream warmth: `#FAFAF8`, `#F4F3EF`
- Navy: `#0F172A`

**Typography:**
- Body: Plus Jakarta Sans
- Display: Instrument Serif (used for hero h1s with italic accent on key phrase)

**Voice:**
- Direct, operator-to-operator, never enterprise-speak.
- Specific numbers, real scenarios.
- Avoid AI-slop openers ("In today's fast-paced world", "Have you ever wondered if…").
- Founder's notes are in first person, written from lived experience.
- Show, don't tell — link to features rather than describing them abstractly.

---

## 17. Future / roadmap

**Confirmed:**
- AI scoring engine in Deal Analyzer to natively support SA mode (currently HMO/Whole-only).
- Image library on the blog (Supabase Storage `blog-images` already configured).
- Lifecycle email cron (welcome, trial-ending, churn-recovery) — endpoint exists at `/api/email/run-lifecycle-jobs`.

**Conditional on demand:**
- iCal sync for SA properties (Airbnb / Booking.com / SpareRoom calendars).
- Native mobile app (currently mobile-responsive web only).
- White-label / agency-branded portals.
- API access for paid tiers.

---

## 18. Quick-reference cheat sheet for agents

When asked "How do I…":
- **add a property** → Properties → **+ Add Property**
- **log Airbnb income** → Property → Details tab → tick STR → Finance tab → "+ Log STR income"
- **export rent for accounting** → Reports → Accounting Export
- **see my margin per property** → Reports → P&L (toggle period at top)
- **change plan** → Settings → Billing → Upgrade
- **add a staff member** → Users → Invite (admin only)
- **set per-room rent** → Property → Rooms tab
- **schedule maintenance** → Maintenance → **+ Log Request** (set scheduled date)
- **run a deal** → Properties → Deal Analyzer
- **send rent reminder** → Rent → click row → 📲 Reminder
- **upload a doc** → Property/Tenant → Docs tab → drag-drop or browse

When asked "What's the difference between…":
- **HMO vs Whole property** → HMO has multiple let rooms (one tenant per room). Whole = single household.
- **Owned vs Managed** → Owned = you hold title (mortgage, equity). Managed = you operate for someone else's property.
- **R2R vs Managed** → R2R = you sublet (you're the master tenant). Managed = you charge a fee, landlord owns the rent.
- **SA vs HMO** → SA = nightly stays (Airbnb). HMO = AST tenancy. Same property can be either or hybrid.
- **billing_override='free' vs free_until** → First is indefinite, second auto-expires.

When asked "Why is X behaving Y" → check Section 14 (Known issues).

---

*Last updated: 2026-04-25. Bundle version: v41 (deal analyzer SA + per-room HMO). DB migration baseline: PRODUCTION_MIGRATION_ALL.sql + all FIX_*.sql + blog_cms.sql + organisations_add_free_until.sql.*
