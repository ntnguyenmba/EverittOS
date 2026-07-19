# Store review notes

Do **not** put production admin passwords in the repository. Provide sandbox credentials in App Store Connect / Play Console review notes only.

## Demo account (owner fills in)

* Email: _(sandbox reviewer account)_
* Password: _(provided securely in console notes)_
* Organization: auto-created or pre-seeded workspace

## How reviewers reach paid features

1. Sign in
2. Open **Settings → Plans & billing**
3. Choose **Pro** or **Business**
4. Complete sandbox purchase (StoreKit / Play test card)
5. Wait for “Subscription activated” after server verification

## Required review paths

| Path | Location |
|------|----------|
| Subscribe | Settings → Plans & billing |
| Restore Purchases | Settings → Plans & billing |
| Manage subscription | Settings → Plans & billing |
| Account deletion | Settings → Account → Delete Account |
| Privacy | `/privacy` |
| Terms | `/terms` |
| Support | Settings → Support / `support@everittventures.com` |

## Notes for Apple

* First auto-renewable subscription must ship with a new app version
* Account deletion warns that App Store subscriptions are cancelled separately in Apple Settings
* No Stripe checkout inside the iOS app

## Notes for Google

* Use license tester account on an internal testing build
* Pending purchases must not unlock features
* No unrestricted Stripe WebView as the Play purchase flow
