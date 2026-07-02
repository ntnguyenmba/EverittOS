# EverittOS post-v1 feature plan

Build order:

1. **Launch v1 after Resend works** — see `docs/RESEND_SETUP.md` and `docs/launch-checklist.md`
2. Recurring invoices — `docs/RECURRING_INVOICES.md`
3. Customer messaging — email-first threads at `/messages`
4. Richer dashboards from real data — `docs/DASHBOARD_METRICS_FOUNDATION.md`
5. Inventory — `docs/INVENTORY.md`
6. QuickBooks integration (optional) — `docs/QUICKBOOKS_SETUP.md`
7. Route optimization (later) — `docs/ROUTE_OPTIMIZATION.md`

## Product positioning

- EverittOS is an operations platform, not accounting/tax/bookkeeping software.
- QuickBooks is optional; user controls sync/export; QuickBooks remains accounting system of record.
- No SMS/Twilio in messaging — email only for now.
- Visual design unchanged — functional additions only.

## Status (repo)

| Feature | Status |
|---------|--------|
| Resend / launch readiness | Admin launch status + docs |
| Recurring invoices | APIs + UI on `/invoices` |
| Customer messaging | APIs + thread UI on `/messages` |
| Dashboard metrics | Live aggregates from jobs, invoices, expenses, bookings, messages, reports |
| Inventory | APIs + `/inventory` |
| QuickBooks | OAuth scaffold + sync log + Settings UI |
| Route optimization | Heuristic API + `/routes` |

Apply migrations in `supabase/migrations/` via Supabase SQL editor or CLI.
