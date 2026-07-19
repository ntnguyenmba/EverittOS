# Mobile Billing Compliance

## Selected release model

**Native iOS and Android apps use platform store billing for digital subscriptions.**

| Platform | Purchase | Manage |
|----------|----------|--------|
| Web / PWA | Stripe Checkout | Stripe Customer Portal |
| iOS | StoreKit 2 | Apple subscription management |
| Android | Google Play Billing | Google Play Subscription Center |

Rules:

* Do **not** show Stripe Checkout inside the iOS or Android app for digital subscriptions
* Do **not** unlock paid features from client-only purchase callbacks
* Backend verifies every Apple/Google transaction before granting entitlement
* Existing Stripe web subscriptions continue to work on web and unlock the same account after sign-in

## Platform helper

| Surface | Stripe checkout | Stripe portal | Store purchase | Prices | Upgrade actions |
|---------|-----------------|---------------|----------------|--------|-----------------|
| Web / PWA | Yes | Yes | No | Yes (list) | Yes |
| Native iOS | No | No | Yes (StoreKit) | Store-localized | Yes |
| Native Android | No | No | Yes (Play Billing) | Store-localized | Yes |

## Ask Everitt

* Native AI upsells remain suppressed (`shouldShowAiUpsell` is web-only)
* Users manage plans from Settings → Plans & billing

## Owner action items

- [ ] Create App Store / Play subscription products
- [ ] Configure Apple + Google server credentials
- [ ] Apply store billing migration
- [ ] Legal review of store + Stripe cross-platform entitlements
- [ ] Reviewer notes with sandbox accounts
