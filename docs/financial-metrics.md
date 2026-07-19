# Financial metrics

Plain-language definitions used by the EverittOS dashboard and related summaries.

## Labels

| Label | Meaning | Time basis |
|-------|---------|------------|
| Paid to you | Customer payments actually received | Selected period |
| Customer invoices | Non-cancelled invoice totals created | Selected period |
| Still owed | Unpaid customer balances | Current (all open invoices) |
| Late payments | Unpaid balances past due date | Current |
| Unpaid invoices | Count of invoices with remaining balance | Current |
| Estimated profit | Customer invoices minus contractor pay and other recorded expenses | Selected period |
| Cash after expenses | Paid to you minus contractor cash paid and other expenses | Selected period |
| Contractor pay | Contractor labor recorded for the period | Selected period |
| Other expenses | Expenses dated in the period | Selected period |
| Uninvoiced completed work | Manual job revenue without an invoice | Selected period |

## Formulas

### Customer invoices

```text
sum(invoice.amount)
for non-cancelled invoices
where invoice_date (or created_at) is in the selected period
```

Manual job revenue is **not** included. It appears separately as Uninvoiced completed work.

### Paid to you

Preferred source: `invoice_payments` rows whose `paid_at` is in the selected period.

Fallback when no ledger rows exist for an invoice:

1. Use capped `amount_paid`
2. Use `paid_at` or `last_payment_at`
3. If paid amount exists but both dates are missing:
   - Include in All time
   - For a bounded period, include only when the invoice was created in that period
4. Surface `paymentsMissingDates` as a diagnostic when this happens

### Still owed

```text
sum(max(amount - min(amount_paid, amount), 0))
for all non-cancelled invoices
```

### Estimated profit

```text
Customer invoices
- contractor pay recorded in the period
- other expenses dated in the period
```

Tooltip: Customer invoices minus contractor pay and other recorded expenses for this period.

### Cash after expenses

```text
Paid to you
- contractor payments with payment_status=paid and paid_at in period
- other expenses dated in the period
```

Tooltip: Customer payments received minus contractor payments and other recorded expenses paid during this period.

Expenses table has `amount` + `date` only, so `date` is treated as the cash date.

### Estimated profit percentage

```text
Estimated profit / Customer invoices * 100
```

Shown only when Customer invoices > 0. If costs are missing, show: Only recorded costs are included.

## Reconciliation

Do **not** expect:

```text
Customer invoices this month = Paid to you this month + Still owed current
```

Those bases differ on purpose.

For All time, non-cancelled invoices should satisfy:

```text
Customer invoices ≈ Paid to you + Still owed
```

within rounding tolerance ($0.02).

## Cancelled invoices

Cancelled invoices are excluded from Customer invoices, Still owed, Late payments, Unpaid invoices, and Estimated profit. Payment history rows are preserved for audit.

## Partial payments

Each payment creates an `invoice_payments` row. Invoice summary fields (`amount_paid`, `balance_due`, `payment_status`, `last_payment_at`, `paid_at`) stay updated for display.

## Source tables

| Metric | Tables |
|--------|--------|
| Customer invoices / Still owed | `invoices` |
| Paid to you | `invoice_payments` (fallback: invoice payment fields) |
| Contractor pay | `job_labor` |
| Other expenses | `expenses` |
| Uninvoiced completed work | `jobs.revenue_amount` without matching invoice |
