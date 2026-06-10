# EverittOS Supabase migrations

## Fresh project (recommended)

Run **once** in the Supabase SQL Editor:

- [`../everittos_full_setup.sql`](../everittos_full_setup.sql) — full idempotent schema (profiles, business_profiles, organizations, plan limits, launch tables, RLS, storage). Safe on empty projects and projects with a broken partial `business_profiles` table missing `user_id`.

Optional demo data after creating a demo auth user: [`../demo_seed.sql`](../demo_seed.sql) (see [`../../docs/DEMO_SEED.md`](../../docs/DEMO_SEED.md)).

## Incremental migrations

If you already applied some migrations, run remaining files in order via SQL editor or CLI:

1. `202605310001_platform_core.sql` - tables, triggers
2. `202605310003_rls_storage.sql` - RLS and job-photos bucket
3. `202605311200_everittos_plan_tiers.sql` - plan columns (if not already applied)
4. `202605311400_everittos_crews_locations.sql` - crews and locations (optional)
5. `202605311600_rbac_roles.sql`
6. `202605320001_launch_features.sql` - role-based access policies
7. `202605330001_organizations_platform.sql` - organizations, team, plan_tier_limits, activity, notifications
8. `202605340001_saas_fundable_platform.sql` - Operations plan, aligned limits, onboarding fields, product_events
9. `202605350001_launch_audit.sql` - indexes, subscription_events, launch audit support
10. `202605360001_account_status.sql` - account disable support
11. `202605370001_launch_growth_features.sql` - API keys, workflows, departments, portal tokens

## Auth redirect URLs (Supabase Dashboard > Authentication > URL configuration)

- Site URL: your production `NEXT_PUBLIC_APP_URL`
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`
  - `https://your-domain.com/auth/callback`
  - `https://your-domain.com/reset-password`
