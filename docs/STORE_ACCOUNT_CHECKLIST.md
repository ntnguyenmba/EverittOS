# Store account checklist (Apple + Google)

Code and Capacitor projects are production-ready. Complete these account-side steps before App Store / Play release.

## Before you start

1. Confirm production web app is live at `https://app.everittventures.com`.
2. Apply pending Supabase migrations (see `supabase/migrations/README.md`), including `202609150001_customer_blank_pipeline_active.sql`.
3. Set production env vars on Vercel (Supabase, Stripe, Resend, Apple, Google Play).

## Apple Developer / App Store Connect

1. Create the App Store Connect app with bundle ID `com.everittventures.everittos`.
2. Create auto-renewable subscription products matching `lib/billing/product-catalog.ts`.
3. Enable Associated Domains; replace `TEAMID` in `public/.well-known/apple-app-site-association` with your Team ID.
4. Create signing certificates, provisioning profiles, and an App Store distribution profile in Xcode.
5. Configure App Store Server API keys and set `APPLE_*` env vars for `/api/webhooks/apple`.
6. Upload screenshots, privacy nutrition labels, and review notes.
7. Add sandbox testers and run the physical-device matrix in `docs/MOBILE_TEST_MATRIX.md`.

## Google Play Console

1. Create the Play app with application ID `com.everittventures.everittos`.
2. Create subscription products matching `lib/billing/product-catalog.ts`.
3. Generate the release upload keystore; enroll Play App Signing.
4. Replace `REPLACE_WITH_RELEASE_KEY_SHA256` in `public/.well-known/assetlinks.json` with the Play App Signing cert SHA-256.
5. Create a Google Play service account and set `GOOGLE_PLAY_*` env vars for `/api/webhooks/google-play`.
6. Complete Data Safety, store listing, and screenshots.
7. Add license testers and run the device matrix in `docs/MOBILE_TEST_MATRIX.md`.

## Local build commands (after accounts exist)

```bash
npm run mobile:validate-env
npm run ios:sync
npm run android:sync
```

Open `ios/App/App.xcworkspace` in Xcode and `android/` in Android Studio to archive / generate a signed AAB.
