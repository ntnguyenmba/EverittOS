# Production domain audit — app.everittventures.com

Date: June 2026  
Branch: `main`

## Objective

Remove legacy `everitt-os.vercel.app` references and enforce `https://app.everittventures.com` as the single production URL.

## Legacy URLs removed

| File | Change |
|------|--------|
| `README.md` | All `everitt-os.vercel.app` → `app.everittventures.com` |
| User-facing auth API messages | Removed "verify in Vercel" copy |

**Search result:** No `everitt-os.vercel.app` references remain in the repository.

`VERCEL_ENV` / `NEXT_PUBLIC_VERCEL_ENV` are retained only for deployment environment detection (toolbar suppression), not for URL generation.

## URL utility (single source of truth)

| Module | Purpose |
|--------|---------|
| `lib/app-url.ts` | `appOrigin()`, `appUrl()`, `authRoutes` |
| `lib/auth-redirect-urls.ts` | Supabase email/callback redirect builders |
| `lib/client-api-url.ts` | Browser API fetch resolution |

All auth redirects derive from `NEXT_PUBLIC_APP_URL` (fallback: `https://app.everittventures.com`).

## Redirect URLs verified in code

| Flow | Redirect |
|------|----------|
| Signup confirmation | `{APP_URL}/confirm-email?next=...` |
| Password reset email | `{APP_URL}/reset-password` |
| Recovery code exchange | `/api/auth/reset-session` → `/reset-password` |
| OAuth / legacy | `{APP_URL}/auth/callback?next=...` |
| Post-confirmation | `/login?verified=1` |
| Post-password-reset | `/login?reset=1` |
| Google Calendar OAuth | `{APP_URL}/api/integrations/google-calendar/callback` |
| Stripe portal return | `{APP_URL}/settings/billing` |

Runtime verification: `GET /api/auth/config` → `appOrigin`, `authRedirects`.

## Auth flows

| Flow | Status |
|------|--------|
| Login | Server `POST /api/auth/login`; friendly invalid-credentials message |
| Signup | Server `POST /api/auth/signup`; Supabase confirmation email |
| Email confirmation | `GET /confirm-email` → workspace bootstrap → `/login?verified=1` |
| Forgot password | `POST /api/auth/reset-password`; Supabase email |
| Reset password | Server session + `POST /api/auth/update-password` → `/login?reset=1` |
| Google OAuth (Calendar) | `googleCalendarRedirectUri()` via `appUrl()` |
| Logout | `POST /api/auth/sign-out` |
| Protected routes | `middleware.ts` |

Auth emails: **Supabase Auth only**. Resend is not used for auth.

## Login UX improvements

- Friendly message: "The email or password is incorrect."
- Password show/hide toggle (`components/auth/password-field.tsx`)
- Disabled submit while loading or fields empty
- No raw Supabase errors in production API responses
- Success messages for email verified and password reset

## Development diagnostics

`lib/auth-debug.ts` logs redirect URLs, domain, and auth errors in **development only** (`AUTH_DEBUG=1` or `NODE_ENV=development`). Never logs secrets. Production keeps critical failure logs only via `lib/auth-logger.ts`.

## Files changed (summary)

- `lib/app-url.ts` — centralized URL helpers
- `lib/auth-redirect-urls.ts` — runtime redirect builders
- `lib/auth-debug.ts` — dev-only diagnostics
- `lib/auth-fetch.ts`, `lib/auth-logger.ts`, `lib/safe-api-error.ts` — logging and error sanitization
- `lib/auth-request-error.ts`, `lib/auth-errors.ts` — friendly client errors
- `app/login/page.tsx`, `components/auth/password-field.tsx` — login UX
- `app/confirm-email/route.ts`, `app/api/auth/reset-session/route.ts` — auth redirects
- `app/api/auth/signup/route.ts`, `app/api/auth/reset-password/route.ts`, `app/api/auth/update-password/route.ts`
- `components/auth/reset-password-form.tsx`, `app/reset-password/page.tsx`
- `middleware.ts`, `app/api/auth/config/route.ts`
- `README.md`, `docs/LAUNCH_AUTH_CHECKLIST.md`, `docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md`
- `lib/google-calendar-config.ts`, `app/settings/integrations/page.tsx`
- `components/client-access-panel.tsx`, `app/globals.css`

## Remaining risks

1. **Supabase Dashboard** must list `app.everittventures.com` redirect URLs (not vercel.app). Manual step outside repo.
2. **`NEXT_PUBLIC_APP_URL`** must be set to `https://app.everittventures.com` in production before deploy; otherwise runtime URLs follow env or fallback.
3. **Users who reset passwords before June 2026 fix** may need one more forgot-password cycle.
4. **Google Cloud Console** OAuth redirect must match `GOOGLE_CALENDAR_REDIRECT_URI` or `appUrl()` callback.

## Build

Run `npm run lint` and `npm run build` before deploy.
