# Final Finance Validation

Manual scenarios. Mark results after owner applies migration and tests against known invoices.

## Prerequisite

Run SQL in `docs/SUPABASE_SQL_TO_RUN.md`.

## Test 1 — Paid last month work this month cash

- Invoice date: last month
- Paid date: this month
- Amount `$500`, amount paid `$500`

| Metric | Expected | Result |
|--------|----------|--------|
| Booked revenue (last month) | $500 | Pending manual |
| Cash collected (this month) | $500 | Pending manual |
| Pending incoming | $0 | Pending manual |

## Test 2 — Partial payment

- Invoice date: this month
- Amount `$1000`, amount paid `$300`, payment date this month

| Metric | Expected | Result |
|--------|----------|--------|
| Booked revenue | $1000 | Pending manual |
| Cash collected | $300 | Pending manual |
| Pending incoming | $700 | Pending manual |

## Test 3 — Overdue unpaid

- Invoice date: this month, amount `$400`, unpaid, past due

| Metric | Expected | Result |
|--------|----------|--------|
| Cash collected | $0 | Pending manual |
| Booked revenue | $400 | Pending manual |
| Pending incoming | $400 | Pending manual |
| Overdue amount | $400 | Pending manual |

## Test 4 — Uninvoiced completed job

- Completed job revenue `$250`, no invoice

| Metric | Expected | Result |
|--------|----------|--------|
| Booked revenue | includes `$250` | Pending manual |
| Cash collected | excludes `$250` | Pending manual |

## Test 5 — Cancelled invoice

- Cancelled invoice `$900`

| Metric | Expected | Result |
|--------|----------|--------|
| Pending incoming | excluded | Pending manual |
| Booked / cash | excluded | Pending manual |

## Automated coverage

Unit tests in `tests/finance-mobile-release.test.ts` cover payment status rules, local date bounds, and cash/accounting helper invariants.
