# Mobile Billing Compliance

## Selected release model

**EverittOS for iOS and Android is an account-access application for existing customers.**

Native apps do **not** offer:

* subscription purchases
* pricing
* upgrade buttons
* external purchase links
* website purchase instructions
* Stripe Checkout
* Stripe Customer Portal
* coupons or promo purchase UI

Existing customers sign in and use the features already included in their account. Subscription purchase and management remain on the web application only.

This document does **not** claim Apple or Google approval or a formal legal exception. Owner/legal review remains required before store submission.

## Platform helper

| Surface | Checkout | Portal | Prices | Upgrade actions | Plan summary |
|---------|----------|--------|--------|-----------------|--------------|
| Web / PWA | Yes | Yes | Yes | Yes | Yes |
| Native iOS/Android | No | No | No | No | Yes (neutral) |

## Ask Everitt

* AI-enabled native accounts: Ask Everitt works; no billing controls.
* Non-AI native accounts: AI controls/suggestions/upsells hidden; message if needed: “This feature is unavailable for this account.”
* Web non-AI accounts: existing upgrade messaging retained.

## Owner action items

- [ ] Legal review of existing-account mobile access model
- [ ] App Store / Play billing declarations aligned with this model
- [ ] Reviewer notes prepared (no purchase flow in native apps)
