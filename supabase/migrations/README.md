# EverittOS Supabase migrations

## Upgrading the original EverittOS schema (recommended)

If your project still has the **original** tables only (`profiles`, `jobs`, `customers`, `invoices`, `workers`, `technicians`, `job_photos`, `activity_events`, `ai_generations`, `companies`) and newer migrations fail because `business_profiles`, `organizations`, etc. do not exist:

Run **once** in the Supabase SQL Editor:

- [`../everittos_legacy_bootstrap.sql`](../everittos_legacy_bootstrap.sql)

This idempotent script preserves legacy tables, adds all current production schema objects, backfills organizations from existing users, and applies RLS/storage policies. Does not assume any prior migrations were applied.

## Incremental migrations (new projects or partial upgrades)

Run in order in the Supabase SQL editor or via CLI:

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
