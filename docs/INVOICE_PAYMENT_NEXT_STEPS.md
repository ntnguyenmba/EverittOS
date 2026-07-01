# Invoice payment workflow next steps

The current outbound invoice flow creates and sends invoice-style documents by email. The next invoice work should be implemented as a coordinated database, API, and UI pass.

## Payment fields

Invoices should support:

- `amount`
- `amount_paid`
- `balance_due`
- `status`: draft, sent, partially_paid, paid, overdue, cancelled
- `invoice_date`
- `due_date`
- `paid_at`
- `payment_method`
- `payment_reference`
- `notes`

## UI behavior

The invoice center should show:

- Sent, unpaid, overdue, partially paid, and paid tabs or filters.
- Clear badges for unpaid, overdue, partially paid, and paid.
- A simple record payment action for owner, admin, and manager roles.
- Read-only visibility for roles that should not manage invoices.
- No SMS options because EverittOS is email-only for now.

## Email behavior

Email-only delivery should remain the default. If email is not configured, the send should fail clearly and move the item to Failed instead of showing a success message.

## Stripe payment links

Stripe payment links should be optional. The app should still support manually recording payments for businesses that collect cash, check, Zelle, Venmo, ACH, or card payments outside the app.

## Role rules

- Owner: full invoice and payment access.
- Admin: invoice and payment operations, no ownership-only billing settings.
- Manager: operational invoice actions if enabled by workspace policy.
- Worker, contractor, viewer, client: no invoice management controls unless explicitly shared in a client portal.
