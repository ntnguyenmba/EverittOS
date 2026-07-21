# EverittOS Supabase migrations

## Upgrading the original EverittOS schema (recommended)

If your project still has the **original** tables only (`profiles`, `jobs`, `customers`, `invoices`, `workers`, `technicians`, `job_photos`, `activity_events`, `ai_generations`, `companies`) and newer migrations fail because `business_profiles`, `organizations`, etc. do not exist:

Run **once** in the Supabase SQL Editor:

- [`../everittos_legacy_bootstrap.sql`](../everittos_legacy_bootstrap.sql)

This idempotent script preserves legacy tables, adds all current production schema objects, backfills organizations from existing users, and applies RLS/storage policies. Does not assume any prior migrations were applied.

## Team work RLS migrations (20260901+)

These migrations introduce role-aware job visibility (`can_manage_org_work`, `record_shares`).

**Production note:** If `202609060001` failed with `function public.current_org_role(uuid) does not exist`, production likely skipped `202609010001`. Run `202609070001_team_work_rls_prerequisite_repair.sql` (or re-apply the fixed `202609060001` after pull). All team-work migrations now inline prerequisites and define `can_manage_org_work()` using the existing `can_manage_organization()` helper plus `organizations.owner_user_id`.

Order:

1. `202609010001_team_work_visibility.sql`
2. `202609050001_team_work_photos_reports_rls.sql`
3. `202609060001_jobs_org_scope_rls_repair.sql`
4. `202609070001_team_work_rls_prerequisite_repair.sql` (idempotent repair if earlier files were skipped or failed)

## Incremental migrations (new projects or partial upgrades)

Run in order in the Supabase SQL editor or via CLI:
## Fresh project (recommended)

Run **once** in the Supabase SQL Editor:

- [`../everittos_full_setup.sql`](../everittos_full_setup.sql) — full idempotent schema (profiles, business_profiles, organizations, plan limits, launch tables, RLS, storage). Safe on empty projects and projects with a broken partial `business_profiles` table missing `user_id`.

Optional **manual** demo data for a dedicated demo auth user only (never for production signups): [`../demo_seed.sql`](../demo_seed.sql) (see [`../../docs/DEMO_SEED.md`](../../docs/DEMO_SEED.md)). New accounts must start with a clean workspace.

## Incremental migrations

If you already applied some migrations, run remaining files in order via SQL editor or CLI:
## Production launch (existing legacy database)

**Project:** Everitt OS — `wxtatzlirexrwjehqgak`

If bootstrap fails, run [`../diagnose_schema.sql`](../diagnose_schema.sql) first and see [`../RUN_BOOTSTRAP.md`](../RUN_BOOTSTRAP.md).

Run **once** in Supabase SQL Editor (entire file, top to bottom):

- [`../production_bootstrap.sql`](../production_bootstrap.sql) — full idempotent upgrade from the original schema to current production requirements. See [`../../docs/PRODUCTION_SCHEMA_AUDIT.md`](../../docs/PRODUCTION_SCHEMA_AUDIT.md).

## Recent finance / document locale migrations (apply if missing)

- `202609130001_job_labor_payment_basis.sql` - contractor pay basis (`hourly` / `flat` / `visit`)
- `202609140001_invoice_document_locale.sql` - freeze invoice language for customer-facing documents
- `202609150001_customer_blank_pipeline_active.sql` - migrate blank customer `pipeline_stage` to `active`

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
10. `202605360001_account_status.sql` - account disable support
11. `202605370001_launch_growth_features.sql` - API keys, workflows, departments, portal tokens

## Auth redirect URLs (Supabase Dashboard > Authentication > URL configuration)

- Site URL: your production `NEXT_PUBLIC_APP_URL`
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`
  - `https://your-domain.com/auth/callback`
  - `https://your-domain.com/reset-password`
