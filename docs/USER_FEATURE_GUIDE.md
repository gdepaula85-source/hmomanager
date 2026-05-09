# LandlordApp.io — Complete User Feature Guide

**Every function, feature, and capability available to a user inside the app.**

This document is exhaustive — the answer to "what can I do with LandlordApp?" Use it as a capability inventory, training reference, or sales/onboarding script.

Organised by page. Each page lists what you see, every action you can take, and every output the app can generate.

---

## Table of Contents

1. [Onboarding](#1-onboarding)
2. [Dashboard](#2-dashboard)
3. [Properties](#3-properties)
4. [Property Detail Modal](#4-property-detail-modal)
5. [Tenants](#5-tenants)
6. [Tenant Detail Modal](#6-tenant-detail-modal)
7. [Rent Collection](#7-rent-collection)
8. [Maintenance](#8-maintenance)
9. [Expenses](#9-expenses)
10. [Landlords](#10-landlords)
11. [Rooms](#11-rooms)
12. [Diary](#12-diary)
13. [Reports](#13-reports)
14. [Deal Analyzer](#14-deal-analyzer)
15. [AI Portfolio Agent](#15-ai-portfolio-agent)
16. [Settings](#16-settings)
17. [Users & Permissions](#17-users--permissions)
18. [Service Accommodation Module](#18-service-accommodation-module)
19. [Document Vault](#19-document-vault)
20. [Tenant Onboarding & Tenant Portal](#20-tenant-onboarding--tenant-portal)
21. [Public-Facing Rooms Page](#21-public-facing-rooms-page)
22. [Imports & Exports](#22-imports--exports)
23. [Compliance & Certificates](#23-compliance--certificates)
24. [Communication (WhatsApp, Email)](#24-communication-whatsapp-email)
25. [Subscription & Billing](#25-subscription--billing)
26. [Superadmin Panel](#26-superadmin-panel)
27. [Demo Account](#27-demo-account)
28. [Mobile Use](#28-mobile-use)
29. [Quick Reference: All actions A-Z](#29-quick-reference-all-actions-a-z)

---

## 1. Onboarding

When you first sign up, a 4-step walkthrough collects:

- **Step 1:** Your name, organisation name, currency, language.
- **Step 2:** Your first property — name, address, postcode, ownership (Owned / Managed), letting type (HMO / Whole), rooms or bedrooms, landlord rent (if managed).
- **Step 3:** Your first tenant — name, room, rent, frequency, start date, payment method, deposit.
- **Step 4:** Choose plan (Free, Starter, Professional, Business, Enterprise) — or skip and start free.

You can **skip any step** and add later. Onboarding only fires for brand-new orgs with zero properties.

---

## 2. Dashboard

The first screen after login.

### What you see

- **Top bar:** organisation name, calendar (current month), global search, your avatar + sign out.
- **5 KPI tiles** (5th appears only when you have an Airbnb / SA-enabled property):
  1. **Total Rent** — full month's expected rent (all active tenancies).
  2. **Collected** — what's been paid this month.
  3. **Outstanding** — what's owed.
  4. **Vacancy** — rooms vacant / total rooms × 100.
  5. **🛏️ STR Income** — Airbnb / SA income logged this month.
- **Today's actions** — overdue rent, urgent maintenance, tenant move-ins/outs in the next 7 days.
- **Stale-period nudge** — yellow banner listing SA properties without a logged income for the current month, with a one-click "Log STR income" button.
- **AI Portfolio Agent** — natural-language search box. Ask anything about your portfolio.
- **12-month expense trend** — bar chart per category at the bottom.

### Actions you can take

- Click any KPI tile → drills into the relevant page filtered (e.g. "Outstanding" → Rent → Overdue tab).
- Click an alert → jumps to the relevant tenant / property / job.
- Type in the search box → finds tenants / properties / payments / contractors / docs across all data.
- Ask the AI agent → "Which property had the lowest collection rate last month?" / "Show me my YTD profit" / "Which rooms are vacant longest?" — answers in plain English with figures.

---

## 3. Properties

The portfolio view.

### What you see

- **Page header** — total properties, total active rooms, occupancy %.
- **KPI strip** — Monthly Income / Landlord Costs / Net Profit Per Month.
- **Filter chips** (top): All · 🏠 Owned · 🤝 Managed · Profitable · Loss-Making · Has Vacancies · 🛏️ Airbnb · Archived.
- **Sort menu** — by name, rent, profit, occupancy, void days.
- **Search box** — fuzzy match against property name, address, postcode, area.
- **Operating Company filter** — when you have multiple Ltd companies set up, filter the whole page by one.

### Property cards (default grid view)

Each card shows:

- Name + address + postcode.
- Badges: Managed/Owned + Active/Archived + 🛏️ Airbnb (if SA enabled).
- Occupancy bar (occupied rooms / total rooms · %).
- Income / mo · Landlord cost / mo · Profit / mo.
- "View on Maps" link · "Tap to edit" hint.

### Actions you can take

- **+ Add Property** (top right) — full modal with classification, address, type, rooms/bedrooms, landlord rent, mortgage, purchase info, SA toggle.
- **Deal Analyzer** button — opens the deal-modelling tool.
- **Click any card** → opens the Property Detail modal (tabs: Details / Rooms / Tenants / Finance / Docs).
- **Bulk import** via CSV (Settings → Import) — pre-validated against your plan's property cap.
- **Archive a property** → moves it to the Archived filter without deleting payment history.
- **Restore an archived property** → returns it to the active list.
- **Delete archived property permanently** → only available from Archived view.

---

## 4. Property Detail Modal

Five tabs.

### 4a. Details tab

Edit:
- Property name, type (HMO / Single Let / Semi-Commercial / Other).
- **Classification** — Owned / Managed (radio) + HMO / Whole (radio).
- **🛏️ Generates Airbnb / Rent-to-SA income** checkbox (pink-bordered).
- Full address, postcode, area (autocomplete from your existing areas).
- Rooms (HMO) or bedrooms (Whole).
- Landlord rent (Managed) or mortgage details (Owned).
- Maps URL (auto-generated from address; editable).
- Notes (free text).
- Operating company (multi-company filter source).

**Owned-only sub-section:**
- Mortgage: lender, monthly payment, rate, rate type (fixed/variable), fix end date, outstanding balance.
- Purchase info: purchase price, purchase date, estimated current value, ownership structure (sole/joint/SPV).

**Managed-only sub-section:**
- Landlord (dropdown of your landlords + "Add new" option).
- Landlord phone.

Save Changes / Archive / Cancel.

### 4b. Rooms tab

For HMO properties:
- One row per room with: room number, type (Single/Double/Studio/En-Suite), price (per week or per month), status (vacant / occupied / coming available), current tenant (if any).
- Update price inline.
- Update status inline (vacant ↔ occupied).
- Add room photos (uploaded to Supabase Storage `room-photos`).
- Set room notes per room.

For Whole properties: single row showing the property's monthly rent.

### 4c. Tenants tab

- List of tenants assigned to this property (active + inactive).
- Each row: name, room, rent, frequency, status, start date.
- **+ Add Tenant** button.
- Click any tenant → opens Tenant Detail modal.

### 4d. Finance tab

- **This month** card: income / costs / net for this property.
- **All time** card: total income, total costs, total net since first payment.
- **Pink STR block** (only when SA enabled) — this-month + all-time SA totals + recent SA entries + "+ Log STR income" button.
- **Recent payments** — last 10 rent payments, status pills (paid / overdue / scheduled).
- **Recent expenses** — last 10 expenses tagged to this property.
- **Landlord payment history** (Managed) — month-by-month with paid/pending/overdue status.

### 4e. Docs tab

- Compliance certificates: Gas Safety Certificate, EICR, EPC, HMO Licence — each with name, expiry date, "View / Download / Replace" actions.
- Non-cert docs (insurance, mortgage statement, fire risk assessment, etc.) — uploaded as additional files.
- All docs stored in Supabase Storage `property-docs` bucket with signed URLs (auto-refreshed).
- Drag-and-drop upload OR file picker.

---

## 5. Tenants

The tenant directory.

### What you see

- **Page header** — total tenants, active count, in arrears count.
- **Filter chips:** All · Active · Inactive · Arrears · By Property.
- **Search** — name, phone, email, room, property.
- **Sort** — by name, rent (high/low), start date, arrears.

### Tenant cards

Each card shows:

- Initial / avatar circle.
- Name, room, property name.
- Rent amount + frequency (weekly / 4-weekly / monthly).
- Status pill (Active / Inactive / In Arrears).
- Next payment due date.

### Actions you can take

- **+ Add Tenant** (top right) — full modal.
- **Click a card** → Tenant Detail modal.
- **Bulk import** via CSV (Settings → Import).
- **Archive (set inactive)** → removes from active count without deleting history.
- **Restore inactive tenant** → reactivates.
- **Delete inactive tenant permanently** → only available from Inactive view.
- **Generate tenant onboarding link** → public link the tenant fills in.

---

## 6. Tenant Detail Modal

Four tabs.

### 6a. Details tab

- Name, photo / avatar.
- Property + room (dropdown of vacant rooms in your portfolio).
- Rent amount + frequency.
- Pay day (weekly: day of week / monthly: day of month).
- Method (bank / cash).
- Start date, move-in date.
- Notice given date, move-out date (when applicable).
- Deposit amount + status (held / TDS protected / returned / partial deduction).
- Personal info: phone, WhatsApp, email, date of birth, nationality.
- Notes (free text).
- Previous tenancies array (when migrated from another tracking system).

### 6b. Rent tab

- All payments for this tenant (paid + scheduled + overdue).
- Mark paid (bank or cash) inline.
- Edit any payment (amount, date, method, notes).
- Mark partial — records partial payment + shortfall.
- Revert payment (undo a mistaken "paid" mark).
- Late fee tracking (auto-applied based on Settings → Late Fees config).
- Total arrears for this tenant.
- Send rent reminder via WhatsApp (one-click).

### 6c. Documents tab (Tenant Vault)

- ID document (passport / driver's licence).
- Right-to-Rent check.
- References (employer / previous landlord).
- Signed tenancy agreement.
- Deposit protection certificate.
- Any other docs (custom upload).
- Tenant can self-upload via the Tenant Onboarding link.
- Stored in Supabase Storage `tenant-docs` bucket with signed URLs.

### 6d. Notes tab

- Free-text running log of interactions, issues, observations.
- Each note timestamped + attributed to staff member.
- Searchable.

### Other actions

- **Generate AST agreement** — autofills with tenant + property data, downloadable PDF.
- **Generate Excluded Licence** — for R2R / lodger arrangements.
- **Send onboarding link** — tenant gets a public URL to fill in their details + upload docs themselves.
- **Set up tenant portal access** — gives tenant login credentials to `/tenant-portal.html`.

---

## 7. Rent Collection

The rent ledger.

### What you see

- **KPI strip:** Collected · Due Today · Tomorrow · Overdue · Cash count · Bank count.
- **Period filter:** This Week · Last Week · This Month · Last Month · YTD.
- **Income source filter** (only if you have SA properties): All sources · 🏠 Tenant rent · 🛏️ Airbnb / STR.
- **Sub-tabs:** Due Today · Tomorrow · 💵 Cash · Overdue · Collected · Scheduled.
- **Total summary** — Bank total / Cash total / Combined / Collection rate %.

### Each row shows

- Tenant avatar + name + room + property.
- Rent amount.
- Due date / paid date.
- Status pill.
- Method icon (🏦 bank / 💵 cash).
- Action buttons.

### Actions you can take

- **Mark paid** — single click; choose bank or cash.
- **Mark partial** — records what was actually received + shortfall.
- **Edit payment** — change amount, date, method, notes.
- **Revert** — undo a "paid" mark.
- **📲 Send reminder** — WhatsApp message with personalised payment link / details.
- **Late fee toggle** — auto-applies a configurable late fee after a grace period (Settings → Late Fees).
- **Bulk share** (Cash tab) — generate a single shareable summary of all cash collected for a period (e.g. for accountant handover).
- **Export to CSV** — current view.

---

## 8. Maintenance

Track every repair and inspection job.

### What you see

- **KPI strip:** Open · In Progress · Resolved · Total Spent · Avg Days to Resolve.
- **Tabs:** Requests (default list) · Kanban (drag-drop columns: Open / In Progress / Resolved) · Contractors.
- **Filter:** by property, by contractor, by status, by priority, by category.
- **Search** — issue text, property, contractor.

### Each maintenance card shows

- Property + room.
- Issue description.
- Category (🔧 Plumbing / ⚡ Electrical / 🔥 Heating / 🔨 General / 🪟 Glazing / 🐀 Pest Control / 🧹 Cleaning / etc.).
- Priority pill (Low / Medium / High / Urgent).
- Status pill (Open / In Progress / Resolved).
- Logged date + scheduled date.
- Assigned contractor (if any).
- Job cost (when resolved).
- Notes / photos.

### Actions you can take

- **+ Log Request** — full modal: property, room, issue, category, priority, scheduled date + time, contractor, notes, photos.
- **Start / Resolve / Re-open** buttons on each card.
- **Edit** — full modal.
- **Assign contractor** — dropdown of your contractor directory.
- **Send to contractor** — generates a public job page (no login needed); WhatsApp / email link with address, access details, photos. Contractor updates status from the public page.
- **WhatsApp Share All Open** — one-click share of every open job to a WhatsApp group / contractor.
- **Attach receipt / invoice** — uploaded to Storage; visible on the resolved job + included in P&L exports.
- **Set job cost** when resolving — flows into expenses.
- **Bulk delete** resolved jobs older than X days.

### Recurring Maintenance (auto-create)

- 4 built-in templates (all **default off**):
  - Annual Gas Safety Cert (interval 365 days, lead time 30 days, priority high).
  - EICR 5-yearly (1825 days, lead 60 days, medium).
  - Fire alarm test (90 days, lead 14 days, medium).
  - Quarterly deep clean (90 days, lead 14 days, low).
- Toggle each template **On** in the 🔄 Recurring modal to start auto-spawning jobs.
- Customise interval, lead time, priority per template.
- Add your own custom templates.
- Click "Run now" to manually trigger a check.

### Contractors tab

- Directory of your trade contacts.
- Each: name, trade, phone, WhatsApp, email, jobs count, total spent.
- Click a contractor → all their jobs (open + resolved) + total spend.

---

## 9. Expenses

All recurring + one-off costs.

### What you see

- **Tabs:** Overview · All Expenses · Budgets · Receipts.
- **Period filter** (top): This Month / Last Month / All Time.
- **Type filter:** Property · Staff · Overhead · Job (one-off actuals).
- **Operating Company filter.**
- **Search** — description, vendor, category, property.
- **Min / Max amount filters.**

### Overview tab

- **5-tile KPI strip:** Total / Staff / Property / Job (when present) / Overhead — clickable to filter.
- **Cost Breakdown card** — bars per category vs budget (or share of total when no budget).
- **Confirmation Status card** — Confirmed count vs Estimated count.
- **12-Month Spend Trend** — bar chart with average + this-month-vs-avg %.
- **Upcoming Bills · Next 30 days** — recurring + future-dated, top 8 with total + count.

### All Expenses tab

- Full table with columns: Category, Description, Amount, Frequency (One-off / Monthly), Status (Estimated / Confirmed), Receipt, Actions.

### Actions you can take

- **+ Add Expense** — modal: type, category, description, amount, frequency, recurring toggle, start date, property (optional), receipt upload.
- **Confirm an estimated expense** when the actual figure is known.
- **Attach receipt** — image or PDF, stored in Supabase Storage.
- **View receipt** — click thumbnail.
- **Remove receipt.**
- **Set budget per category** — Budgets tab. When set, Overview shows progress bars.
- **Edit / Remove** any expense.
- **Receipts tab** — all uploaded receipts in one gallery view.

---

## 10. Landlords

The landlord owners directory (only relevant when you have Managed properties).

### What you see

- List of landlords with: name, phone, email, properties count, monthly rent owed, YTD payments status.
- Search + sort.

### Actions you can take

- **+ Add Landlord** — modal with name, phone, email, bank details (account name, sort code, account no.), notes.
- **Click a landlord** → detail modal.
- **Bank details** — store sort code + account number for BACS payments (encrypted in DB).

### Landlord detail modal

- Properties owned (links to property cards).
- Monthly rent total.
- **Payment schedule** — month-by-month grid showing rent due, paid, overdue.
- **Mark paid** per month per property.
- **📄 Statement PDF** — branded monthly statement: rent received, deductions (maintenance, fees), your management fee, net payout. Downloadable / emailable.
- **Notes log.**

---

## 11. Rooms

Portfolio-wide rooms view.

### What you see

- All rooms across all properties in a single list.
- Filter by status (vacant / occupied / coming available).
- Filter by property.
- **Void Period Tracker** — how long each vacant room has been empty + cost of void.

### Actions you can take

- Update room status inline.
- Update room price inline.
- Add room photos (Supabase Storage `room-photos`).
- Mark a room as "coming available" with a future date — appears on the public Rooms page.

---

## 12. Diary

Calendar view of every dated event.

### What you see

- **Views:** Month / Week / Day.
- **Events:**
  - Maintenance jobs (scheduled date + time).
  - Rent due dates.
  - Property inspections.
  - Tenant move-ins / move-outs.
  - Compliance certificate expiries (Gas / EICR / EPC / HMO Licence).

### Actions you can take

- Click a date to add a custom event.
- Click an event → opens the related record (maintenance / tenant / property / cert).
- Drag a maintenance job to a different date to reschedule.

---

## 13. Reports

Financial reports + analysis.

### What you see

- **Tabs (top right):** P&L · Cash Flow · Forecast.
- **Period filter pills:** This Month · Last Month · This Quarter · YTD · Last Year · All Time · Custom (month + year selectors).
- **Property type filter pills:** All / 🏠 Owned / 🤝 Managed / 🏘️ HMO / 🛏️ Airbnb / SA.
- **Operating Company filter.**

### KPI strip

- Period Income · Period LL Costs · Period Expenses · Period Net Profit.

### Per-property table

Sortable columns: Property · Income · Landlord rent · Mortgage · Expenses · Maintenance · Net · Margin %.

### Revenue Breakdown card (P&L tab, when SA > 0)

- Tenant rent / Airbnb / Total — split with percentages.

### Actions you can take

- **PDF export** — landlord-branded report (your logo, org name, period). 7-column when SA exists, 5-column otherwise. Saved per period for compliance.
- **PDF + AI** — same PDF with an extra AI portfolio analysis page appended (strengths, risks, recommendations from Claude).
- **CSV export** — flat data for spreadsheet work.
- **Accounting Export** — Xero / QuickBooks / Sage / FreeAgent compatible CSV with date range, account codes, transaction types.

### Cash Flow tab

- Inflows (rent + SA income) vs Outflows (landlord rent + mortgage + expenses + maintenance) per month.
- 12-month historical chart.
- Net cumulative line.

### Forecast tab

- 12-month forward projection.
- Editable assumptions: rent growth %, expense inflation %, target occupancy %.
- Identifies tight months before they happen.

---

## 14. Deal Analyzer

Model any property deal before signing.

### Strategy toggles

- **Top:** Rent-to-Rent (R2R) / Owned (BTL).
- **Below:** 🏘️ HMO / 🏡 Whole / 🛏️ SA / Airbnb.

### Inputs

**Common to all strategies:**
- Rooms (HMO only).
- Occupancy %.
- Bills, Maintenance, Insurance, Management, Void Allowance, Other costs (£/mo).

**HMO inputs:**
- Rent / Room (with weekly / monthly toggle).
- **Per-room rent overrides** in expandable section — leave blank for flat average; fill any to override that specific room.

**Whole inputs:**
- Tenant Rent (with weekly / monthly toggle).

**SA / Airbnb inputs:**
- Nightly Rate.
- Cleaning / mo (£).
- Platform Fee % (default 15% Airbnb commission).

**R2R-only:**
- Landlord Rent (£/mo).

**Owned-only:**
- Purchase Price.
- Deposit %.
- Renovation budget.
- Mortgage Rate %.
- Mortgage Term (years).

### Outputs (live, recalculate on every keystroke)

- **KPI tiles:**
  - Monthly Net (£) + colour code.
  - Annual Net (£).
  - Profit Margin % (R2R/HMO).
  - Void Buffer (months) (Whole) — surplus covers how many months of void.
  - Break-even rooms (HMO) — how many rooms need to be filled to cover costs.
  - Gross Yield % (Owned).
  - Net Yield % (Owned).
  - Cash ROI % (Owned).
  - Payback (years) (Owned).
- **Monthly P&L card** — Gross income · Mortgage or Landlord rent · Running costs · Net profit / loss.
- **Cost-ratio bar** — visual % of income consumed by costs.
- **12-Month Projection** — bar chart (income vs costs by month).
- **5-Year Outlook** — table with 3% rent growth, 2% cost inflation, year-by-year net.

### Actions you can take

- **Save Scenario** — name and persist the deal.
- **Load Scenario** — recall any saved deal; modify and re-save.
- **Delete Scenario.**
- **Compare scenarios** — saved deals show a quick-pill row at top with name + monthly net.
- **Reset** — clear all inputs.
- **Analyze Deal (AI)** — Claude-powered verdict: strengths, risks, suggestions in plain English.

---

## 15. AI Portfolio Agent

Anthropic Claude API integration for natural-language data queries.

### Where it lives

- Dashboard (search box at top).
- Reports → "PDF + AI" button (appends analysis to the report).
- Deal Analyzer → "Analyze Deal" button.
- Property Detail → "Get AI insight" (varies by tab).

### What it can answer

- "Which property has the highest void days year-to-date?"
- "Show me my top 3 most profitable properties."
- "Which tenants are persistently late?"
- "What's my YTD profit?"
- "How much did I spend on maintenance last quarter?"
- "Compare my Owned and Managed portfolios."
- "Which deal is worse — this R2R or this BTL?" (Deal Analyzer context).

### Behaviour

- Reads your portfolio data scoped to your org (RLS-enforced).
- Returns structured + narrative output.
- Daily insights cached to avoid re-cost.
- Rate-limited to 80 requests/minute.

---

## 16. Settings

Sub-tabs: General · Email · Companies · Billing.

### 16a. General

- Organisation name.
- Currency (default GBP).
- Currency symbol.
- Language (en).
- Date format (DD/MM/YYYY · MM/DD/YYYY · YYYY-MM-DD · etc.).
- Branding: logo upload (used in PDFs + tenant-portal + public Rooms page).
- Public listings tagline (shown on `/rooms.html`).
- Public listings WhatsApp number (CTA button on `/rooms.html`).
- Late fee config: enabled toggle, amount (£), grace period (days).

### 16b. Email

- SMTP / Resend config (default uses your bundled Resend API key).
- Customise email templates: rent reminder, late notice, payment received, maintenance notification, welcome email.
- Lifecycle email config: trial-ending, payment-failed, subscription-cancelled.
- Email log (audit trail of every email sent — Settings → Email → Email log).

### 16c. Companies

- Add multiple Ltd companies (operating entities).
- Each company: name, company number, VAT number, director, address, email, phone, WhatsApp, brand colour.
- Assign properties to a specific company.
- Multi-company filter then works across the whole app.

### 16d. Billing

- Current plan + price.
- Trial days remaining (when in trial).
- Active subscription status (✓ Active / Past due / Cancelled).
- Properties used / cap (with usage bar).
- Tenants used / cap.
- Users used / cap.
- **Upgrade plan** button → Stripe Checkout.
- **Manage plan** button → Stripe Customer Portal (cancel, update card, download invoices).
- 5-tier comparison table at the bottom.
- Plan-Limit-Exceeded warning banner if you ever go over (e.g. after a downgrade).

---

## 17. Users & Permissions

### Roles

| Role | Access |
|---|---|
| **admin** | Everything (manage users, change billing, delete data). |
| **manager** | Daily operations: properties, tenants, rent, maintenance, landlords, rooms, diary, expenses, reports. |
| **maintenance** | Maintenance + Diary only. |
| **viewer** | Read-only across Dashboard, Properties, Tenants, Reports. |

### Actions an admin can take

- **+ Invite User** — email invite; recipient creates a password and joins your org with a chosen role.
- **Change a user's role.**
- **Reset a user's password** (admin override via superadmin panel only).
- **Remove a user from the org.**
- **Plan-cap enforcement** — can't invite past your seat limit.

---

## 18. Service Accommodation Module

For hybrid HMO + SA / Airbnb operators.

### Enable on a property

- Property → Details tab → tick **🛏️ Generates Airbnb / Rent-to-SA income** → Save.

### What you get

- 🛏️ **Airbnb badge** on the property card.
- **Filter chip** "🛏️ Airbnb" on the Properties page.
- **Pink STR block** on the property's Finance tab.
- **5th KPI tile** on the Dashboard (🛏️ STR income).
- **Stale-period nudge** — if you haven't logged this month yet.
- **Income source filter pills** on the Rent page (All / 🏠 Tenant rent / 🛏️ Airbnb).
- **Revenue Breakdown card** on the P&L report (Tenant rent / Airbnb / Total).
- **7-column P&L PDF** with red-highlighted Airbnb column.

### Log SA income

Click "+ Log STR income" on the property's Finance tab:
- Amount.
- Optional period start + end (which dates this payout covers).
- Paid date.
- Method (bank / cash).
- Notes.

### What's tracked

- Stored in `payments` table with `income_source = 'airbnb'`.
- Counted separately from rent in every report and KPI.
- Arrears report explicitly skips SA (no concept of arrears for nightly stays).

---

## 19. Document Vault

Two layers.

### Property docs

- Compliance: Gas Safety, EICR, EPC, HMO Licence (each with expiry date — appear on Diary calendar).
- Other: insurance, mortgage, fire risk, deeds.
- Drag-drop or browse upload.
- Automatic signed-URL refresh (1-year validity).
- Storage in Supabase `property-docs` bucket.

### Tenant docs (Tenant Vault)

- ID document (passport / DL).
- Right-to-Rent check.
- References.
- Signed tenancy agreement.
- Deposit protection certificate.
- Custom uploads.
- Tenant can self-upload via the onboarding link.
- Storage in Supabase `tenant-docs` bucket.

### Property images (Gallery)

- Per-property photo + video gallery.
- Used on the public Rooms page.
- Stored in Supabase `room-photos` bucket.

---

## 20. Tenant Onboarding & Tenant Portal

### Tenant onboarding link

- From Tenants → tenant card → "Send onboarding link".
- Generates a public URL the tenant opens (no login).
- Tenant fills in: their details, emergency contact, employer, nationality, DOB, uploads ID + RTR.
- Submitted data flows directly into the tenant record + their vault.

### Tenant portal (`/tenant-portal.html`)

- Each tenant gets a username + password (admin sets, or auto-generated).
- Logged-in tenant can:
  - See rent due / paid / next due date.
  - Download their tenancy agreement.
  - Download their deposit protection certificate.
  - Log a maintenance issue (creates a job in your Maintenance page).
  - See their personal documents.
  - Update their phone / email.

---

## 21. Public-Facing Rooms Page

URL: `/rooms.html?org=<your-org-id>`.

- Lists all rooms across your portfolio that are vacant or coming available.
- Pulls org branding: logo, name, tagline, WhatsApp number.
- One CTA button: "WhatsApp us" (opens WhatsApp pre-filled with room of interest).
- Mobile-optimised.
- No login required.

You can share the URL on listings sites (SpareRoom, OpenRent, gumtree), social media, your own website.

---

## 22. Imports & Exports

### Imports (CSV)

Settings → Import:

- **Properties import** — CSV with columns: name, address, postcode, area, type, rooms, ownership_type, letting_type, landlord_rent, etc.
- **Tenants import** — CSV with columns: name, property, room, rent, freq, payday, status, start_date, deposit, method, etc.
- Pre-validated against your plan's caps before any rows are inserted.
- Preview screen shows what will be created vs skipped.

### Exports (CSV)

- **Rent collection CSV** (Rent page → Export).
- **Tenants CSV** (Tenants page).
- **Properties CSV** (Properties page).
- **Expenses CSV** (Expenses page).
- **Maintenance CSV** (Maintenance page).

### Exports (PDF)

- **Property report** — single property summary (income, costs, P&L, maintenance log, tenants).
- **Landlord statement** — branded monthly statement per landlord.
- **Reports → P&L** — branded portfolio P&L (5 or 7 columns).
- **Reports → Cash Flow.**
- **Reports → Forecast.**
- **Tenancy agreement** (AST or Excluded Licence).
- **PDF + AI** — any report with an AI analysis page appended.

### Accounting export

- **Reports → Accounting Export** modal.
- Choose target software: Xero / QuickBooks / Sage / FreeAgent.
- Choose period (preset or custom date range).
- Generates compatible CSV with appropriate account codes + transaction types.

---

## 23. Compliance & Certificates

Per property, tracked via the Docs tab:

- **Gas Safety Certificate** — renewable yearly. Reminder appears 60 days before expiry.
- **EICR (Electrical Installation Condition Report)** — renewable every 5 years. 90-day reminder.
- **EPC (Energy Performance Certificate)** — minimum E rating required for letting. 90-day reminder.
- **HMO Licence** — varies by council. Custom expiry date + reminder.

When approaching expiry:

- Diary calendar marks the date.
- Recurring Maintenance template (if enabled) auto-creates a "Renew Gas Safety" job at 30 days lead time.
- AI Portfolio Agent flags expiring certs in daily insights.

---

## 24. Communication (WhatsApp, Email)

### WhatsApp

- **Rent reminder** — Rent page → click row → 📲 Reminder. Opens WhatsApp with the tenant pre-filled, message ready to send.
- **Send maintenance to contractor** — Maintenance → click job → "Send to contractor" → WhatsApp opens with property address, access details, photo links.
- **Share All Open** (Maintenance) — single message summarising all open jobs.
- **Cash collection share** (Rent → Cash tab) — shareable summary for accountant.

### Email

- **Rent reminders** — automated based on Settings → Email config.
- **Welcome email** — sent on signup.
- **Trial-ending email** — 3 days before trial expires.
- **Payment-received email** — sent automatically when a payment is marked paid (configurable).
- **Custom email to tenant** — Tenants → tenant → Send Email. Free-text.
- **Lifecycle emails** — managed via cron.

All sent via Resend (`RESEND_API_KEY`). Audit log at Settings → Email → Email log.

---

## 25. Subscription & Billing

- Settings → Billing.
- Live Stripe integration (`STRIPE_SECRET_KEY` in env).
- 14-day free trial on signup.
- Plans: Free / Starter (£49) / Professional (£89) / Business (£149) / Enterprise (£299).
- **Upgrade / Downgrade** via Stripe Checkout.
- **Manage plan** via Stripe Customer Portal — cancel, update card, view invoices.
- **Plan-limit enforcement** at three layers (DB trigger + client gate + import gate).
- **Free grants** (set by superadmin):
  - `billing_override='free'` — indefinite.
  - `free_until=<date>` — time-boxed (auto-expires).
- **Manual subscription** (`stripe_subscription_id='manual'`) — admin grants paid plan without Stripe billing.

---

## 26. Superadmin Panel

Available at `/superadmin.html` to users in `superadmin_allowlist`.

### Pages

- **Dashboard** — total orgs, MRR, active count, churn, growth charts.
- **Companies / Trials / Cancelled** — list of all orgs with quick-status, quick-plan, full edit modal, password reset, usage stats.
- **MRR & Plans** — revenue breakdown by tier.
- **Activity** — full feed of changes.
- **Audit Log** — every superadmin action.
- **Plans & Pricing** — edit plan tiers, prices, caps. Add custom tiers.
- **All Users** — every auth user across all orgs.
- **Blog** — DB-backed blog editor.
- **Superadmin Access** — manage the allowlist.

### Per-org actions (superadmin)

- View usage stats (properties / tenants / rooms count).
- Change status (trial / active / paused / cancelled).
- Change plan.
- **Grant FREE GRANT** (`billing_override='free'`).
- **Set free until date** (`free_until`).
- Set / reset user passwords.
- Edit MRR override.
- View members + remove members.
- Full delete (cascades all data via FK ON DELETE CASCADE).

### Blog editor

- New / Edit / Delete posts.
- Fields: title, auto-generated slug (with manual override), category, author, read time, excerpt, cover image (URL or upload), body HTML, tags.
- **📷 Insert image at cursor** — upload + insert into body in one click.
- **Save Draft** — only visible to you.
- **Publish** — makes it live at `/blog/<slug>`.
- View live link from list.
- Soft-delete from list.

---

## 27. Demo Account

For prospects to test the app without signing up.

- Login button on `/login.html`: **"🚀 Try the demo — no signup"**.
- Credentials baked in: `demo@landlordapp.io` / `DemoAccount2026!`.
- Pre-loaded with:
  - 1 organisation (FREE GRANT — no Stripe gate).
  - 1 limited company.
  - 3 landlords.
  - 5 properties (4 HMO + 1 whole let; one SA-enabled).
  - 12 tenants distributed across properties.
  - 5 maintenance jobs.
  - ~24 payments (last month paid + current month scheduled + one realistic overdue tenant).
  - 5 recurring expenses.
  - 1 SA / Airbnb payout entry.
- **Auto-resets daily at 03:00 UTC** via `pg_cron`. Every visitor gets a clean sandbox.

---

## 28. Mobile Use

Fully mobile-responsive — no app store needed.

- Bottom navigation bar with the main pages.
- Page headers wrap to 2 rows on narrow screens (title on top, scrollable action strip below).
- KPI strips collapse to 2-per-row.
- Property + tenant cards reflow to single column.
- Modals fill the screen with sticky save / close buttons.
- Cash collection + rent reminders work via WhatsApp deep links.
- Tenant portal optimised for tenants on phones.
- Public Rooms page mobile-first.

---

## 29. Quick Reference: All actions A-Z

| Want to… | Where |
|---|---|
| Add a contractor | Maintenance → Contractors → + Add |
| Add a custom plan tier | Superadmin → Plans & Pricing → + Add Plan |
| Add a landlord | Landlords → + Add |
| Add a maintenance job | Maintenance → + Log Request |
| Add a property | Properties → + Add Property |
| Add a recurring expense | Expenses → + Add Expense, tick recurring |
| Add a staff user | Users → + Invite |
| Add a tenant | Tenants → + Add Tenant |
| Analyze a deal | Properties → Deal Analyzer |
| Archive a property | Property card → Archive |
| Ask the AI about my portfolio | Dashboard → Search box (or AI Agent panel) |
| Attach a receipt | Expenses → row → 📎 Attach |
| Auto-create yearly Gas certs | Maintenance → 🔄 Recurring → Enable Gas Safety template |
| Backdate a payment | Tenant → Rent tab → Edit payment → set paid date |
| Change my plan | Settings → Billing → Upgrade/Manage |
| Compare deal scenarios | Deal Analyzer → Save scenarios → load side-by-side |
| Create a blog post | Superadmin → Blog → + New Post |
| Delete an org permanently | Superadmin → Org modal → Delete |
| Download a landlord statement | Landlords → landlord → 📄 Statement PDF |
| Download a tenancy agreement | Tenant → Generate AST / Excluded Licence |
| Edit per-room rent | Property → Rooms tab → inline edit |
| Email a rent reminder | Rent → row → 📧 Email reminder |
| Enable SA / Airbnb on a property | Property → Details → tick 🛏️ box |
| Export to Xero | Reports → Accounting Export → choose Xero |
| Filter by operating company | Any page → Companies dropdown |
| Filter rent by income source | Rent page → All / Tenant / Airbnb pills |
| Forecast next 12 months | Reports → Forecast tab |
| Generate AI portfolio analysis | Reports → PDF + AI |
| Generate tenant onboarding link | Tenant → Send onboarding link |
| Grant free access to an org | Superadmin → Org modal → FREE GRANT |
| Import properties from CSV | Settings → Import → Properties |
| Insert image into blog post | Blog editor → 📷 Insert image at cursor |
| Invite a tenant to the portal | Tenant → Set up portal access |
| List vacant rooms publicly | Public URL: `/rooms.html?org=<id>` |
| Log Airbnb income | Property → Finance tab → + Log STR income |
| Mark a tenant as moved out | Tenant → Details → set notice + move-out date |
| Mark cash payment | Rent → row → Mark paid → Cash |
| Move tenant to a different room | Tenant → Details → change room dropdown |
| Reset a user's password | Superadmin → Users → 🔑 |
| Restore an inactive tenant | Tenants → Inactive → Restore |
| Run a deal analysis | Properties → Deal Analyzer |
| Save a deal scenario | Deal Analyzer → Save Scenario |
| Schedule maintenance for a date | Maintenance → Log Request → set scheduled date |
| See a tenant's payment history | Tenant → Rent tab |
| See arrears | Tenants → Arrears filter |
| See compliance expiries | Diary calendar OR Property → Docs |
| See void cost | Rooms page OR Reports |
| Send maintenance to contractor | Maintenance → job → Send to contractor |
| Set a budget per category | Expenses → Budgets tab |
| Set per-room rents in deal analysis | Deal Analyzer → HMO mode → expand "Set individual room rents" |
| Set up multi-company filter | Settings → Companies → + Add |
| Take a photo of a maintenance issue | Maintenance → Log Request → upload photo |
| Track void days | Rooms page (Void Tracker) |
| Update payment method | Settings → Billing → Manage plan |
| Upload a Gas Safety certificate | Property → Docs tab → upload |
| Upload tenant ID | Tenant → Documents tab → upload |
| WhatsApp all my open jobs | Maintenance → 📲 Share All Open |
| WhatsApp rent reminder | Rent → row → 📲 |

---

*Living document. Updated 2026-04-25.*
