# PWA Setup

EverittOS supports installation as a Progressive Web App from supported browsers (Chrome, Edge, Safari 16.4+, etc.).

## Files

| File | Purpose |
|------|---------|
| `public/manifest.webmanifest` | Install metadata |
| `public/sw.js` | Service worker |
| `public/offline.html` | Offline fallback |
| `components/pwa-registration.tsx` | Registers SW in production |
| `components/pwa-update-prompt.tsx` | Prompts when a new SW is waiting |

## Install requirements

- Valid manifest with `name`, `short_name`, `start_url`, `scope`, `display: standalone`, icons
- HTTPS production origin
- Service worker registered at `/sw.js`

## Caching strategy

| Resource | Strategy |
|----------|----------|
| `/_next/static/*` | Cache-first after first fetch |
| `/offline.html`, `/manifest.webmanifest`, `/favicon.ico` | Precached on install |
| `/api/*`, auth routes, billing | **Never cached** |
| Navigation (HTML) | Network-first; offline fallback on failure |
| Supabase / Stripe hosts | **Never cached** |

Sensitive data (auth responses, billing, private reports, photos, tokens) is **not** persisted in the service worker cache.

Logout clears application-controlled client state via `performPlatformLogoutCleanup()`.

## Icons

Placeholder theme-color icons are generated with:

```bash
npm run mobile:icons
```

Replace `public/icon.png`, `public/icon-maskable.png`, and `public/apple-icon.png` with approved brand artwork before marketing the install experience.

## Local testing

1. `npm run build && npm start`
2. Open `https://localhost:3000` or production preview
3. In Chrome DevTools → Application → Service Workers, verify registration
4. Toggle offline mode and confirm `/offline.html` appears on navigation failure

Service worker registration is disabled in `development` mode to avoid interfering with hot reload.

## Apple touch icon

Configured in `app/layout.tsx` metadata (`/apple-icon.png`).

## Update behavior

When a new `sw.js` is deployed, users see a small banner with a **Refresh** button. The app avoids reloading while forms are marked `data-unsaved="true"`.
