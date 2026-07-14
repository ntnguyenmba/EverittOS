# Final Mobile Release Audit

Selected model: **EverittOS native apps are existing-account access applications.** Subscriptions are purchased and managed on the web only.

| Item | Status |
|------|--------|
| Capacitor 8 iOS/Android projects | Complete |
| Bundle / application ID `com.everittventures.everittos` | Complete |
| Production HTTPS server URL | Complete |
| Native billing visibility helper | Complete |
| Native billing route (neutral account access) | Fixed |
| Native no Stripe checkout/portal | Fixed |
| Native no prices / upgrade CTAs | Fixed |
| Native no website purchase direction | Fixed |
| Settings nav hides Billing on native | Fixed |
| Ask Everitt AI controls only when AI enabled | Fixed |
| Ask Everitt no native upsell / View plans | Fixed |
| PWA keeps web billing | Complete |
| Camera permission strings | Complete |
| Deep links / app scheme | Complete / External setup required for verification |
| Account deletion entry | Complete |
| Privacy / Terms public routes | Complete |
| Physical iOS testing | Physical device test required |
| Physical Android testing | Physical device test required |
| Xcode / Gradle release signing | External setup required / Blocked by credentials |
| App Store / Play Console metadata | External setup required |

Reviewer note (docs): native apps contain no subscription purchase flow and no external purchase links. AI appears only when included in the signed-in account.
