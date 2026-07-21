# EverittOS financial architecture

## Principle

Customer cash is recorded once and drives every financial metric.

```text
Job has expected amount
→ Client pays (Zelle, cash, portal, card, etc.)
→ Owner taps Record Payment on the job
→ If an invoice exists, the payment is stored on invoice_payments
→ If no invoice exists, the payment is stored on job_payments
→ Dashboard, profit, cash, receipts, and reports update from shared helpers
```

Invoices remain optional. Creating an invoice is never required to record a payment.

## Canonical payment writers

| Scenario | Writer | Ledger table |
|----------|--------|--------------|
| Direct job payment (no invoice) | `lib/finance/job-payments.ts` → `recordJobPayment` | `job_payments` |
| Job payment when invoice exists | same helper routes to invoice writer | `invoice_payments` |
| Invoice payment APIs | `lib/finance/record-invoice-payment.ts` | `invoice_payments` |
| Edit / delete invoice payment | `lib/finance/edit-invoice-payment.ts` | updates/deletes `invoice_payments`, then reconciles summaries |
| Edit / delete direct job payment | `lib/finance/job-payments.ts` | `job_payments` |

**APIs:**

- `POST /api/jobs/[id]/payments`
- `PATCH|DELETE /api/jobs/[id]/payments/[paymentId]?source=job|invoice`
- `POST /api/invoices/[id]/payment`
- `POST /api/outbound/[id]/payment`

On a new invoice payment:

1. Update `invoices` summary (`amount_paid`, `balance_due`, `payment_status`, dates)
2. Sync linked `outbound_documents`
3. Insert `invoice_payments` ledger row (required; request fails if ledger insert fails)

Ledger corrections recalculate invoice and outbound summaries from ledger totals via `reconcileInvoiceFromLedger` and the database function `reconcile_invoice_payment_summary`.

## Migrations

- `202609110001_invoice_payments_ledger.sql` — ledger table, select/insert RLS, legacy backfill
- `202609120001_editable_invoice_payments.sql` — `updated_at`, update/delete RLS, reconcile triggers
- `202607200001_job_payments_customer_photo_reports.sql` — direct job payments + customer photo report fields

## Metric source of truth

All org dashboard and analytics KPIs use `lib/dashboard-metrics.ts`.

| Metric | Definition | Source | Date basis |
|--------|------------|--------|------------|
| Customer invoices | Non-cancelled invoice totals | `invoices.amount` | `invoice_date` / `created_at` in period |
| Paid to you | Customer cash received | `invoice_payments` + `job_payments` | `paid_at` in period |
| Still owed | Open balances | invoice balances + uninvoiced job outstanding | Current |
| Late payments | Overdue open invoice balances | invoices + due date / status | Current |
| Estimated profit | Customer invoices − contractor accrued − expenses | invoices + `job_labor` + `expenses` | Period |
| Cash after expenses | Paid to you − contractor cash paid − expenses | payment ledgers + labor `paid_at` + expenses.date | Period |

Do not count expected job amounts as cash. Do not count unpaid invoice totals as paid. Never count the same payment twice.

## Job profitability

`lib/finance-server.ts` → `computeJobProfitability` / `fetchJobProfitability`

- Expected Revenue = invoice total when invoiced, else manual job amount
- Collected = confirmed client payments
- Outstanding = max(expected − collected, 0)
- Expected Profit = expected − expenses
- Collected Profit = collected − expenses
- Payment status = Unpaid / Partially Paid / Paid / No amount set

## Receipts

Authenticated receipt pages live at `/jobs/[id]/receipts/[source]/[paymentId]` for both direct and invoice-linked payments.
