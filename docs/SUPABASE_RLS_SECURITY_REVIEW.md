# Supabase RLS Security Review

Review date: 2026-06-10 (post security-hardening pass).  
Scope: Row-level security on user-facing tables, org isolation, storage policies.

## Summary

| Area | Status | Notes |
|------|--------|-------|
| RLS enabled on tenant tables | **Pass** | See table list below |
| Org-scoped data isolation | **Pass** | Policies use `organization_id` + membership helpers |
| Privileged profile columns | **Pass** | Trigger blocks self-update of role/plan/billing fields |
| Storage buckets | **Pass** | `job-photos`, `org-logos` private with RLS |
| Service-role bypass | **Expected** | Admin routes use service role; must stay server-only |

## Tables with RLS enabled

From `supabase/production_bootstrap.sql`:

- `profiles`, `business_profiles`
- `organizations`, `organization_settings`, `organization_members`, `organization_invitations`, `organization_locations`
- `customers`, `customer_properties`, `workers`, `jobs`, `job_assignments`, `job_photos`, `job_timeline`, `job_reports`, `job_checklist_items`, `job_client_access`
- `activity_logs`, `notifications`, `crews`
- `workflow_templates`, `workflow_steps`, `job_workflow_progress`
- `departments`, `department_memberships`
- `plan_tier_limits`, `everittos_subscriptions`, `subscription_events`, `product_events`, `api_keys`
- Legacy `invoices` (when present)

## Org isolation model

1. **Membership check:** Helper functions `is_org_member()`, `member_role_in_org()`, `can_manage_organization()` gate policies.
2. **Plan limits:** `plan_for_organization()` reads the org owner plan for cap enforcement.
3. **Client portal:** `client_can_view_job()` restricts client role to granted jobs only.
4. **Contractor/worker:** Assignment-based policies in `202605311600_rbac_roles.sql` and photo policies in `202606130001_job_photos_before_after.sql`.

## Verified concerns (no schema change required)

| ID | Severity | Finding | Mitigation |
|----|----------|---------|------------|
| R1 | Medium | Some tables use `FOR ALL` org policies allowing any member to INSERT/UPDATE/DELETE | Server routes validate role; consider splitting write policies in a future migration |
| R2 | Medium | `subscription_events` and `product_events` are service-role insert only (users cannot read) | Expected; no user-facing leak |
| R3 | Low | Webhook matches Stripe checkout by email, not user ID | Documented in billing flow; fix in app layer only |
| R4 | Low | In-memory rate limits are per server instance | Acceptable for launch; use Redis/Upstash for strict global limits at scale |
| R5 | Info | `activity_logs` INSERT allowed to org members via RLS | Operational log, not tamper-proof audit trail |

## Storage

- **`job-photos`:** Private bucket; path `{user_id}/{job_id}/...`; RLS on storage objects.
- **`org-logos`:** Private; org managers only.

## Recommendations (future migrations)

1. Split `FOR ALL` policies into separate SELECT / INSERT / UPDATE / DELETE with role checks.
2. Add immutable audit table for security events (login failures, role changes, billing changes).
3. Add automated RLS integration tests against a staging Supabase project.

## How to re-verify in Supabase

1. Run `supabase/production_bootstrap.sql` or all migrations through latest.
2. Sign in as non-owner roles and confirm cross-org reads return empty.
3. Attempt direct Supabase client writes to another org's `jobs` row (should fail).
4. Review Storage policies in Dashboard > Storage > Policies for `job-photos`.

See also: `docs/SECURITY_RLS_AUDIT.md`, `SECURITY_REPORT.md`.
