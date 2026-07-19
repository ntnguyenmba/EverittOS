# Mobile release checklist

## Completed in code

- [x] Capacitor iOS/Android shells (`com.everittventures.everittos`)
- [x] Unified entitlement resolver (Stripe / Apple / Google)
- [x] Apple verify + App Store Server Notifications routes
- [x] Google verify + RTDN webhook routes
- [x] StoreKit 2 native layer
- [x] Google Play Billing native layer
- [x] Platform-aware billing UI (no Stripe checkout on native)
- [x] Restore / manage / refresh actions
- [x] Account deletion entry point with store-cancel warning
- [x] Product catalog module
- [x] Entitlement unit tests
- [x] Plain-language financial dashboard metrics
- [x] Invoice payment ledger migration

## Requires App Store Connect

- [ ] App record + bundle ID confirmation
- [ ] Subscription group + Pro/Business products
- [ ] App Store Server API key + notifications URL
- [ ] Sandbox testers
- [ ] Privacy nutrition labels
- [ ] Screenshots by device size
- [ ] Review notes + test account

## Requires Play Console

- [ ] App listing + package confirmation
- [ ] Subscription products / base plans
- [ ] Data safety form
- [ ] Feature graphic + screenshots
- [ ] License testers / internal track
- [ ] Content rating / ads declaration

## Requires production secrets

- [ ] Apply `202609100001_store_billing_subscriptions.sql`
- [ ] Apply `202609110001_invoice_payments_ledger.sql`
- [ ] Apple API env vars on Vercel
- [ ] Google Play service-account JSON on Vercel
- [ ] Webhook URLs publicly reachable

## Requires legal review

- [ ] Privacy Policy / Terms / Subscription Policy copy
- [ ] Cross-platform entitlement policy (Stripe + store)

## Requires physical-device testing

- [ ] iOS safe areas, keyboard, back navigation
- [ ] Android system bars and back handlers
- [ ] Auth deep links in Capacitor shells
- [ ] Native purchase / restore / manage flows
- [ ] Dashboard and invoice payment on 320 to 430 px widths

## Build readiness levels

| Level | Meaning |
|-------|---------|
| Source-code ready | Code and docs in repo |
| Unsigned build ready | `assembleDebug` / Xcode compile without store signing |
| Signed store-upload ready | Requires owner signing credentials + console products |
