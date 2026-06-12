# Workspace bootstrap failure report

Date: June 2026  
Branch: `main`

## Symptom

User exists in `auth.users` (signup + email confirmation succeed) but EverittOS shows:

> Your account exists in Supabase Auth but EverittOS could not finish workspace setup.

## Signup → workspace data flow

| Step | Mechanism | Tables |
|------|-----------|--------|
| 1. Signup | `POST /api/auth/signup` → Supabase Auth | `auth.users` |
| 2. Auth trigger | `handle_new_user()` on insert | `profiles`, `business_profiles` |
| 3. Email confirm | `GET /confirm-email` | session only |
| 4. First login / setup | `ensureUserWorkspace()` (service role) | `profiles`, `organizations`, `organization_members`, `organization_settings`, `business_profiles` |

The trigger creates a **minimal profile only**. Organization, membership, and `profiles.organization_id` are created at login/setup by `lib/profile-bootstrap-server.ts`.

## Root causes identified

### 1. Partial bootstrap without idempotent repair (primary)

If organization or membership was created on attempt 1 but `profiles.organization_id` link failed, a later login could treat the workspace as "ready" (membership present) while the profile stayed unlinked. Middleware and dashboards then behaved inconsistently.

**Fix:** `resolveOrganizationId()` now looks up org by `profiles.organization_id`, active membership, `organizations.owner_user_id`, or any historical membership before inserting a duplicate org. Session-fast-path repairs missing `profiles.organization_id` when membership exists.

### 2. Non-retryable failures after partial writes

Login called `signOut()` on all bootstrap failures, and returned raw SQL `details` to clients.

**Fix:** Retryable codes keep the session alive, login retries bootstrap twice, and `/api/auth/setup` is invoked automatically from the login page when `retryable: true`.

### 3. Schema / constraint drift

Production databases migrated incrementally may lack:

- `profiles.account_status`, `profiles.organization_id`
- aligned `profiles_role_check` / `organization_members_role_check` (e.g. `employee`, `viewer`)

Upserts then fail with Postgres check constraint or missing column errors.

**Fix:** Migration `202606120001_workspace_bootstrap_alignment.sql` adds columns and aligns role constraints.

### 4. `organization_settings` upsert failures blocking login

Missing `onboarding_skipped` or RLS changes could fail settings upsert and abort the entire bootstrap even when org + membership were created.

**Fix:** Settings upsert failures are logged (`org_settings_bootstrap_failed`) but no longer block workspace completion.

### 5. Missing `SUPABASE_SERVICE_ROLE_KEY`

Without service role, bootstrap cannot write across RLS-protected tables as admin.

**Fix:** Clear error code `bootstrap_unavailable` with actionable server log; not retryable without env fix.

## Tables, policies, and triggers

| Component | Signup impact | Bootstrap impact |
|-----------|---------------|------------------|
| `handle_new_user` trigger | Creates `profiles` + `business_profiles` | Must not throw (would block auth insert) |
| `profiles` RLS | User can read/update own row | Service role bypasses RLS for upsert/link |
| `organizations` RLS | N/A at signup | Service role inserts org |
| `organization_members` RLS | N/A at signup | Service role upserts membership |
| `organization_settings` RLS | N/A at signup | Service role upserts; member policies apply after creation |
| Role check constraints | `profiles.role` default `owner` | Must allow `owner` on both `profiles` and `organization_members` |

RLS does **not** block bootstrap when `SUPABASE_SERVICE_ROLE_KEY` is configured (admin client bypasses RLS).

## Server logging added

Each bootstrap step logs via `lib/bootstrap-log.ts`:

```
[everittos-bootstrap] {
  "event": "bootstrap_step_failed",
  "step": "ensure_membership",
  "table": "organization_members",
  "action": "upsert",
  "userId": "...",
  "pgCode": "23514",
  "pgDetails": "...",
  "pgHint": "...",
  "reason": "...",
  "stack": "..."
}
```

Search Vercel/server logs for `everittos-bootstrap` or `bootstrap_step_failed` to find the exact failing table and SQL operation.

## Repair paths

1. **Automatic:** Sign in again → login retries bootstrap → login page calls `POST /api/auth/setup` when `retryable`.
2. **Background:** `WorkspaceBootstrap` client component calls `/api/auth/setup` on navigation when org context is missing.
3. **Manual SQL:** `supabase/repair_production_profile.sql` for a specific user id.
4. **Migration:** Run `202606120001_workspace_bootstrap_alignment.sql` in Supabase SQL editor.

## Retryable error codes

- `profile_upsert_failed`
- `org_create_failed`
- `membership_upsert_failed`
- `profile_link_failed`

## Files changed

- `lib/profile-bootstrap-server.ts` — idempotent repair, org resolution, link repair
- `lib/bootstrap-log.ts` — Postgres error + stack logging
- `app/api/auth/login/route.ts` — retry, friendly errors, session preservation
- `app/api/auth/setup/route.ts` — retry + logging
- `app/login/page.tsx` — auto `/api/auth/setup` on retryable failure
- `lib/auth-errors.ts` — friendlier `profile_setup` copy
- `supabase/migrations/202606120001_workspace_bootstrap_alignment.sql`

## Verification checklist

1. Sign up new user → confirm email → sign in → lands on dashboard/onboarding.
2. Supabase: `profiles` row with `organization_id`, `role=owner`, `account_status=active`.
3. Supabase: `organizations` row with `owner_user_id` = user id.
4. Supabase: `organization_members` row with `active=true`, `role=owner`.
5. Simulate partial state (profile without `organization_id` but membership exists) → second login repairs link.

## Remaining risks

- Production must have `SUPABASE_SERVICE_ROLE_KEY` set.
- All migrations through `202606120001` must be applied.
- If `handle_new_user` trigger errors, signup itself fails before workspace bootstrap runs (check Supabase Auth logs).
