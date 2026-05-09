# STR (Airbnb / Short-term rental) — Phase 2 ideas

This file collects features deliberately deferred from Phase 1 (the minimal
"validate the demand" version shipped in late April 2026).

**Do not build any of these without product validation first.** Phase 1 is
intentionally minimal — one property checkbox, one source dropdown on
income entries, one revenue split in the P&L. If <2 customers actively log
STR income within 30 days of release, the right next move is to delete the
feature, not expand it.

If signal is strong (>5 customers logging STR income regularly, requests
coming in unprompted), use this list to prioritise Phase 2.

---

## Tempting things we explicitly skipped in Phase 1

### Integrations
- **Airbnb / Booking.com / VRBO API integrations** — auto-import bookings & payouts.
  Massive scope. Each platform has different OAuth flows, rate limits, payout
  reconciliation rules. Build only after manual entry proves the demand.
- **iCal calendar sync** — import availability/bookings from any STR platform's
  iCal export. Cheaper than full API. One screen + parser.

### Booking-level data
- **Guest details** (name, contact, party size, country)
- **Booking references** (Airbnb confirmation code etc.)
- **Check-in / check-out dates** (vs the loose "period start/end" we ship)
- **Nights booked** per entry
- **Lead time / advance booking days**

### Money breakdown
- **Gross vs net distinction** — currently we record net only. Phase 2 should
  capture gross + Airbnb fees + cleaning fees + service fees separately, then
  display net derived.
- **Per-platform tagging** beyond a single "airbnb" label —
  Booking.com / Vrbo / SpareRoom / direct etc.
- **Cleaning fees** as a separate line (currently rolled into "net income")
- **VAT treatment** — UK STR can be VAT-registered above the threshold.
  Different rules from residential rent (residential is exempt). Needs proper
  treatment before a customer crosses the threshold and gets a nasty surprise.

### Metrics & analytics
- **Occupancy %** — nights booked / nights available per property per month
- **Average nightly rate (ANR)** — needs nights data
- **RevPAN / RevPAR** — revenue per available night/room
- **Yield calculations** vs long-term let equivalent (would the property earn
  more as a long-term let? Useful for pivot decisions.)
- **Booking lead time** trend chart
- **Calendar view** — month grid showing booked nights per property

### Operational
- **Cleaning schedule** — auto-generated from check-out dates; ties into Maintenance
- **Linen / consumables tracking**
- **Self-check-in instructions** generator (Airbnb-style)
- **Guest review tracking** (rating + comments per booking)
- **Pricing rules** — base rate + weekend uplift + seasonal multipliers

### Bulk / import
- **CSV bulk import** — Airbnb/Booking.com payout exports
- **Bank statement matching** — match a £450 deposit on the 14th to "Mar STR
  income" automatically

### Multi-platform
- **Per-platform expense categories** — Airbnb host fee, cleaning fee paid out,
  consumables, OTA service fees
- **STR-specific expense templates** — toiletries, linen replacement, hot tub
  maintenance, pool, etc.

### Compliance
- **Local STR licensing tracking** (Greater London 90-night cap, etc.)
- **STR-specific safety certs** (PAT, fire blanket, etc. on top of standard
  HMO compliance)

---

## Lessons / gotchas captured during Phase 1 build

1. **`payments.tenant_id` is now nullable in our app code, not just the DB.**
   Audited 13 files. The hot spots that needed guards: `renderRentRow` in
   12-rent.js (added STR-specific render path).
2. **Arrears stay tenant-only by design** — STR has no "scheduled rent that's
   late" concept. Comment added in 43-arrears-report.js.
3. **`status: 'paid'` is the default for STR entries** because they're recorded
   AFTER the income hits — there's no scheduling phase like tenant rent.
4. **Reports automatically split** — anywhere we already iterated `state.payments`
   and rolled up by month, STR income is naturally included. The P&L report
   adds a visible "Tenant rent / Airbnb / Total" row split when STR > 0.
5. **Dashboard "STR income" tile** only appears when at least one property is
   STR-enabled — keeps existing customers' dashboards unchanged.
6. **Stale-period nudge** — surfaces on Dashboard when an STR-enabled property
   has no income logged for the current month. A gentle in-app reminder, not
   email/push.

---

## Decision rule for Phase 2

Wait 30 days post-launch. Then:

- **0 customers logging STR income** → delete the feature, restore the
  pre-STR Dashboard layout, drop the columns.
- **1–2 customers** → leave Phase 1 in place; do nothing else.
- **3–5 customers, infrequent use** → ship one Phase 2 item: probably
  iCal sync (cheap, high signal of "yes I really do this").
- **>5 customers, frequent use, requests for more** → start the proper STR
  product roadmap. First investments: gross/net breakdown, per-platform
  tagging, occupancy %.

Build to demand, not to hypothesis.
