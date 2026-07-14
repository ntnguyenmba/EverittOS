# Mobile Billing Compliance

> **Status: Pending owner / legal review.** Do not enable native Stripe checkout until this document is approved.

## What users purchase

EverittOS sells **SaaS subscription plans** (Pro, Business, Starter, Growth, Enterprise) that unlock digital application functionality: additional seats, features, workflows, AI usage, and operational tools within the web/mobile workspace.

## Product classification

| Question | Assessment |
|----------|------------|
| Digital functionality unlocked? | **Yes** — subscription gates in-app features |
| Business / enterprise software? | **Primarily yes** — B2B field operations platform |
| Accounts purchased outside app? | **Yes** — Stripe Checkout on web at `app.everittventures.com` |
| Consume existing subscription in mobile? | **Yes** — sign-in respects plan/RLS |
| Mobile shows upgrade prices? | **No (Phase 27)** — hidden on native via billing adapter |
| Mobile initiates Stripe Checkout? | **No (Phase 27)** — blocked on native |
| Apple IAP required? | **Possibly** — if App Store treats SaaS as digital consumable in consumer context; **requires legal review** |
| Google Play Billing required? | **Possibly** — same caveat for digital subscriptions |

## Release decision (interim)

Until legal approves a model:

1. **Web** — full Stripe Checkout and Customer Portal unchanged
2. **Native iOS/Android** — `resolveBillingVisibility()` disables checkout and portal actions
3. Native users see neutral plan summary + notice to manage billing on the web
4. Paid users with active Stripe subscriptions can sign in and use authorized features

Opening Stripe Checkout in an external browser from the native app **does not** automatically satisfy store policies and is **not** implemented as a workaround.

## Exceptions to evaluate with counsel

- Multi-platform SaaS with account created on web (Reader/App Store guidelines evolution)
- Enterprise / B2B contracts sold outside consumer app stores
- Login-only consumption of externally purchased access

## If native IAP / Play Billing is required

Do **not** partially implement. A complete plan must include:

- Product identifiers per plan
- Receipt / purchase token server verification
- Subscription state sync with existing Stripe records
- Duplicate subscription prevention and account merge policy
- Restoration, cancellation, grace periods, refunds
- Idempotent webhook/event processing

## Implementation (Phase 27)

| Component | Behavior |
|-----------|----------|
| `lib/platform/billing.ts` | Platform-aware visibility rules |
| `components/billing-plans-grid.tsx` | Hides prices/checkout on native |
| `components/plan-checkout-button.tsx` | Blocks checkout on native |
| `app/settings/billing/page.tsx` | Hides portal; shows web notice |

## Owner action items

- [ ] Confirm B2B / enterprise classification with legal counsel
- [ ] Decide whether to pursue external-purchase exception documentation
- [ ] If IAP required, approve full implementation budget before enabling native purchases
- [ ] Update App Store / Play billing declarations accordingly
