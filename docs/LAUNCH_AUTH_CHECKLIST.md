# EverittOS launch auth checklist

Use this after deploying auth fixes to `main`. Production app: https://app.everittventures.com

## Vercel environment variables

Set in **Project Settings → Environment Variables** for Production (and Preview if testing PRs):

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_APP_URL` | Yes | `https://app.everittventures.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Must be `https://<project-ref>.supabase.co` (not `.supabase.com`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; never expose to browser. Required for login workspace bootstrap and Stripe webhooks. |
| `STRIPE_SECRET_KEY` | Yes | For billing portal, cancel/resume |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `ADMIN_EMAILS` | Yes | Comma-separated platform admin emails |
| `RESEND_API_KEY` | Optional | Team/client invite email |
| `EMAIL_FROM` | Optional | Sender for invite email |
| `AUTH_DEBUG` | Optional | Set to `1` on server to log auth events (no secrets) |

**Critical:** Set all `NEXT_PUBLIC_*` variables for **Production** before deploying. The app injects runtime Supabase config from the server (`SupabaseRuntimeConfig` in layout), but Vercel server routes still read env at runtime.

After changing variables, **redeploy** the latest `main` deployment.

### Verify deployment config (no secrets)

- `GET https://app.everittventures.com/api/auth/config` — should show `configured: true` and your Supabase host
- `GET https://app.everittventures.com/api/auth/session` — should show `connectivity.ok: true` when logged out

## Supabase Auth URL settings

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL:** `https://app.everittventures.com`
- **Redirect URLs** (add each):
  - `https://app.everittventures.com/**`
  - `https://app.everittventures.com/auth/callback`
  - `https://app.everittventures.com/auth/callback/**`
  - `https://app.everittventures.com/reset-password`
  - `http://localhost:3000/auth/callback` (local dev)
  - `http://localhost:3000/reset-password` (local dev)

Email templates use the redirect URL from the app (`/auth/callback?next=/reset-password&type=recovery` for password reset).

## Stripe settings

- **Webhook endpoint:** `https://app.everittventures.com/api/stripe/webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- **Payment Links:** metadata `plan=pro` or `plan=business` on each link
- **Customer Portal:** enable in Stripe Dashboard (Settings → Billing → Customer portal) for self-serve payment method updates and invoice history

## Manual test steps

### Sign up
1. Open `/signup`, create account with business name, email, password.
2. If email confirmation is enabled, verify email from inbox.
3. Confirm redirect to onboarding or role-appropriate landing page.

### Log in
1. Open `/login`, sign in with valid credentials.
2. Confirm redirect by role:
   - Owner / Admin / Manager / Worker / Viewer → `/dashboard` (or `?next=` path when safe)
   - Client → `/portal/client`
   - Technician / Contractor → `/portal/contractor` (or dashboard when `?next=` applies)
3. Try wrong password — confirm readable error banner with **Details** toggle.
4. If Supabase env is missing on Vercel, confirm configuration error message (not silent failure).

### Log out
1. From sidebar, click **Log out**.
2. Confirm redirect to login and protected routes redirect back to login.

### Forgot / reset password
1. Open `/forgot-password`, submit account email.
2. Open reset link from email.
3. Confirm landing on `/auth/callback` then `/reset-password` with session ready.
4. Set new password and confirm redirect to role-appropriate landing page.
5. Sign in with new password.

### Role-based access
| Role | Expected landing | Restricted |
|------|------------------|------------|
| Owner / Admin | `/dashboard` | — |
| Manager | `/dashboard` | Billing management |
| Worker / Employee | `/dashboard` | Team, billing |
| Technician / Contractor | `/portal/contractor` | Org-wide customers/workers |
| Client | `/portal/client` | Internal ops pages |
| Viewer | `/dashboard` (read-focused) | Team, billing |

Additional checks:
- Logged-in users visiting `/login` or `/signup` redirect to their role landing page (not always `/dashboard`).
- `/team` and `/settings/billing` blocked for roles without permission.
- `/admin` limited to emails in `ADMIN_EMAILS`.

### Subscription status
1. Owner opens `/settings/billing` — see status message for:
   - **active / trialing** — full paid access
   - **canceled** — access until period end
   - **past_due / unpaid / incomplete** — billing notice and redirect from paid routes
2. With past_due, unpaid, or incomplete on a paid plan, confirm redirect to `/settings/billing?reason=subscription`.

### Cancel subscription
1. As **owner** or **admin**, open `/settings/account` or `/settings/billing`.
2. Click **Cancel subscription** (requires active Stripe subscription).
3. Confirm status updates and message.

### Resume subscription
1. As **owner** or **admin** with canceled-at-period-end subscription, click **Resume subscription**.
2. Confirm status returns to active.

### Deactivate account
1. Open `/settings/account`.
2. Type `deactivate my account`, click **Deactivate account**.
3. Confirm sign-out and login blocked with disabled message.
4. Restore via support (updates `profiles.account_status` to `active`).

## Common production login failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Supabase: fetch failed` on login | Wrong URL (often `.supabase.com` instead of `.supabase.co`), missing service role key, or paused project | Check `/api/auth/config` (`urlCorrected: true` means URL was auto-fixed); set `SUPABASE_SERVICE_ROLE_KEY`; redeploy |
| Instant “configuration” error | Missing `NEXT_PUBLIC_SUPABASE_*` at runtime | Set env vars, redeploy |
| Login OK then “workspace setup unavailable” | Missing `SUPABASE_SERVICE_ROLE_KEY` | Set server env var; login API needs admin client for bootstrap |
| Invalid credentials for valid user | Wrong password or unverified email | Reset password / verify email |
| Login succeeds then kicks out | `account_status = disabled` | Restore account in Supabase |
| Redirect loop | Missing profile row | Complete onboarding; login API bootstraps profile |
| Reset link fails | Redirect URL not in Supabase allow list | Add callback URLs above |

## Security checks

- `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` appear only in server routes and server libs — never in client bundles.
- Auth API responses strip diagnostics, config, and connectivity details in production (`sanitizeErrorPayload`).
- Auth logs filter password, token, and secret fields (`lib/auth-logger.ts`).

## SQL migrations

No new migrations are required for this auth fix unless your production database is missing `profiles.account_status`. If so, run existing migrations in `supabase/migrations/` in filename order, or use `supabase/production_bootstrap.sql` for legacy upgrades.
