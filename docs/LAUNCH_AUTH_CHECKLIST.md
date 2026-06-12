# EverittOS launch auth checklist

Use this after deploying auth fixes to `main`. Production app: https://app.everittventures.com

**Auth emails:** Supabase Auth only. Resend is optional for team/client invites, not signup or password reset. See `docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md`.

## Vercel environment variables

Set in **Project Settings → Environment Variables** for Production (and Preview if testing PRs):

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_APP_URL` | Yes | `https://app.everittventures.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Must be `https://<project-ref>.supabase.co` (not `.supabase.com`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; required for login diagnostics and workspace bootstrap |
| `STRIPE_SECRET_KEY` | Yes | For billing portal, cancel/resume |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `ADMIN_EMAILS` | Yes | Comma-separated platform admin emails |
| `RESEND_API_KEY` | Optional | Team/client invite email only (not auth) |
| `EMAIL_FROM` | Optional | Sender for invite email only (not auth) |
| `AUTH_DEBUG` | Optional | Set to `1` on server to log auth events (no secrets) |

After changing variables, **redeploy** the latest `main` deployment.

### Verify deployment config (no secrets)

- `GET https://app.everittventures.com/api/auth/config` — should show `configured: true`, `authEmailProvider: "supabase"`, and `authRedirects`
- `GET https://app.everittventures.com/api/auth/session` — should show `connectivity.ok: true` when logged out

## Supabase Auth URL settings

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL:** `https://app.everittventures.com`
- **Redirect URLs** (add each):
  - `https://app.everittventures.com/confirm-email`
  - `https://app.everittventures.com/confirm-email/**`
  - `https://app.everittventures.com/auth/callback`
  - `https://app.everittventures.com/auth/callback/**`
  - `https://app.everittventures.com/reset-password`
  - `https://app.everittventures.com/reset-password/**`
  - `http://localhost:3000/confirm-email` (local dev)
  - `http://localhost:3000/auth/callback` (local dev)
  - `http://localhost:3000/reset-password` (local dev)

## Supabase email templates

Confirm signup and reset password templates must use `{{ .ConfirmationURL }}` (not hard-coded URLs). See `docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md`.

| Flow | App redirect target |
|------|---------------------|
| Signup confirmation | `https://app.everittventures.com/confirm-email?next=...` |
| Password reset | `https://app.everittventures.com/reset-password` |
| OAuth / legacy | `https://app.everittventures.com/auth/callback` |

## Manual test steps

### Sign up
1. Open `/signup`, create account with business name, email, password (`POST /api/auth/signup`).
2. Open confirmation email; link should land on `/confirm-email`.
3. After confirmation, confirm redirect to `/login?verified=1`.
4. Sign in with the same email and password.

### Log in
1. Open `/login`, sign in with valid credentials.
2. Confirm redirect by role (owner/admin → `/dashboard`, client → `/portal/client`, etc.).
3. Wrong password — readable error banner.
4. Unconfirmed email — "Email not verified" message (not generic invalid credentials).

### Log out
1. From sidebar, click **Log out**.
2. Confirm protected routes redirect to login.

### Forgot / reset password
1. Open `/forgot-password`, submit account email (`POST /api/auth/reset-password`).
2. Open reset link from email; should land on `/reset-password?code=...` then exchange to `/reset-password` with session.
3. Set new password via `POST /api/auth/update-password`.
4. Sign in with new password.
5. Users who reset before the June 2026 fix may need one more reset (see `docs/AUTH_BUG_ROOT_CAUSE.md`).

### Role-based access
- Test owner, worker, client, and viewer roles against protected routes (see gap report).
