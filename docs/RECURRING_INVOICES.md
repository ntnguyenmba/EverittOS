# Recurring invoices

## Behavior

- Templates store amount, cadence, next run date, customer/job links.
- **Run now** creates a draft invoice in the `invoices` table (not auto-charged, not auto-sent unless explicitly requested later).
- **Process due** (`POST /api/recurring-invoices/process-due`) generates drafts for all active templates due on or before today.
- Run history is stored in `recurring_invoice_runs`.

## Permissions

Owner, admin, and manager can manage templates. Workers, contractors, viewers, and clients cannot.

## UI

Invoices page → Recurring invoices section (`/invoices`).

## Migrations

- `supabase/migrations/202608120001_post_v1_recurring_invoices.sql`
- `supabase/migrations/202609030001_post_v1_rls_integrations.sql` (RLS)
