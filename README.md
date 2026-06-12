# EverittOS

Field operations app for Everitt Ventures. Next.js 15, Supabase Auth, Postgres, Storage, Stripe billing, team management, jobs, customers, photos, reports, scheduling, and client portal workflows.

## Production source of truth

- GitHub repository: https://github.com/ntnguyenmba/EverittOS
- Production branch: `main`
- Production app: https://app.everittventures.com

If production does not match GitHub, confirm the hosting project deploys from `main` with `NEXT_PUBLIC_APP_URL=https://app.everittventures.com`.

## Environment

Copy `.env.example` to `.env.local` for local development.

### Required in production

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | **Must be** `https://app.everittventures.com` — auth redirects, password reset, Stripe return URLs |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser auth (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only bootstrap, webhooks, team APIs, admin |
| `STRIPE_SECRET_KEY` | Billing portal, cancel/resume subscription |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `RESEND_API_KEY` | Team invite email only (not auth) |
| `EMAIL_FROM` | Sender for invite email only (not auth) |
| `ADMIN_EMAILS` | Comma-separated emails for `/admin/launch-status` and platform metrics |

Optional:

- `AUTH_DEBUG=1` — development auth diagnostics (no secrets)

**Important:** `NEXT_PUBLIC_*` variables are embedded at build time. After changing them, redeploy `main`.

See **docs/LAUNCH_AUTH_CHECKLIST.md** and **docs/SUPABASE_AUTH_EMAIL_TEMPLATES.md** for Supabase Auth URLs, Stripe webhook setup, and test procedures.

To grant yourself owner/admin access in Supabase SQL Editor, run `supabase/grant_owner_access.sql` (replace the email placeholder first).

## Supabase

Apply migrations in `supabase/migrations/` in filename order via Supabase SQL editor or CLI.

### Auth redirect URLs (production)

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL:** `https://app.everittventures.com`
- **Redirect URLs:**
  - `https://app.everittventures.com/confirm-email` and `/**`
  - `https://app.everittventures.com/auth/callback` and `/**`
  - `https://app.everittventures.com/reset-password` and `/**`

Auth emails are sent by **Supabase Auth only**. Ensure Storage bucket `job-photos` exists. See `202605310003_rls_storage.sql`.

## Stripe webhook

Endpoint: `https://app.everittventures.com/api/stripe/webhook`

Required: `checkout.session.completed`

Recommended: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

Payment Link metadata: `plan=pro` or `plan=business`

Enable **Stripe Customer Portal** for payment method self-service.

## Auth architecture

- **Sign in:** `POST /api/auth/login` (server sets HttpOnly session cookies)
- **Sign up:** `POST /api/auth/signup` → confirmation email → `/confirm-email` → `/login?verified=1`
- **Password reset:** `/forgot-password` → email link → `/reset-password` → `/login?reset=1`
- **Protected routes:** `middleware.ts` (session, account status, plan, role, subscription)
- **URL helper:** `lib/app-url.ts` (`appUrl`, `appOrigin`, `authRoutes`) — never hardcode deployment hosts

Service role key is used only in server API routes (`lib/supabase-admin.ts`), never in client code.

## Local development

```bash
npm install
npm run lint
npm run build
npm run dev
```

Open http://localhost:3000

## Launch test checklist

Full checklist: **docs/LAUNCH_AUTH_CHECKLIST.md**

Quick smoke test:

- [ ] Sign up / verify email at `/confirm-email`
- [ ] Log in / log out
- [ ] Forgot password / reset password
- [ ] Role-appropriate dashboard or portal
- [ ] Cancel / resume subscription (owner, paid plan)
- [ ] Deactivate account

## Design direction

Crisp editorial aesthetic aligned with Everitt Ventures:

- Background `#F7F6F3`, cards `#FFFFFF`, accent `#2D3748`
- Cormorant Garamond headings, Inter body
- No beige gradients, glassmorphism, or generic SaaS styling

## Plans

Limits: `lib/everittos-limits.ts`. Server triggers: `202605320001_launch_features.sql`.
