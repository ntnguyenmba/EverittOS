# EverittOS Supabase migrations

Apply in order via Supabase CLI or SQL editor:

1. `202605310001_platform_core.sql`
2. `202605310003_rls_storage.sql`
3. `202605311200_everittos_plan_tiers.sql`
4. `202605311400_everittos_crews_locations.sql`
5. `202605311600_rbac_roles.sql`

Add production redirect URLs in Supabase Auth:
- `https://your-domain.com/reset-password`
- `https://your-domain.com/auth/callback`
