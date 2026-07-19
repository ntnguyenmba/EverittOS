# Subscription entitlements

EverittOS unifies Stripe (web), Apple App Store, and Google Play subscriptions into one server-side entitlement model.

## Source of truth

The client never grants paid access from:

* `purchase.success === true`
* product ID / plan / price / expiration supplied by the client
* locally cached premium flags

Authoritative flow:

1. Native or web purchase completes at the store / Stripe
2. Signed transaction or purchase token is sent to EverittOS
3. Backend verifies with Apple, Google, or Stripe
4. `billing_subscriptions` (and/or `everittos_subscriptions`) is upserted
5. `resolveOrganizationEntitlement()` recomputes access
6. App refreshes account state

## Tables

| Table | Purpose |
|-------|---------|
| `billing_subscriptions` | Normalized Apple / Google / optional Stripe / manual rows |
| `billing_events` | Idempotent webhook / verify event log |
| `account_entitlements` | Cached effective plan per organization |
| `everittos_subscriptions` | Existing Stripe subscription mirror (still used) |

Apply migration:

`supabase/migrations/202609100001_store_billing_subscriptions.sql`

## Resolution rules

1. Ignore revoked, refunded, expired, invalid rows
2. Keep active, trialing, grace_period access
3. Cancelled but unexpired retains access until `expires_at`
4. When multiple valid entitlements exist, choose the **highest** plan
5. Fall back to Free

## Endpoints

| Method | Path | Role |
|--------|------|------|
| POST | `/api/billing/apple/verify` | Authenticated owner/admin |
| POST | `/api/webhooks/apple` | App Store Server Notifications v2 |
| POST | `/api/billing/google/verify` | Authenticated owner/admin |
| POST | `/api/webhooks/google-play` | Google Play RTDN (Pub/Sub) |
| GET | `/api/billing/entitlement` | Authenticated user |

Stripe Checkout / portal / webhook routes remain unchanged for web.
