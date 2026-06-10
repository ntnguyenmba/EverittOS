# EverittOS Supabase migrations

## Production launch (existing legacy database)

**Project:** Everitt OS — `wxtatzlirexrwjehqgak`

Run **once** in Supabase SQL Editor:

- [`../production_bootstrap.sql`](../production_bootstrap.sql) — full idempotent upgrade from the original schema to current production requirements. See [`../../docs/PRODUCTION_SCHEMA_AUDIT.md`](../../docs/PRODUCTION_SCHEMA_AUDIT.md).

## Incremental migrations (new projects only)

1. `202605310001_platform_core.sql` - tables, triggers
2. `202605310003_rls_storage.sql` - RLS and job-photos bucket
3. `202605311200_everittos_plan_tiers.sql` - plan columns (if not already applied)
4. `202605311400_everittos_crews_locations.sql` - crews and locations (optional)
5. `202605311600_rbac_roles.sql`
6. `202605320001_launch_features.sql` - role-based access policies
7. `202605330001_organizations_platform.sql` - organizations, team, plan_tier_limits, activity, notifications
8. `202605340001_saas_fundable_platform.sql` - Operations plan, aligned limits, onboarding fields, product_events
9. `202605350001_launch_audit.sql` - indexes, subscription_events, launch audit support

## Auth redirect URLs (Supabase Dashboard > Authentication > URL configuration)

- Site URL: your production `NEXT_PUBLIC_APP_URL`
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`
  - `https://your-domain.com/auth/callback`
  - `https://your-domain.com/reset-password`
