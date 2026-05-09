# LandlordApp — Handover

**Date:** 2026-05-04
**Stack:** Node/Express monolith (`server.js`) + vanilla-JS dashboard bundled by esbuild + Supabase (Postgres + Storage + Auth) + Stripe + Resend (email).
**Deployment:** dashboard bundle = `public/js/dashboard.bundle.js` (built from `src/dashboard/sections/*.js` via `npm run build`). Server = `server.js` on a host of your choice.
**Two Supabase projects:**
- **Prod:** `kzumoubhxdoqqcucdact` — landlordapp.io app data
- **Test:** `piufcteaqmxemidfdoim`

---

## 🔴 OPEN BUG (top priority): tenants reappear after permanent delete

### Symptom
- Admin user goes to Archived tab → deletes tenants one by one (or 30 in a row).
- UI shows them disappear.
- On page refresh, **all the deleted tenants come back**.
- Console shows `Loaded from Supabase: ... 190 tenants` even after the user thought they deleted 30 — meaning the rows are still in the DB.

### What's been tried (none fully resolved it)

1. **`deleteTenantPermanent` rewritten** to first delete child rows that have FK constraints (payments by `tenant_id`, plus best-effort cleanup of `tenant_docs`, `comm_log`, `email_log`, `rent_schedule`), then delete the tenant. — `src/dashboard/sections/20-room-photo-sync...js`.
2. **Verify-after-delete** — chained `.select('id')` to the DELETE so we can see how many rows were actually deleted. If `data.length === 0`, the function aborts with a toast `"Delete blocked — no row removed. Likely an RLS policy blocking delete on tenants."`
3. **Tombstone Set** to fix a delete-then-autosave race (a real race we identified: bulk autosave from state at moment 1 was racing with delete at moment 2 and re-INSERTing via `ON CONFLICT ... DO UPDATE`). Implementation in `48-savestate-debounced-upsert-to-supabase.js`:
   - `var _deletedTombstones = { tenants: {}, ... };`
   - `markRowDeleted(table, id)` registers the id with a 60s TTL.
   - `_upsertIfChanged` strips tombstoned ids from upsert payloads before sending.
   - Wired into `deleteTenantPermanent`, `deletePropPermanent`, `deleteMaintenanceJob`.
4. **Pending-row gate** dropped — old code required `t.status === 'inactive'` before allowing delete; this was loosened so any tenant is deletable after explicit confirm.

### After all of the above, the user reported deleted tenants STILL reappear.

### Most likely remaining causes (investigate in this order)

#### A. Supabase RLS is silently blocking the DELETE
Most likely culprit. The user is the org admin per `org_members` but the `tenants` table's DELETE policy may not let them through. With our new `.select('id')` chain, this would now show an error toast — but if the user dismissed it / didn't report the toast, the bug looks identical from the outside.

**How to verify:**
1. In Supabase SQL Editor, run as the user's auth.uid():
   ```sql
   SELECT policyname, permissive, roles, cmd, qual, with_check
   FROM pg_policies
   WHERE schemaname='public' AND tablename='tenants';
   ```
   Look for a `DELETE` policy. If there's only a SELECT/UPDATE policy, deletes will be blocked silently.
2. Try a manual delete in the SQL Editor:
   ```sql
   DELETE FROM tenants WHERE id = '<actual_tenant_id>' AND org_id = 'a25224a8-971c-4025-8322-4ba953ca75d5' RETURNING id;
   ```
   If it returns `0 rows`, the policy is wrong.
3. **Quick fix** if missing — add a policy:
   ```sql
   CREATE POLICY tenants_delete_admin ON public.tenants FOR DELETE TO authenticated
     USING (org_id IN (
       SELECT org_id FROM public.org_members
       WHERE user_id = auth.uid() AND role = 'admin'
     ));
   ```

#### B. Another code path is re-creating tenants from another data source
Look for any function that creates tenants from `rent_schedule`, `payments`, `payment_history`, or `previous_tenancies`. The pattern would be something like "if a payment references a tenant_id that doesn't exist, create the tenant".

**Files to grep:**
```
src/dashboard/sections/49-loadstate-fetch-all-data-from-supabase.js
src/dashboard/sections/14-actions.js
src/dashboard/sections/20-room-photo-sync-runs-in-background-does-not-block-startup.js
```
Search for `state.tenants.push(` and confirm every call site is intentional.

#### C. Multi-tab race not protected by tombstone
If the user has another tab/device open with stale state, that tab's autosave will push the (still-present-in-its-state) tenants up via `INSERT ... ON CONFLICT id DO UPDATE`, which **re-INSERTs deleted rows** because `ON CONFLICT DO UPDATE` is effectively an UPSERT — there's no row to conflict with after the delete.

The tombstone in tab 1 doesn't protect tab 2.

**Fix options:**
- **Option 1:** Switch the tenants upsert from `ON CONFLICT ... DO UPDATE` to `ON CONFLICT ... DO NOTHING` (`ignoreDuplicates:true`). New tenant inserts still work; existing rows aren't overwritten. **But:** an UPDATE to an existing tenant via the bulk autosave would no longer apply — you'd need to make `saveTenantEdits` etc. do **direct UPDATE** statements (like we did for `markLandlordPaid`).
- **Option 2:** Skip the bulk autosave for `tenants` entirely — every tenant write goes through a targeted `supa.from('tenants').update/insert/delete()` call.
- **Option 3:** Add Supabase Realtime subscription on the tenants table — when one tab deletes, all open tabs see it and remove from their local state immediately. More work but solves the root cause permanently.

#### D. The migration `db/2026_05_field_fixes.sql` was never actually applied on prod
Console message: `tenants fell back to select(*) — column missing on this project, recommend running pending migrations` — confirms `archived_at` is not on tenants. The migration adds:
- `tenants.archived_at`
- `properties.lease_start_date`
- `properties.landlord_pay_day`

User claims they ran it. They may have run it on test (`piufcteaqmxemidfdoim`) instead of prod. Re-run on prod and follow with `NOTIFY pgrst, 'reload schema';`.

This isn't itself the cause of tenants coming back, but it's a related red herring that confuses the diagnostic picture.

---

## 🟡 Other open issues / observations

### Schema cache hint about Maintenance autosave
Console showed `Save warning [maintenance]: TypeError: Failed to fetch` — this is the bulk autosave URL becoming so long (because `columns=` query param lists every column) that some intermediary rejects it. CORS error in the browser is cosmetic — the underlying issue is request-size or auth.

Workaround: not user-blocking; only happens during very-rapid back-to-back saves. Suggest investigating if it correlates with autosave failures.

### Supabase Free plan quota grace period
Earlier sessions saw "egress quota exceeded — grace period until 23 May 2026". The diff-cache + tombstone fixes have already cut egress by ~95%, so the user may have stayed within budget. Re-check Supabase usage dashboard to confirm.

### Demo org auto-restores tenants
The pg_cron job `refresh_demo_org_hourly` re-creates demo tenants every hour for org `00000000-0000-0000-0000-00000000d3d0`. The current `deleteTenantPermanent` detects this and toasts:
*"Demo org resets hourly so they'll reappear."*
**This is by design.** Real-org users (e.g. `a25224a8-...4ba953ca75d5`) are unaffected.

---

## ✅ Recently completed (this conversation)

### SQL migrations expected on prod
1. `db/communication_templates.sql` — Communication Hub tables (✅ user confirmed run)
2. `db/communication_log.sql` — (✅ user confirmed run)
3. `db/communication_templates_seed.sql` — (✅ user confirmed run)
4. `db/2026_05_field_fixes.sql` — **🔴 USER CLAIMED RUN BUT CONSOLE SAYS NOT APPLIED — re-run on prod**
   - Adds `tenants.archived_at`, `properties.lease_start_date`, `properties.landlord_pay_day`
5. `db/org_members_invited_name.sql` — **🔴 NEEDS TO BE RUN** to fix "User f0b212" placeholder names + email-not-saving on Edit User

### Code changes shipped
| Fix | Files |
|-----|-------|
| Diff-based save cache (95%+ egress reduction) | `48-savestate...js` |
| `_resetSaveSnapshot()` on org load | `49-loadstate...js` |
| WhatsApp messaging — text-only on desktop, full emojis on mobile via `_waIsMobile()`/`_waEmoji()`/`_waSanitize()` | `02-helpers.js`, `12-rent.js`, `16-property-detail-modal.js`, `23-rooms-page.js`, `47b-pdf-reports.js`, `50-send-maintenance...js`, `55-communication.js`, `11-tenants.js`, `31-tenancy-agreement.js`, `31b-contract-dispatch.js` |
| Reports P&L cash-basis fix (LL costs only count paid rows) | `41-reports-page.js`, `42-p-l-report.js`, `44-cash-flow-report.js` |
| Property modal: separate Landlord Pay Day field, decoupled from Lease Start Date | `16-property-detail-modal.js`, `20-room-photo-sync...js`, `22-landlord-payment-schedule.js` |
| Mappers round-trip `lease_start_date`, `landlord_pay_day`, `archived_at` (REQUIRES SQL MIGRATION) | `05-row-app-object-mappers.js`, `06-app-object-row-mappers.js`, `49-loadstate...js` |
| `archiveTenant` graceful column-missing fallback + better message | `20-room-photo-sync...js` |
| `archiveProperty` cascades — moves tenants out + clears future LL payments | `20-room-photo-sync...js` |
| Default app page = Dashboard (was last-visited) | `49-loadstate...js` |
| Reports default period = `this_month` (was `ytd`) | `41-reports-page.js` |
| Landlord page: search box + 4 tabs (All/Overdue/Due This Week/Paid) + clickable property names + default month=current | `22-landlord-payment-schedule.js` |
| Landlord page: rent-dues flat table at top (Landlord · Property · Amount · Due · Mark Paid) | `22-landlord-payment-schedule.js` |
| Communications page → Tenants > Communications sub-tab | `11-tenants.js`, `55-communication.js`, `03-nav.js` |
| Deal Analyzer: compact controls row (saved-deals dropdown + R2R/Owned + HMO/Whole/SA all on one line) | `19-deal-analyzer.js` |
| Edit User modal: persists name/email to `org_members` (requires SQL #5 above to fully work) | `49-loadstate...js` |
| Tombstone Set on autosave to defeat delete-then-reupsert race | `48-savestate...js`, `20-room-photo-sync...js`, `14-actions.js` |
| Verify deletes via `.select('id')` to detect RLS silent blocks | `20-room-photo-sync...js`, `14-actions.js` |

### Architecture notes for the next maintainer
- **Row mappers** are the single source of truth for what gets persisted. Two-way:
  - `rowToProp`, `rowToTenant`, `rowToLandlordPayment` etc. in `05-row-app-object-mappers.js` (DB → state)
  - `propToRow`, `tenantToRow`, `landlordPaymentToRow` etc. in `06-app-object-row-mappers.js` (state → DB)
  - **If a field isn't in BOTH mappers, it silently doesn't persist.** This caused the "Lease Start Date doesn't save" and "Edit User doesn't save email" bugs.
- **Diff cache** in `48-savestate...js` (`_lastSavedSnapshot`) means each table is only re-uploaded when its JSON has changed since last save. Reset via `_resetSaveSnapshot()` after `loadState()` to baseline against DB-truth.
- **Tombstone Set** in `48-savestate...js` (`_deletedTombstones`) protects against delete-then-autosave race. Only protects within the current tab/session — multi-tab races still possible.
- **Direct DB calls** (not via the bulk autosave) are used for critical writes:
  - `markPaid` / `markSchedulePaid` / `confirmPartialPaid` — payments
  - `markLandlordPaid` — landlord_payments (uses natural key `property_id + month_key` to survive UUID resets)
  - `archiveTenant` / `deleteTenantPermanent` — tenants
  - `archiveProperty` / `deletePropPermanent` — properties + cascade
  - `markRowDeleted` registers a tombstone ahead of any DELETE.
- **WhatsApp emoji handling** — split between mobile (renders 4-byte emojis fine) and desktop browser (mangles them to �). `_waIsMobile()` detects, `_waEmoji('🔧 ')` returns the emoji on mobile or empty on desktop, `_waSanitize(text)` strips 4-byte sequences and VS-16 from any user-typed string before encodeURIComponent. Apply to every wa.me URL.

---

## How to deploy a fix
1. Edit the relevant `src/dashboard/sections/*.js` file(s).
2. `npm run build` (rebuilds `public/js/dashboard.bundle.js` via esbuild — typically <1s).
3. Push the new bundle to your host.
4. **Hard refresh** the browser (Ctrl-Shift-R) to bypass cache.
5. If the change touches `server.js`, restart the Node process.
6. If a SQL migration is needed, run on prod Supabase + follow with `NOTIFY pgrst, 'reload schema';` so PostgREST sees the schema change immediately.

---

## Recommended next 30-minute session

1. **Run `db/2026_05_field_fixes.sql` on the prod Supabase project** (`kzumoubhxdoqqcucdact`). Verify the columns exist by running:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_schema='public' AND table_name='tenants' AND column_name='archived_at';
   ```
   Expected: 1 row.
2. **Run `db/org_members_invited_name.sql`** on prod (fixes the "User f0b212" + email-not-saving bug).
3. **Diagnose the tenant delete bug** by following Section A above (check RLS policies on `tenants` for DELETE).
4. **If RLS is the cause:** create the missing DELETE policy (see SQL above). Test by deleting a tenant — the new `.select('id')` chain will now return the deleted row, the toast says "permanently deleted", and a refresh confirms the row stays gone.
5. **If RLS is fine:** investigate Section B (search for unintended `state.tenants.push` calls) and Section C (consider switching to `ignoreDuplicates:true` for tenants + direct UPDATEs for edits).

---

## Useful files to know about

| File | Purpose |
|------|---------|
| `src/dashboard/state.js` | Initial state object + role/permission constants |
| `src/dashboard/sections/03-nav.js` | Sidebar nav items |
| `src/dashboard/sections/04-auth-org-provisioning.js` | Sign-in, org provisioning, `org_members` sync, role resolution |
| `src/dashboard/sections/05-row-app-object-mappers.js` | DB → state mappers (rowToProp, rowToTenant, etc.) |
| `src/dashboard/sections/06-app-object-row-mappers.js` | state → DB mappers (propToRow, tenantToRow, etc.) |
| `src/dashboard/sections/11-tenants.js` | Tenants page renderer (incl. Communications sub-tab) |
| `src/dashboard/sections/12-rent.js` | Rent page renderer + cash collection share |
| `src/dashboard/sections/13-maintenance.js` | Maintenance page + refresh button |
| `src/dashboard/sections/14-actions.js` | Generic action handlers (markSchedulePaid, deleteMaintenanceJob, etc.) |
| `src/dashboard/sections/16-property-detail-modal.js` | Property detail modal incl. lease start + landlord pay day |
| `src/dashboard/sections/19-deal-analyzer.js` | Deal Analyzer page |
| `src/dashboard/sections/20-room-photo-sync...js` | archiveTenant, deleteTenantPermanent, archiveProperty, deletePropPermanent, savePropDetail |
| `src/dashboard/sections/22-landlord-payment-schedule.js` | Landlord page incl. rent-dues table, ensureLandlordSchedule |
| `src/dashboard/sections/23-rooms-page.js` | Public rooms listing share |
| `src/dashboard/sections/41-reports-page.js` | Reports page (P&L, cash flow, forecast tabs) |
| `src/dashboard/sections/42-p-l-report.js` | P&L tab — cash-basis (only counts paid LL payments) |
| `src/dashboard/sections/44-cash-flow-report.js` | Cash flow tab |
| `src/dashboard/sections/48-savestate-debounced-upsert-to-supabase.js` | Bulk autosave + diff cache + tombstone Set |
| `src/dashboard/sections/49-loadstate-fetch-all-data-from-supabase.js` | Boot data load from Supabase + Edit User modal |
| `src/dashboard/sections/50-send-maintenance-job-to-contractor.js` | WhatsApp share for maintenance jobs |
| `src/dashboard/sections/55-communication.js` | Communication Hub (templates + history + composer) |
| `server.js` | Single Express monolith — routes, auth, Stripe, Resend, comm hub, refunds, etc. |
| `db/*.sql` | Schema migrations |
| `scripts/build-dashboard.js` | esbuild concatenator (no JS bundler config — just one file) |

---

**End of handover.**
