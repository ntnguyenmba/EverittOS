# EverittOS financial architecture

## Principle

One customer payment action drives every financial metric.

```text
Customer created
→ Job completed
→ Invoice created
→ Customer pays
→ Owner taps Record payment on the invoice (once)
→ Dashboard, reports, profit, cash, Ask Everitt, and exports update from shared helpers
```

There is never a second place to enter the same customer payment.

## Canonical payment workflow

**UI:** Invoices page → invoice row → **Record payment**

Fields:

- Payment amount
- Payment date
- Payment method
- Reference number
- Notes

**APIs (both call the same helper):**

- `POST /api/outbound/[id]/payment`
- `POST /api/invoices/[id]/payment`

**Shared writer:** `lib/finance/record-invoice-payment.ts`

On save:

1. Update `invoices` summary (`amount_paid`, `balance_due`, `payment_status`, dates)
2. Sync linked `outbound_documents`
3. Insert immutable `invoice_payments` ledger row

Legacy `PATCH /api/invoices/[id]` with a higher `amount_paid` is converted into the same recorder (ledger + summaries). The job financials card no longer records payments locally; it deep-links to the invoice.

## Ledger

Table: `invoice_payments` (`supabase/migrations/202609110001_invoice_payments_ledger.sql`)

Partial payments create multiple rows. History is never overwritten.

## Metric source of truth

All org dashboard and analytics KPIs use `lib/dashboard-metrics.ts`.

| Metric | Definition | Source | Date basis |
|--------|------------|--------|------------|
| Customer invoices | Non-cancelled invoice totals | `invoices.amount` | `invoice_date` / `created_at` in period |
| Paid to you | Customer cash received | `invoice_payments.amount` (fallback: capped `amount_paid`) | `paid_at` in period |
| Still owed | Open balances | `max(amount - amount_paid, 0)` | Current |
| Late payments | Overdue open balances | same + due date / status | Current |
| Unpaid invoices | Count with balance > 0 | invoices | Current |
| Estimated profit | Customer invoices − contractor accrued − expenses | invoices + `job_labor` + `expenses` | Period |
| Cash after expenses | Paid to you − contractor cash paid − expenses | ledger + labor `paid_at` + expenses.date | Period |
| Contractor pay | Accrued labor | `job_labor.total_cost` | `created_at` in period |
| Contractor pay owed | Unpaid labor | `payment_status=unpaid` | Current |
| Contractor pay pending | Pending labor | `payment_status=pending` | Current |
| Other expenses | Expense totals | `expenses.amount` | `date` in period |
| Completed jobs | Completed job count | `jobs` | Completion / period filter |
| Upcoming jobs | Open future work | `jobs` / schedule | Current |
| Active customers | Active customer count | `customers` | Current |

All-time reconciliation:

```text
Customer invoices ≈ Paid to you + Still owed
```

(within $0.02)

## Clickable dashboard cards

Defined in `lib/dashboard-links.ts`:

| Card | Opens |
|------|-------|
| Paid to you | `/invoices?payment=history` |
| Still owed | `/invoices?payment=unpaid` |
| Late payments | `/invoices?payment=overdue` |
| Contractor pay owed | `/contractor-pay?status=unpaid` |
| Completed jobs | `/jobs?status=completed` |

## Contractor assignment metrics

Assignment counters use `lib/worker-assignment.ts` (canonical `jobs.assigned_to` = `workers.id`).

## Do not

- Record customer payments on the job card
- Sum `amount_paid` by invoice create date for “Paid to you”
- Implement page-local financial math when a shared helper exists
- Treat Stripe SaaS subscription webhooks as customer invoice payments
