# EverittOS launch auth checklist

Use this after deploying auth fixes to `main`. Production app: https://everitt-os.vercel.app

## Vercel environment variables

Set in **Project Settings → Environment Variables** for Production (and Preview if testing PRs):

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_APP_URL` | Yes | `https://everitt-os.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Must be `https://<project-ref>.supabase.co` (not `.supabase.com`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; never expose to browser |
| `STRIPE_SECRET_KEY` | Yes | For billing portal, cancel/resume |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `ADMIN_EMAILS` | Yes | Comma-separated platform admin emails |
| `RESEND_API_KEY` | Optional | Team/client invite email |
| `EMAIL_FROM` | Optional | Sender for invite email |
| `AUTH_DEBUG` | Optional | Set to `1` on server to log auth events (no secrets) |

**Critical:** Set all `NEXT_PUBLIC_*` variables for **Production** before deploying. The app also injects runtime Supabase config from the server (`SupabaseRuntimeConfig` in layout), but Vercel server routes still read env at runtime.

After changing variables, **redeploy** the latest `main` deployment.

### Verify deployment config (no secrets)

- `GET https://everitt-os.vercel.app/api/auth/config` — should show `configured: true` and your Supabase host
- `GET https://everitt-os.vercel.app/api/auth/session` — should show `connectivity.ok: true` when logged out

## Supabase Auth URL settings

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL:** `https://everitt-os.vercel.app`
- **Redirect URLs** (add each):
  - `https://everitt-os.vercel.app/**`
  - `https://everitt-os.vercel.app/auth/callback`
  - `https://everitt-os.vercel.app/auth/callback/**`
  - `https://everitt-os.vercel.app/reset-password`
  - `http://localhost:3000/auth/callback` (local dev)
  - `http://localhost:3000/reset-password` (local dev)

Email templates use the redirect URL from the app (`/auth/callback?next=/reset-password&type=recovery` for password reset).

## Stripe settings

- **Webhook endpoint:** `https://everitt-os.vercel.app/api/stripe/webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- **Payment Links:** metadata `plan=pro` or `plan=business` on each link
- **Customer Portal:** enable in Stripe Dashboard (Settings → Billing → Customer portal) for self-serve payment method updates

## Manual test steps

### Sign up
1. Open `/signup`, create account with business name, email, password.
2. If email confirmation is enabled, verify email from inbox.
3. Confirm redirect to onboarding or dashboard.

### Log in
1. Open `/login`, sign in with valid credentials.
2. Confirm redirect to dashboard (or client portal for client role).
3. Try wrong password — confirm readable error banner with **Details** toggle.
4. If Supabase env is missing on Vercel, confirm configuration error message (not silent failure).

### Log out
1. From sidebar, click **Log out**.
2. Confirm redirect to login and protected routes redirect back to login.

### Forgot / reset password
1. Open `/forgot-password`, submit account email.
2. Open reset link from email.
3. Confirm landing on `/reset-password` with session ready.
4. Set new password and confirm redirect to dashboard.
5. Sign in with new password.

### Role-based access
| Role | Expected landing | Restricted |
|------|------------------|------------|
| Owner / Admin | `/dashboard` | — |
| Manager | `/dashboard` | Billing management |
| Worker / Employee | `/dashboard` | Team, billing |
| Technician / Contractor | `/dashboard` or contractor portal | Org-wide customers/workers |
| Client | `/portal/client` | Internal ops pages |
| Viewer | `/dashboard` (read-focused) | Team, billing |

### Subscription status
1. Owner opens `/settings/billing` — see status message for active, trialing, past_due, canceled, unpaid, incomplete.
2. With past_due/unpaid on paid plan, confirm redirect to billing with subscription notice.

### Cancel subscription
1. As **owner**, open `/settings/account` or `/settings/billing`.
2. Click **Cancel subscription** (requires active Stripe subscription).
3. Confirm status updates and message.

### Resume subscription
1. As **owner** with canceled-at-period-end subscription, click **Resume subscription**.
2. Confirm status returns to active.

### Deactivate account
1. Open `/settings/account`.
2. Check confirmation, click **Deactivate account**.
3. Confirm sign-out and login blocked with disabled message.
4. Restore via support (updates `profiles.account_status` to `active`).

## Common production login failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Supabase: fetch failed` on login | Wrong URL (often `.supabase.com` instead of `.supabase.co`), missing service role key, or paused project | Check `/api/auth/config` (`urlCorrected: true` means URL was auto-fixed); set `SUPABASE_SERVICE_ROLE_KEY`; redeploy |
| Instant “configuration” error | Missing `NEXT_PUBLIC_SUPABASE_*` at runtime | Set env vars, redeploy |
| Invalid credentials for valid user | Wrong password or unverified email | Reset password / verify email |
| Login succeeds then kicks out | `account_status = disabled` | Restore account in Supabase |
| Redirect loop | Missing profile row | Complete onboarding; login API bootstraps profile |
| Reset link fails | Redirect URL not in Supabase allow list | Add callback URLs above |

## SQL migrations

No new migrations are required for this auth fix unless your production database is missing `profiles.account_status`. If so, run existing migrations in `supabase/migrations/` in filename order, or use `supabase/production_bootstrap.sql` for legacy upgrades.
