# Android Build and Release

## Requirements

- **Android Studio Ladybug / 2024.2+** recommended
- **JDK 17**
- Android SDK with API **36** (compile/target)
- Minimum SDK **24** (Capacitor 8 default)
- Application ID: `com.everittventures.everittos`

## Initial setup

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run mobile:sync
```

## Open the project

```bash
npm run android:open
```

Allow Gradle sync to complete.

## Emulator

1. Create an AVD (phone or tablet)
2. Run ▶ from Android Studio
3. App loads `https://app.everittventures.com` via Capacitor server config

## Physical device

1. Enable USB debugging
2. Connect device
3. Run debug build from Android Studio

## Signing key (release)

Create locally — **never commit passwords or keystore files**:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore everittos-upload.keystore -alias everittos -keyalg RSA -keysize 2048 -validity 10000
```

Store keystore outside Git. Configure `android/app/build.gradle` signing configs locally (not committed).

## Release AAB

```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

Enroll in **Play App Signing** when creating the Play Console app.

## App links verification

1. Obtain release SHA-256 certificate fingerprint:

```bash
keytool -list -v -keystore everittos-upload.keystore -alias everittos
```

2. Replace `REPLACE_WITH_RELEASE_KEY_SHA256` in `public/.well-known/assetlinks.json`
3. Deploy to production
4. Verify:

```bash
curl https://app.everittventures.com/.well-known/assetlinks.json
```

Debug builds use a different fingerprint — document both in Play Console → App links.

## Permissions

Declared: `INTERNET` only. Camera/photos use Android photo picker via Capacitor without broad storage permissions.

## Play Store tracks

1. **Internal testing** — upload AAB, add testers by email
2. **Closed testing** — broader QA
3. **Production** — after policy review

See `docs/APP_STORE_SUBMISSION.md` for listing requirements.

## Known limitations in CI

This environment does not include Android SDK. Debug/release AAB builds are **unverified** here.

## Versioning

| Field | Location |
|-------|----------|
| `versionName` | `android/app/build.gradle` (semver) |
| `versionCode` | Integer — increment every Play upload |
