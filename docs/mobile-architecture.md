# Mobile architecture

EverittOS ships as:

* **Web / PWA** — Next.js on Vercel (`https://app.everittventures.com`)
* **iOS / Android** — Capacitor 8 shells loading the production HTTPS app

## Capacitor

| Setting | Value |
|---------|-------|
| `appId` | `com.everittventures.everittos` |
| `webDir` | `mobile-shell` |
| Server URL | `CAPACITOR_SERVER_URL` or production host |

Shared backend: Supabase auth, organizations, plan entitlements, API routes.

## Billing by platform

| Platform | Purchase | Manage |
|----------|----------|--------|
| Web | Stripe Checkout | Stripe Customer Portal |
| iOS | StoreKit 2 | Apple subscription management |
| Android | Google Play Billing | Google Play Subscription Center |

Cross-platform: one EverittOS account entitlement after server verification. Users should not need to buy again on every platform, subject to store rules.

## Native bridge

Capacitor plugin `EverittBilling`:

* TypeScript: `lib/plugins/everitt-billing.ts`
* iOS StoreKit 2 implementation under `ios/App/App/Billing/`
* Android Play Billing under `android/app/src/main/java/.../billing/`

## Deep links

Scheme: `everittos://`  
Auth callback path: `/auth/callback` (also listed in `lib/mobile-app-config.ts`)

## Shared web features in native shells

Direct job payments, customer photo reports, and localized finance UI ship in the shared Next.js app. iOS and Android Capacitor builds pick them up automatically on the next shell sync against production. No separate Swift or Kotlin payment or report modules are required.

## Native permissions

| Platform | Permissions |
|----------|-------------|
| iOS | Camera + photo library usage strings in `ios/App/App/Info.plist` |
| Android | `INTERNET`, `CAMERA`, `READ_MEDIA_IMAGES`, legacy `READ_EXTERNAL_STORAGE` (maxSdk 32) in `AndroidManifest.xml` |

Associated domains / asset links still require the real Apple Team ID and release key SHA-256 before production universal links verify.
