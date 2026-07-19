# iOS App Store subscriptions

## Identifiers

| Item | Value |
|------|-------|
| Bundle ID | `com.everittventures.everittos` |
| Pro monthly product | `com.everittventures.everittos.pro.monthly` (override with `NEXT_PUBLIC_IOS_PRO_MONTHLY_PRODUCT_ID`) |
| Business monthly product | `com.everittventures.everittos.business.monthly` (override with `NEXT_PUBLIC_IOS_BUSINESS_MONTHLY_PRODUCT_ID`) |

## Code delivered

* `ios/App/App/Billing/StoreKitBillingManager.swift` — StoreKit 2 purchase / restore / manage
* `ios/App/App/Billing/EverittBillingPlugin.swift` — Capacitor plugin
* `POST /api/billing/apple/verify` — server verification
* `POST /api/webhooks/apple` — App Store Server Notifications v2

Paid features unlock only after backend verification.

## Manual App Store Connect work (required)

These steps cannot be completed from this repository without owner credentials:

1. Create the app record with bundle ID `com.everittventures.everittos`
2. Create a subscription group (e.g. `EverittOS Plans`)
3. Create auto-renewable products for Pro and Business (monthly)
4. Set pricing, availability, localization
5. Create App Store Server API key → set `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_IN_APP_PURCHASE_PRIVATE_KEY`
6. Set `APPLE_BUNDLE_ID`, `APPLE_APP_ID`, `APPLE_ENVIRONMENT` (`Sandbox` or `Production`)
7. Configure App Store Server Notifications V2 URL: `https://app.everittventures.com/api/webhooks/apple`
8. Create sandbox testers
9. Submit the first subscription group with a new app version
10. Provide review screenshots and notes (see `docs/store-review-notes.md`)

## In-app actions

* Subscribe with Apple (localized StoreKit price)
* Restore Purchases
* Manage Apple Subscription (`AppStore.showManageSubscriptions`)
* Refresh Subscription Status
* Delete Account under Settings → Account (does not cancel Apple subscription)

## No RevenueCat

Direct StoreKit 2 + App Store Server API only.
