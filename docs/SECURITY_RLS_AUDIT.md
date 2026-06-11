# EverittOS Security & RLS Audit

Generated as part of the production readiness sprint.

## Summary

Row Level Security (RLS) is enabled on all customer-facing tables in `supabase/production_bootstrap.sql` and `supabase/production_auth_schema.sql`. Service-role operations (team invites, Stripe webhooks, ownership transfer) use the admin client and bypass RLS intentionally.

## Tables with RLS enabled

| Table | Select policy | Write policy |
|-------|---------------|--------------|
| `profiles` | Own profile + org members | Own profile update |
| `organizations` | Org members | Owner/admin via service role |
| `organization_members` | Org members | Service role / manage_team API |
| `organization_settings` | Org members | Org members (managers+) |
| `organization_invitations` | Team managers | Team managers via API |
| `jobs` | Org scope / assignment scope | Role-based |
| `customers` | Org members with `view_all_org_data` | Managers+ |
| `job_photos` | Job access | Assigned workers+ |
| `job_reports` | Job access | Assigned workers+ |
| `notifications` | Own user_id | Own user_id + service inserts |
| `activity_logs` | Org members (paid plans) | Org members insert |
| `everittos_subscriptions` | Own email/user | Service role only (webhook) |
| `subscription_events` | Denied (service only) | Service role only |

## Application-layer enforcement

- **Middleware** (`middleware.ts`): session, account status, onboarding, subscription blocks, role permissions (`view_team`, `manage_billing`, `view_all_org_data`), plan gates.
- **API routes**: team, billing, Stripe, plan validation use server auth + `canManageTeam` / `canManageBilling` / `hasPermission`.
- **UI**: destructive actions use confirmation dialogs; billing and team management hidden by role.

## Role matrix (implemented)

| Capability | Owner | Admin | Manager | Worker | Viewer |
|------------|-------|-------|---------|--------|--------|
| Full org data | Yes | Yes | Yes | Assigned only | Read assigned |
| Manage team | Yes | Yes | No | No | No |
| View team | Yes | Yes | Yes | No | No |
| Manage billing | Yes | Yes | No | No | No |
| Manage jobs | Yes | Yes | Yes | Assigned | Read only |

## Findings & fixes (this sprint)

1. **Admin billing** — Admins can now manage billing (aligned with product spec).
2. **Manager team access** — Managers have `view_team` only; invite/edit restricted to owner/admin.
3. **Onboarding bypass** — Middleware now enforces `onboarding_completed` before app routes.
4. **Ownership transfer** — New API with owner-only guard; owner row cannot be deleted/deactivated via members API.
5. **Stripe period end** — Webhook persists `current_period_end` for renewal display.

## Recommended follow-ups

1. Add automated RLS integration tests against a staging Supabase project.
2. Restrict `organization_settings` updates to owner/admin at the DB policy level (currently broader for managers).
3. Audit `storage` bucket policies for `org-logos` and job photo buckets.
4. Enable Supabase Auth leaked password protection and MFA for admin accounts.

## Required SQL (production)

Run if not already applied:

```bash
# From repo root — idempotent
psql $DATABASE_URL -f supabase/production_auth_schema.sql
```

Adds missing columns (`timezone`, `current_period_end`, onboarding fields) and RLS policies.
