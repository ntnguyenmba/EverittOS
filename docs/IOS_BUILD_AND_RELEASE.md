# iOS Build and Release

## Requirements

- macOS with **Xcode 16+** (compatible with Capacitor 8)
- **CocoaPods not required** — Capacitor 8 iOS uses Swift Package Manager for plugins
- Apple Developer Program membership (paid)
- Bundle ID: `com.everittventures.everittos`

## Initial setup

From the repository root:

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
npm run ios:open
```

In Xcode:

1. Select the **App** target
2. Set your **Team** under Signing & Capabilities
3. Confirm bundle identifier `com.everittventures.everittos`
4. Enable **Associated Domains** capability (should match `App.entitlements`):
   - `applinks:app.everittventures.com`
   - `webcredentials:app.everittventures.com`

## Simulator

1. Choose an iPhone or iPad simulator
2. Product → Run (⌘R)
3. App loads production HTTPS unless `CAPACITOR_DEV=true` with a local URL

## Physical device

1. Connect device via USB
2. Select device as run destination
3. Trust developer certificate on device (Settings → General → VPN & Device Management)
4. Run from Xcode

## Archive for App Store

1. Set build configuration to **Release**
2. Increment **Build** (`CURRENT_PROJECT_VERSION`) — never reuse a published build number
3. Product → Archive
4. Validate archive in Organizer
5. Distribute to App Store Connect

## TestFlight

1. Upload archive to App Store Connect
2. Add internal testers (App Store Connect users)
3. For external testers, submit build for Beta App Review
4. Share TestFlight link

## App Store submission

See `docs/APP_STORE_SUBMISSION.md` for metadata, privacy answers, and reviewer instructions.

## Universal links verification

1. Replace `TEAMID` in `public/.well-known/apple-app-site-association` with your Apple Team ID
2. Deploy to production (no redirect on the AASA path)
3. Verify content type `application/json`
4. Test on device:

```bash
curl -I https://app.everittventures.com/.well-known/apple-app-site-association
```

## Permission strings

Configured in `ios/App/App/Info.plist`:

- Camera — job before/after photos
- Photo library — attach existing job photos

## Known limitations in CI

Linux cloud agents cannot run Xcode builds. Native iOS compilation is **unverified** in automated environments.

## Versioning

| Field | Location |
|-------|----------|
| Marketing version | `MARKETING_VERSION` in Xcode (matches `package.json` semver) |
| Build number | `CURRENT_PROJECT_VERSION` — increment every upload |
