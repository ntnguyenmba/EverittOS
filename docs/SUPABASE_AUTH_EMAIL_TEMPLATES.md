# Supabase Auth email templates (EverittOS)

EverittOS uses **Supabase Auth only** for signup confirmation and password reset. Do not wire Resend or any other provider to these flows. Resend remains optional for **team and client invites** only.

Production app: `https://app.everittventures.com`

## URL configuration

In **Supabase Dashboard → Authentication → URL Configuration**:

| Setting | Value |
|---------|--------|
| Site URL | `https://app.everittventures.com` |

**Redirect URLs** (add each):

- `https://app.everittventures.com/confirm-email`
- `https://app.everittventures.com/confirm-email/**`
- `https://app.everittventures.com/auth/callback`
- `https://app.everittventures.com/auth/callback/**`
- `https://app.everittventures.com/reset-password`
- `https://app.everittventures.com/reset-password/**`
- `http://localhost:3000/confirm-email` (local dev)
- `http://localhost:3000/auth/callback` (local dev)
- `http://localhost:3000/reset-password` (local dev)

Verify at runtime: `GET https://app.everittventures.com/api/auth/config` → `authRedirects.supabaseAllowList`.

## App redirect targets

| Flow | API call | Email link lands on |
|------|----------|---------------------|
| Signup confirmation | `POST /api/auth/signup` → `emailRedirectTo` | `/confirm-email?next=...` |
| Password reset | `POST /api/auth/reset-password` → `redirectTo` | `/reset-password?code=...` |
| OAuth / legacy | `/auth/callback` | `/auth/callback?next=...` |

After signup confirmation, the user is sent to `/login?verified=1` to sign in with their password.

After password reset, the user sets a new password on `/reset-password` (server session via `/api/auth/reset-session`).

## Email templates

In **Supabase Dashboard → Authentication → Email Templates**, use the default `{{ .ConfirmationURL }}` link for both templates. The app supplies the correct redirect host when sending signup and reset requests.

### Confirm signup

Subject (example): `Confirm your EverittOS account`

Body (minimum):

```html
<h2>Confirm your email</h2>
<p>Thanks for signing up for EverittOS. Click the link below to confirm your email address:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm email</a></p>
<p>If you did not create an account, you can ignore this email.</p>
```

### Reset password

Subject (example): `Reset your EverittOS password`

Body (minimum):

```html
<h2>Reset your password</h2>
<p>Click the link below to choose a new password for your EverittOS account:</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
<p>If you did not request a reset, you can ignore this email.</p>
```

Do **not** hard-code `app.everittventures.com` in templates. Supabase builds `{{ .ConfirmationURL }}` from the `emailRedirectTo` / `redirectTo` values the app passes at send time.

## User-friendly errors

| Situation | User sees |
|-----------|-----------|
| Expired confirmation link | Signup page or login: link expired; sign in with password or create account again |
| Expired reset link | Forgot password page: request a new reset link |
| Email not confirmed at login | Login: confirm your email before signing in |
| Invalid password | Login: email or password incorrect |

Server logs: `[everittos-auth]` with events `confirm_email_*`, `reset_password_link_*`, `login_failure_diagnosis`.
