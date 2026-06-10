# EverittOS

Field operations app for Everitt Ventures. Next.js 15, Supabase Auth, Postgres, Storage, Stripe billing, team management, jobs, customers, photos, reports, scheduling, and client portal workflows.

## Production source of truth

Use one branch for launch work:

- GitHub repository: `ntnguyenmba/EverittOS`
- Production branch: `main`
- Production app: `https://everitt-os.vercel.app`

If production does not match GitHub, check Vercel Project Settings > Git and confirm it is connected to this repository and deploying from `main`.

## Environment

Copy `.env.example` to `.env.local` for local development.

Required in Vercel Production:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional for live email invites:

- `RESEND_API_KEY`
- `EMAIL_FROM`

After adding or changing Vercel environment variables, redeploy the latest `main` deployment.

## Supabase

Apply migrations in `supabase/migrations/` in filename order via Supabase SQL editor or CLI.

Add Auth redirect URLs for the production app origin:

- `https://everitt-os.vercel.app/auth/callback`
- `https://everitt-os.vercel.app/reset-password`

Set the Supabase Auth Site URL to:

- `https://everitt-os.vercel.app`

Ensure Storage bucket `job-photos` exists. See `202605310003_rls_storage.sql`.

## Stripe webhook

Endpoint:

`https://everitt-os.vercel.app/api/stripe/webhook`

Required event:

- `checkout.session.completed`

Recommended additional events:

- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

In each Stripe Payment Link, add metadata:

- Key: `plan`
- Value: `pro` for Pro ($9/month)
- Value: `business` for Business ($39/month)

Optional fallback: set Payment Link Client reference ID to `pro` or `business`.

The webhook does not use Stripe Price IDs or Product IDs. If metadata is missing, it infers plan from `checkout.session.completed` `amount_total`.

Without metadata or matching amount, the webhook records the event but does not update the user plan.

## Local development

```bash
npm install
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000`.

## Launch test checklist

- [ ] Vercel deploys from `main`
- [ ] Production environment variables are set
- [ ] Supabase migrations are applied
- [ ] Supabase Auth URLs are configured
- [ ] Stripe webhook is configured
- [ ] Sign up
- [ ] Verify email
- [ ] Log in
- [ ] Complete onboarding
- [ ] Create customer
- [ ] Create job
- [ ] Set start date, due date, and assigned worker
- [ ] Upload before photo
- [ ] Upload after photo
- [ ] Create proof report and print
- [ ] Hit Free plan limit
- [ ] Upgrade plan through Stripe Payment Link
- [ ] Confirm `profiles.plan` updates via webhook
- [ ] Log out
- [ ] Reset password

## Design direction

Keep the current app structure for launch. Refine the visual layer rather than rebuilding everything:

- Everitt navy and warm white palette
- Clean cards and tables
- Clear mobile spacing
- Minimal marketing copy
- Login, signup, pricing, and dashboard polish first

## Plans

Limits are defined in `lib/everittos-limits.ts`. Server triggers in `202605320001_launch_features.sql` enforce inserts.
