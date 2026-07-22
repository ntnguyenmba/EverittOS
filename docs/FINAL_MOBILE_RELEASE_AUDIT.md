# Final Mobile Release Audit

Selected model: **Native apps sell and manage subscriptions through Apple App Store and Google Play.** Web continues to use Stripe Checkout and Customer Portal.

| Item | Status |
|------|--------|
| Capacitor 8 iOS/Android projects | Complete |
| Bundle / application ID `com.everittventures.everittos` | Complete |
| Production HTTPS server URL | Complete |
| StoreKit 2 billing (iOS) | Complete |
| Google Play Billing Library (Android) | Complete |
| Android `com.android.vending.BILLING` permission | Complete |
| iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) | Complete |
| iOS export compliance (`ITSAppUsesNonExemptEncryption=false`) | Complete |
| Native no Stripe checkout/portal | Complete |
| Web Stripe checkout/portal | Complete |
| Camera permission strings | Complete |
| Deep links / app scheme | Complete / External verification required |
| Universal links / App Links files | Prepared (Team ID + SHA-256 account fill-in) |
| Account deletion entry | Complete |
| Privacy / Terms public routes | Complete |
| Physical iOS testing | Requires Apple Developer device |
| Physical Android testing | Requires Play Console / device |
| Xcode / Gradle release signing | Requires Apple / Google credentials |
| App Store / Play Console metadata | Requires Apple / Google credentials |

See `docs/STORE_ACCOUNT_CHECKLIST.md` and `docs/MOBILE_BILLING_COMPLIANCE.md` for the remaining account-only work.
