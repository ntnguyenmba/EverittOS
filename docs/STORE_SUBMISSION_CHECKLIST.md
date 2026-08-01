# EverittOS Store Submission Checklist

Use this before every Apple App Store or Google Play submission.

## Already implemented in code

- Apple In-App Purchases and Google Play Billing are separated from Stripe web billing.
- Native purchase verification exists for Apple signed transactions and Google purchase tokens.
- Restore Purchases and Manage Subscription actions are available in the native billing screen.
- Public Privacy Policy, Terms of Service, Cookie Policy, Security, Account Deletion, About, Support, and Third-Party Notices pages exist.
- Account deletion is available in Settings and through a public support path.
- iOS camera and photo-library usage descriptions are present in `ios/App/App/Info.plist`.
- Android camera, image access, internet, and billing permissions are present in `android/app/src/main/AndroidManifest.xml`.
- Cleartext traffic is disabled on Android.
- Non-exempt encryption is declared false on iOS.
- HTTPS and `everittos://` deep links are configured.

## Before building

- [ ] Confirm `main` is current and contains the intended release.
- [ ] Update the marketing version and build number in Xcode.
- [ ] Update `versionCode` and `versionName` for Android.
- [ ] Confirm Apple and Google product IDs match the IDs configured in the stores.
- [ ] Confirm Apple server credentials and Google Play service-account credentials are set in production.
- [ ] Confirm store notification endpoints and secrets are set in production.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run mobile:validate-release`.
- [ ] Run `npm run ios:sync` or `npm run android:sync` for the target platform.

## Test on a physical iPhone

- [ ] Create an account and sign in.
- [ ] Take a job photo with the camera.
- [ ] Select a job photo from the photo library.
- [ ] Buy each subscription tier with a sandbox account.
- [ ] Confirm access changes immediately after purchase.
- [ ] Cancel a purchase and confirm the app does not unlock access.
- [ ] Test a pending purchase state.
- [ ] Delete and reinstall the app, then use Restore Purchases.
- [ ] Open Manage Subscription and confirm Apple subscription management opens.
- [ ] Confirm the Privacy Policy, Terms, Account Deletion, Support, and About pages open.
- [ ] Confirm account deletion works inside the app.
- [ ] Test owner, manager, contractor, and customer navigation.
- [ ] Test portrait and landscape layouts on iPhone and iPad.

## Test on a physical Android device

- [ ] Create an account and sign in.
- [ ] Take a job photo with the camera.
- [ ] Select a job photo from device storage.
- [ ] Buy each subscription tier with a Google license tester account.
- [ ] Confirm access changes immediately after purchase.
- [ ] Cancel a purchase and confirm the app does not unlock access.
- [ ] Test a pending cash or delayed payment state where available.
- [ ] Delete and reinstall the app, then restore or refresh the subscription.
- [ ] Open Manage Subscription and confirm Google Play subscription management opens.
- [ ] Confirm the Privacy Policy, Terms, Account Deletion, Support, and About pages open.
- [ ] Confirm account deletion works inside the app.
- [ ] Test owner, manager, contractor, and customer navigation.
- [ ] Test phone and tablet layouts.

## Store listing checks

- [ ] Apple Privacy Nutrition Labels match the production app and Privacy Policy.
- [ ] Google Data Safety answers match the production app and Privacy Policy.
- [ ] Support URL opens without authentication.
- [ ] Privacy Policy URL opens without authentication.
- [ ] Account Deletion URL opens without authentication.
- [ ] Screenshots show the current interface and do not include test data that looks real.
- [ ] Subscription descriptions state the billing period, price, auto-renewal, and cancellation method.
- [ ] App Review notes include a working reviewer account for each role needed for testing.
- [ ] App Review notes explain where Restore Purchases and Account Deletion are located.

## Final release check

- [ ] Test the exact archive or bundle that will be uploaded.
- [ ] Confirm no development API URL, test Stripe key, sandbox-only product ID, or localhost reference is included.
- [ ] Confirm the production Supabase, storage, email, and billing services are reachable.
- [ ] Confirm the app remains usable after losing and restoring network access.
- [ ] Confirm subscription status refreshes after app resume.
- [ ] Save the submitted build number, commit SHA, and store product IDs with the release notes.
