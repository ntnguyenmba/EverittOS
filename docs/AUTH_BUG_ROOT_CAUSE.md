# Auth bug root cause (June 2026)

## Symptoms

- Signup confirmation emails delivered; user exists in Supabase Auth.
- Login returns **Invalid login credentials** (even after email confirmation).
- Password reset emails sent, but login still fails afterward.

## Root causes

### 1. Password reset used the browser Supabase client (primary)

Recovery links land on `/reset-password` (via `redirectTo` from `POST /api/auth/reset-password`). Middleware forwards `?code=` to `/api/auth/reset-session`, which exchanges the PKCE code on the **server** and stores the session in **httpOnly** cookies.

The reset page previously called `supabase.auth.getSession()` and `supabase.auth.updateUser()` in the **browser** client. That client reads `document.cookie`, which does not include httpOnly cookies. After callback redirect to `/reset-password`, the browser often had **no visible session**, so `updateUser({ password })` did not persist a new password. Users believed reset succeeded; login still failed.

**Fix:** `/reset-password?code=` is exchanged by `/api/auth/reset-session`. The reset form updates the password via `POST /api/auth/update-password`, which reads the recovery session from server cookies.

### 2. Signup used the browser client; login used the server

Signup called `supabase.auth.signUp()` in the browser while login used `POST /api/auth/login` on the server. If runtime Supabase config injection failed or env was wrong at build time, signup and login could target different hosts (for example `.supabase.com` vs normalized `.supabase.co`).

**Fix:** `POST /api/auth/signup` performs signup on the server with the same `normalizeSupabaseUrl()` and logging as login. Confirmation emails redirect to `/confirm-email` (not the browser client).

### 3. Email normalization mismatch

Login normalized email (`trim` + lowercase) but signup sent the raw form value. Edge cases with whitespace or casing could cause lookup mismatches in profiles and confusing invalid-credentials errors.

**Fix:** Signup and login both use `normalizeEmail()` before Supabase calls. Migration `202606110001_auth_email_repair.sql` lowercases stored profile emails.

### 4. Unconfirmed email reported as invalid credentials

Supabase often returns **Invalid login credentials** when the email is not confirmed. The UI showed a generic wrong-password message.

**Fix:** On login failure, `diagnoseLoginFailure()` uses the service role to inspect the auth user and returns **Email not verified** when `email_confirmed_at` is null. Server logs include `diagnosisReason` (set `AUTH_DEBUG=1` for extra detail).

## Affected users

Users who attempted password reset before this fix likely still have their **original** password (reset may not have applied). They should:

1. Deploy this fix and run migration `202606110001_auth_email_repair.sql` in Supabase SQL editor.
2. Use **Forgot password** again and complete reset on `/reset-password` (server session).
3. Sign in at `/login`.

Users who never confirmed email should open the confirmation link or request a new one; login will now show an explicit verification message.

## Verification

1. Signup at `/signup` → confirm email at `/confirm-email` → login at `/login?verified=1`.
2. Forgot password → open email link to `/reset-password` → set password → login with new password.
3. Check Vercel logs for `[everittos-auth]` entries: `signup_success`, `update_password_success`, `login_success`, or `login_failure_diagnosis` with `diagnosisReason`.

## New server routes

| Route | Purpose |
|-------|---------|
| `POST /api/auth/signup` | Server-side signup; confirmation email → `/confirm-email` |
| `GET /confirm-email` | Exchanges signup confirmation code; redirects to `/login?verified=1` |
| `POST /api/auth/reset-password` | Sends Supabase reset email → `/reset-password` |
| `GET /api/auth/reset-session` | Exchanges recovery code; sets session cookies |
| `POST /api/auth/update-password` | Server-side password update using recovery session cookies |

Auth emails remain on Supabase Auth only. See `docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md`.
