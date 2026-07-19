# Mobile release checklist

## Completed in code (source readiness)

- [x] Capacitor iOS/Android shells
- [x] Unified entitlement resolver
- [x] Apple verify + ASN webhook routes
- [x] Google verify + RTDN webhook routes
- [x] StoreKit 2 native layer
- [x] Google Play Billing native layer
- [x] Platform-aware billing UI (no Stripe checkout on native)
- [x] Restore / manage / refresh actions
- [x] Account deletion entry point with store-cancel warning
- [x] Product catalog module
- [x] Entitlement unit tests

## Still required (manual / credentials)

### Apple Developer / App Store Connect

- [ ] App record + bundle ID
- [ ] Subscription group + products
- [ ] App Store Server API key + notifications URL
- [ ] Sandbox testers
- [ ] Xcode signing / provisioning
- [ ] Privacy nutrition labels (`docs/apple-app-privacy.md`)

### Google Play / Cloud

- [ ] Play app + subscription products/base plans
- [ ] Service account JSON in server secrets
- [ ] RTDN Pub/Sub
- [ ] Release keystore (not in git)
- [ ] Data safety form (`docs/google-play-data-safety.md`)

### Supabase / Vercel

- [ ] Apply `202609100001_store_billing_subscriptions.sql`
- [ ] Set Apple/Google env vars on Vercel
- [ ] Confirm webhook URLs publicly reachable

## Build readiness levels

| Level | Meaning |
|-------|---------|
| Source-code ready | Code and docs in repo |
| Unsigned build ready | `assembleDebug` / Xcode compile without store signing |
| Signed store-upload ready | Requires owner signing credentials + console products |
