# Mobile Architecture

## Selected approach

**Capacitor remote-server (production HTTPS) with native integrations.**

EverittOS is a Next.js 15 application with extensive server routes (authentication, Stripe webhooks, AI, reports, organization bootstrap, secure service-role operations). A static export would break these capabilities. The mobile applications therefore load the trusted production web application from:

`https://app.everittventures.com`

Native shells add lifecycle handling, deep links, camera access, network detection, Android back behavior, and billing-policy adapters. This is **not** an unrestricted generic WebView of arbitrary URLs.

## Why this was chosen

| Requirement | Remote HTTPS | Static export |
|-------------|--------------|---------------|
| API routes | Works | Broken without full client rewrite |
| Stripe webhooks | Server-side | Not available in static bundle |
| Supabase SSR cookies | Works in WebView | Complex / fragile |
| Fast web updates | Immediate on server deploy | Requires app rebuild for shell changes |
| Store compliance for billing | Adapter can hide native checkout | Same billing concerns |

`capacitor.config.ts` sets `server.url` to the production origin (or `CAPACITOR_SERVER_URL` / localhost only when `CAPACITOR_DEV=true`).

## Authentication

1. User signs in through the same Next.js pages served from production HTTPS.
2. Supabase SSR stores session tokens in **httpOnly cookies** (not Capacitor Preferences).
3. On app resume, `NativeAppProvider` calls `supabase.auth.refreshSession()`.
4. If refresh fails, user is redirected to `/login?reason=session_expired`.
5. Email confirmation, password reset, and invitation links use universal links / custom scheme → in-app routes.
6. No service-role keys, Stripe secrets, or webhook secrets ship in native bundles.

## Server API access

All `/api/*` routes are reached over HTTPS to the production origin, same as the web app. The service worker does **not** cache API responses. Mutations are never replayed from cache.

## External links

| Link type | Behavior |
|-----------|----------|
| Internal EverittOS paths | Stay in WebView |
| `checkout.stripe.com`, `billing.stripe.com` | Open in system browser on native |
| Other external HTTPS sites | Open in system browser (`@capacitor/browser`) |
| `mailto:` / `tel:` | Device handlers |

Untrusted origins cannot navigate inside the app WebView.

## Updates

| Surface | Update mechanism |
|---------|------------------|
| Web / PWA | Deploy to Vercel; service worker prompts refresh |
| Native shell code | App Store / Play Store release |
| Web content inside native | Updates automatically when production site deploys |

Minimum native version enforcement is **not** implemented unless a support policy requires it later.

## Offline behavior

- Service worker serves `/offline.html` when navigation fails (web/PWA).
- `mobile-shell/offline.html` is bundled for native local fallback assets.
- Network banner explains connectivity loss; private data is not shown from stale cache.
- Unsaved form data is not silently submitted when offline.

## What remains native

- App lifecycle (resume/pause/URL open)
- Android hardware back
- Status bar and splash screen styling
- Camera / photo library picker (`@capacitor/camera`)
- Network status (`@capacitor/network`)
- External browser for non-trusted URLs
- Keyboard resize hints (`@capacitor/keyboard`)

## What remains web-based

- All business UI, dashboards, forms, tables, portals
- Authentication UI and Supabase session cookies
- Stripe billing (web only until store policy approved)
- Reports, AI, uploads (via web APIs)
- Organization and plan enforcement

## Environment separation

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Canonical HTTPS origin |
| `CAPACITOR_SERVER_URL` | Override server URL for native builds |
| `CAPACITOR_DEV=true` | Allow localhost only for local native debugging |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase client (RLS-protected) |

Run `npm run mobile:validate-env` to verify public values without printing secrets.

## Versioning

- **Marketing version**: `1.0.0` (`package.json`, iOS `MARKETING_VERSION`, Android `versionName`)
- **Build numbers**: iOS `CURRENT_PROJECT_VERSION`, Android `versionCode` — increment before each store upload

See `docs/IOS_BUILD_AND_RELEASE.md` and `docs/ANDROID_BUILD_AND_RELEASE.md`.
