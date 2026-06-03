# EverittOS

Field operations app for Everitt Ventures. Next.js 15, Supabase Auth, Postgres, and Storage.

## Environment

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (Stripe webhook and admin tasks)
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (automatic plan upgrades)

## Supabase

Apply migrations in `supabase/migrations/` in filename order via Supabase SQL editor or CLI.

Add Auth redirect URLs for your app origin:

- `/auth/callback`
- `/reset-password`

Ensure Storage bucket `job-photos` exists (see `202605310003_rls_storage.sql`).

## Stripe webhook

Endpoint: `https://<your-app-domain>/api/stripe/webhook`

Events: `checkout.session.completed`

In each Stripe Payment Link, add metadata (recommended):

- Key: `plan`
- Value: `pro` for Pro ($9/mo) or `business` for Business ($39/mo)

Optional fallback: set Payment Link **Client reference ID** to `pro` or `business`.

The webhook does **not** use Stripe Price IDs or Product IDs. If metadata is missing, it infers plan from `checkout.session.completed` `amount_total` (900 = Pro, 3900 = Business, in cents).

Without metadata or matching amount, the webhook records the event but does not update the user plan.

Manual plan changes are not required after payment when the webhook is configured.

## Local development

```bash
npm install
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000`.

## Launch test checklist

- [ ] Sign up
- [ ] Verify email
- [ ] Log in
- [ ] Complete onboarding
- [ ] Create customer
- [ ] Create job
- [ ] Set start date, due date, and assigned worker (Business)
- [ ] Upload before photo
- [ ] Upload after photo
- [ ] Create proof report and print
- [ ] Hit Free plan limit (jobs, photos, customers, or reports)
- [ ] Upgrade plan through Stripe Payment Link
- [ ] Confirm `profiles.plan` updates via webhook
- [ ] Log out
- [ ] Reset password

## Plans

Limits are defined in `lib/everittos-limits.ts`. Server triggers in `202605320001_launch_features.sql` enforce inserts.
