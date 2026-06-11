# EverittOS

Field operations app for Everitt Ventures. Next.js 15, Supabase Auth, Postgres, Storage, Stripe billing, team management, jobs, customers, photos, reports, scheduling, and client portal workflows.

## Production source of truth

- GitHub repository: https://github.com/ntnguyenmba/EverittOS
- Production branch: `main`
- Production app: https://everitt-os.vercel.app

If production does not match GitHub, check Vercel Project Settings → Git and confirm it deploys from `main`.

## Environment

Copy `.env.example` to `.env.local` for local development.

### Required in Vercel Production

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Auth redirects, password reset, Stripe return URLs |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser auth (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only account disable, webhooks, admin |
| `STRIPE_SECRET_KEY` | Billing portal, cancel/resume subscription |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `ADMIN_EMAILS` | Platform admin access |

Optional:

- `RESEND_API_KEY`, `EMAIL_FROM` — team/client invite email
- `AUTH_DEBUG=1` — server auth event logging (no secrets)

**Important:** `NEXT_PUBLIC_*` variables are embedded at build time. After adding or changing them in Vercel, redeploy `main`.

See **docs/LAUNCH_AUTH_CHECKLIST.md** for Supabase Auth URLs, Stripe webhook setup, and step-by-step test procedures.

To grant yourself owner/admin access in Supabase SQL Editor, run `supabase/grant_owner_access.sql` (replace the email placeholder first).

## Supabase

Apply migrations in `supabase/migrations/` in filename order via Supabase SQL editor or CLI.

### Auth redirect URLs (production)

- Site URL: `https://everitt-os.vercel.app`
- Redirect URLs:
  - `https://everitt-os.vercel.app/auth/callback`
  - `https://everitt-os.vercel.app/auth/callback/**`
  - `https://everitt-os.vercel.app/reset-password`

Ensure Storage bucket `job-photos` exists. See `202605310003_rls_storage.sql`.

## Stripe webhook

Endpoint: `https://everitt-os.vercel.app/api/stripe/webhook`

Required: `checkout.session.completed`

Recommended: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

Payment Link metadata: `plan=pro` or `plan=business`

Enable **Stripe Customer Portal** for payment method self-service.

## Auth architecture

- **Sign in:** `POST /api/auth/login` (server sets HttpOnly session cookies)
- **Password reset:** `/forgot-password` → email link → `/auth/callback` → `/reset-password`
- **Protected routes:** `middleware.ts` (session, account status, plan, role, subscription)
- **Account controls:** `/settings/account` (deactivate, cancel/resume subscription for owners)
- **Billing:** `/settings/billing` (Stripe portal, usage, upgrades)

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

Full checklist with Vercel, Supabase, Stripe, and manual test steps: **docs/LAUNCH_AUTH_CHECKLIST.md**

Quick smoke test:

- [ ] Sign up / verify email
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
