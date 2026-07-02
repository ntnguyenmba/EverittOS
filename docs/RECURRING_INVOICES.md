# Recurring invoices

**Status: Complete** (requires migrations applied in Supabase)

## Behavior

- Templates store amount, cadence, next run date, customer/job links.
- **Run now** creates:
  - a row in `invoices` (draft unless `sendEmail` is explicitly true)
  - a matching `outbound_documents` invoice row (appears in Invoices page Drafts tab)
  - a `recurring_invoice_runs` history record
- **Process due** (`POST /api/recurring-invoices/process-due`) generates drafts for due active templates.
- Nothing is auto-charged or auto-sent by default.

## API

- `GET/POST /api/recurring-invoices`
- `PATCH/DELETE /api/recurring-invoices/[id]` — DELETE pauses template if run history exists
- `POST /api/recurring-invoices/[id]/run-now`
- `POST /api/recurring-invoices/process-due`

## Permissions

Server-side via `requireFinanceApiAccess()` — owner/admin/manager only for mutations.

## Migrations

- `202608120001_post_v1_recurring_invoices.sql`
- `202609030001_post_v1_rls_integrations.sql`
- `202609040001_post_v1_backend_repair.sql`

## Limitations

- Run-now does not send email unless `sendEmail: true` is passed (UI defaults to draft).
- Due-date terms on templates are not yet a separate field; use invoice payment fields after generation.
