# EverittOS Supabase migrations

Run in order in the Supabase SQL editor or via CLI:

1. `202605310001_platform_core.sql` - tables, triggers
2. `202605310003_rls_storage.sql` - RLS and job-photos bucket
3. `202605311200_everittos_plan_tiers.sql` - plan columns (if not already applied)
4. `202605311400_everittos_crews_locations.sql` - crews and locations (optional)
5. `202605311600_rbac_roles.sql` - role-based access policies

## Auth redirect URLs (Supabase Dashboard > Authentication > URL configuration)

- Site URL: your production `NEXT_PUBLIC_APP_URL`
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`
  - `https://your-domain.com/auth/callback`
  - `https://your-domain.com/reset-password`
