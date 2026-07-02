# Dashboard metrics foundation

Richer dashboards use real EverittOS data only — no placeholder charts.

## Data sources

- jobs (status counts, completed, upcoming)
- customers (active count)
- invoices (revenue this month, outstanding, overdue count)
- expenses (month total, net estimate)
- bookings (month count)
- customer_messages (message count)
- job_reports (report count)

## Implementation

`lib/dashboard-metrics.ts` → `fetchDashboardRevenueMetrics()` aggregates live queries scoped by `organization_id`.

`components/dashboard-revenue-snapshot.tsx` displays metrics on `/dashboard`.

Missing tables or empty workspaces return zeros — honest empty states, not fake numbers.

## Build rule

Only show metrics that can be computed from real data. Do not add demo analytics.
