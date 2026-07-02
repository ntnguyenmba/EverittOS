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

- EverittOS is an operations platform, not accounting/tax/bookkeeping/payroll/reconciliation software.
- QuickBooks is optional; user controls sync/export; QuickBooks remains accounting system of record.
- No SMS/Twilio in messaging — email only for now.
- Visual design unchanged — functional additions only.

## Honest status (repo)

| Feature | Status | Notes |
|---------|--------|-------|
| Resend / launch readiness | **Complete** | Admin launch status checks `RESEND_API_KEY` + `EMAIL_FROM`; copy-link fallback unchanged |
| Recurring invoices | **Complete** | APIs, RLS, run history, draft invoice + outbound draft row on run-now |
| Customer messaging | **Complete** | Thread APIs, Resend send/fail logging, org-scoped customer/job links |
| Dashboard metrics | **Complete** | Live queries; zeros when empty |
| Inventory | **Complete** | CRUD, adjustments, soft deactivate, low-stock detection |
| QuickBooks | **Partial** | OAuth connect/callback, disconnect, sync log, export/sync queue — no live QuickBooks API mapping yet |
| Route optimization | **Complete (basic)** | Heuristic ordering only; apply confirms order without auto-changing schedule times |

## Required migrations (run in order)

1. `202608120001_post_v1_recurring_invoices.sql`
2. `202608120002_customer_messaging_foundation.sql`
3. `202608120004_inventory_foundation.sql`
4. `202609020001_invoice_payment_fields.sql` (payment fields on invoices/outbound)
5. `202609030001_post_v1_rls_integrations.sql` (RLS + QuickBooks + routes tables)
6. `202609040001_post_v1_backend_repair.sql` (idempotent RLS refresh + constraints)

Apply via Supabase SQL editor or CLI.
