# Android Google Play Billing

## Identifiers

| Item | Value |
|------|-------|
| Application ID | `com.everittventures.everittos` |
| Pro subscription product | `everittos_pro` (override with `NEXT_PUBLIC_ANDROID_PRO_SUBSCRIPTION_ID`) |
| Business subscription product | `everittos_business` (override with `NEXT_PUBLIC_ANDROID_BUSINESS_SUBSCRIPTION_ID`) |
| Base plan | `monthly` (override with `NEXT_PUBLIC_ANDROID_MONTHLY_BASE_PLAN_ID`) |

Catalog model: **one subscription product per EverittOS plan**, each with a monthly base plan.

## Code delivered

* `android/.../billing/PlayBillingManager.java`
* `android/.../billing/EverittBillingPlugin.java`
* Play Billing Library dependency in `android/app/build.gradle`
* `POST /api/billing/google/verify`
* `POST /api/webhooks/google-play` (RTDN)

Backend acknowledges purchases after verified persistence.

Pending purchases do **not** unlock paid access.

## Manual Play Console / Google Cloud work (required)

1. Create the Play app with package `com.everittventures.everittos`
2. Create subscription products `everittos_pro` and `everittos_business` with base plan `monthly`
3. Create a Google Cloud service account with Android Publisher access
4. Set `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (JSON string, server-only)
5. Set `GOOGLE_PLAY_PACKAGE_NAME=com.everittventures.everittos`
6. Configure Real-time Developer Notifications → Pub/Sub topic
7. Push endpoint: `https://app.everittventures.com/api/webhooks/google-play?token=...`
8. Set `GOOGLE_PLAY_PUBSUB_VERIFICATION_TOKEN`
9. Add license testers / internal testing track
10. Configure release signing (do not commit keystores)

## In-app actions

* Subscribe with Google Play (localized price)
* Restore / query purchases
* Manage Google Play Subscription (Play subscription center)
* Refresh Subscription Status

## Payment portal meaning

Digital subscriptions use Google Play Billing. Stripe Customer Portal is web-only for Stripe-billed accounts. Do not embed Stripe checkout as the Android IAP flow.
