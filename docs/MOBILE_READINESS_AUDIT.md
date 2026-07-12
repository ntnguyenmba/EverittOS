# Mobile Readiness Audit — Phase 27

Audit date: 2026-07-12  
Repository: EverittOS (Next.js 15 + Supabase + Stripe)

## Current web readiness

| Item | Status | Notes |
|------|--------|-------|
| Responsive CSS breakpoints | **Completed** | `globals.css`, `dashboard-mobile-balance.css`, `job-mobile-fixes.css`, `everitt-luxury-refresh.css`, and related polish sheets |
| Viewport meta / `viewportFit` | **Completed** | `app/layout.tsx` |
| Touch target sizing (`--touch-min: 44px`) | **Completed** | `globals.css` |
| Mobile navigation drawer | **Completed** | `components/mobile-nav.tsx` |
| Mobile bottom nav component | **Present, unused** | `components/mobile-bottom-nav.tsx` exists but is not mounted |
| Table overflow handling | **Partial** | Phase 27 adds `.table-responsive` safety rules |
| Keyboard / input zoom fixes | **Partial** | Phase 27 adds 16px minimum input font-size on small screens |

## PWA readiness

| Item | Status | Notes |
|------|--------|-------|
| Web manifest | **Completed (pre-existing, enhanced)** | `public/manifest.webmanifest` |
| Service worker | **Completed (Phase 27)** | `public/sw.js` with safe cache exclusions |
| Offline fallback page | **Completed (Phase 27)** | `public/offline.html` |
| Install metadata in layout | **Completed** | `manifest`, `appleWebApp`, theme color |
| Maskable icon | **Completed (placeholder)** | `public/icon-maskable.png` — replace with approved artwork |
| App icons (512/180) | **Completed (placeholder)** | Generated via `npm run mobile:icons` |
| SW update prompt | **Completed (Phase 27)** | `components/pwa-update-prompt.tsx` |

## iOS readiness

| Item | Status | Notes |
|------|--------|-------|
| Capacitor iOS project | **Completed (Phase 27)** | `ios/` via Capacitor 8 |
| Bundle identifier | **Completed** | `com.everittventures.everittos` |
| Camera / photo purpose strings | **Completed** | `ios/App/App/Info.plist` |
| Custom URL scheme | **Completed** | `everittos://` |
| Associated domains entitlements | **Prepared** | `ios/App/App/App.entitlements` — requires Apple Team ID + capability in Developer portal |
| Universal links file | **Prepared** | `public/.well-known/apple-app-site-association` with `TEAMID` placeholder |
| Release signing | **External** | Requires Apple Developer account |
| Physical device testing | **Not performed** | Linux CI environment has no Xcode |

## Android readiness

| Item | Status | Notes |
|------|--------|-------|
| Capacitor Android project | **Completed (Phase 27)** | `android/` via Capacitor 8 |
| Application ID | **Completed** | `com.everittventures.everittos` |
| Target SDK 36 | **Completed** | `android/variables.gradle` |
| App links intent filters | **Completed** | HTTPS + `everittos://` in `AndroidManifest.xml` |
| `assetlinks.json` | **Prepared** | Placeholder SHA-256 fingerprint |
| Network security (no cleartext prod) | **Completed** | `network_security_config.xml` |
| Minimal permissions | **Completed** | `INTERNET` only; camera via Capacitor runtime prompts |
| Release AAB signing | **External** | Requires Play Console + upload key |
| Emulator / device testing | **Not performed** | No Android SDK in this environment |

## Authentication compatibility

| Item | Status | Notes |
|------|--------|-------|
| Supabase SSR httpOnly cookies | **Completed** | Primary session transport |
| Email/password auth | **Completed** | No third-party social login |
| Sign in with Apple | **Not required** | Email/password only; do not add speculatively |
| Deep-link auth return paths | **Completed** | `/auth/callback`, `/confirm-email`, `/reset-password`, `/team/accept` |
| Session refresh on native resume | **Completed (Phase 27)** | `NativeAppProvider` |
| Service-role key in native bundle | **Not present** | Server-only |
| Credentials in Capacitor Preferences | **Not used** | Supabase cookie/session model preserved |

## Upload and camera compatibility

| Item | Status | Notes |
|------|--------|-------|
| Web file input + compression | **Completed** | `job-photos-section.tsx` |
| CSP camera permission | **Fixed (Phase 27)** | `camera=(self)` in `next.config.mjs` |
| Native camera / library adapter | **Completed (Phase 27)** | `lib/platform/upload.ts` |
| Server-side upload validation | **Completed** | `lib/upload-security.ts` |
| Location access | **Not implemented** | Job addresses are stored data, not device GPS |

## Deep-link compatibility

| Item | Status | Notes |
|------|--------|-------|
| Custom scheme `everittos://` | **Completed** | iOS + Android intent filters |
| HTTPS universal/app links | **Prepared** | Domain verification requires production certs |
| In-app deep-link parser | **Completed** | `lib/platform/deep-links.ts` |
| Open redirect protection | **Completed** | Path allow-list + `safeNextPath` |

## Notification compatibility

| Item | Status | Notes |
|------|--------|-------|
| In-app database notifications | **Completed** | Existing feature |
| Push notifications | **Not implemented** | No Firebase/APNs credentials; documented as external task |
| Permission at launch | **N/A** | Push not requested |

## Billing compliance concerns

| Item | Status | Notes |
|------|--------|-------|
| Stripe Checkout on web | **Completed** | Unchanged |
| Stripe Checkout in native app | **Blocked (Phase 27)** | Platform billing adapter hides purchase initiation |
| Store policy assessment | **Documented** | `docs/MOBILE_BILLING_COMPLIANCE.md` |
| Existing paid users on mobile | **Supported** | Sign-in + plan enforcement unchanged |

## Privacy requirements

| Item | Status | Notes |
|------|--------|-------|
| Privacy policy route | **Completed** | `/privacy` |
| Terms of service | **Completed** | `/terms` |
| Account deletion path | **Completed** | `/settings` Danger Zone + API routes |
| Data inventory | **Completed (Phase 27)** | `docs/PRIVACY_DATA_INVENTORY.md` |
| AI third-party disclosure | **Documented** | Ask Everitt uses configured server-side AI provider |

## Store metadata requirements

| Item | Status | Notes |
|------|--------|-------|
| App Store submission checklist | **Completed (Phase 27)** | `docs/APP_STORE_SUBMISSION.md` |
| Play Store submission checklist | **Completed (Phase 27)** | Same document |
| Reviewer demo account guide | **Completed (Phase 27)** | Placeholders only — no credentials in repo |
| Screenshots / feature graphic | **External** | Requires design assets |

## Confirmed missing items (external)

1. Apple Developer Program membership, App ID, provisioning, App Store Connect app record
2. Google Play Console account, upload key, Play App Signing enrollment
3. Replace `TEAMID` in `apple-app-site-association` with real Apple Team ID
4. Replace `REPLACE_WITH_RELEASE_KEY_SHA256` in `assetlinks.json` with release cert fingerprint
5. Production-quality app icons and splash screens from approved brand artwork
6. Push notification infrastructure (optional — not required for core workflows)
7. Physical-device QA on iPhone, iPad, and Android hardware
8. Legal review of mobile billing release decision

## Completed items (Phase 27)

- Capacitor 8 configuration (`capacitor.config.ts`)
- Platform adapter layer (`lib/platform/`)
- Native lifecycle provider (`components/native-app-provider.tsx`)
- PWA service worker with sensitive-route exclusions
- Network offline banner
- Android back-button handler registry
- External link handling via system browser on native
- Mobile safe-area CSS (native/PWA only)
- iOS and Android native project scaffolding
- Mobile build scripts and env validation
- Automated platform/PWA tests
- Full mobile documentation set

## External tasks requiring developer accounts

See `docs/APP_STORE_SUBMISSION.md` and `docs/MOBILE_ARCHITECTURE.md` for step-by-step commands and account-level checklists.
