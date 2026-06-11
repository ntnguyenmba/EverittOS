# EverittOS Security Audit Report

**Date:** 2026-06-10  
**Scope:** Authentication, authorization, Supabase RLS, API routes, storage policies, database policies, user/role permissions, environment variables, password reset, session handling.

---

## Executive summary

A full application and database policy review identified several **critical** authorization gaps in API routes that use the Supabase service-role client (bypassing RLS). Fixes were applied in application code and a new SQL migration protects privileged `profiles` columns at the database layer.

**Risk areas addressed:** role escalation, cross-organization resource references, disabled-account API access, and self-service profile privilege escalation.

---

## Findings

### Critical

| ID | Area | Finding | Severity |
|----|------|---------|----------|
| C1 | Authorization | `PATCH /api/team/members` accepted arbitrary roles including `owner` via `normalizeRole()`, which previously defaulted unknown values to `owner`. | Critical |
| C2 | Authorization | Workflow step reorder/insert in `POST /api/workflows/[id]/steps` did not verify the workflow belonged to the caller's organization before mutating steps. | Critical |
| C3 | Authorization | `POST /api/jobs/[id]/workflow` allowed attaching any `workflowTemplateId` and updating any `stepId` without org/workflow binding checks. | Critical |
| C4 | Authentication | Disabled accounts (`account_status = disabled`) were blocked on pages via middleware but could still call most `/api/*` routes with a valid session cookie. | Critical |
| C5 | RLS / Database | `profiles_update_own` allowed users to update `role`, `plan`, `subscription_status`, `account_status`, `stripe_customer_id`, and `organization_id` on their own row. | Critical |

### High

| ID | Area | Finding | Severity |
|----|------|---------|----------|
| H1 | Authorization | `GET /api/workflows` returned full workflow templates to any org member, including roles blocked in UI (`employee`, `contractor`, `viewer`, `client`). | High |
| H2 | Authorization | `POST /api/departments/[id]` (add member) did not verify the department or target user belonged to the organization. | High |
| H3 | Authorization | `POST /api/schedule/update` accepted `assigned_to` (worker) and `department_id` without org validation. | High |
| H4 | API (v1) | `POST /api/v1/jobs` accepted arbitrary `status` and `customer_id` without validation against org-scoped allowlists. | High |
| H5 | RLS | `customers_org`, `workers_org`, and similar `FOR ALL` policies allow **delete** for any org member on the read path, not only managers (defense-in-depth gap when using anon client). | High |

### Medium

| ID | Area | Finding | Severity |
|----|------|---------|----------|
| M1 | RLS | Legacy per-user policies (`jobs_own`, `customers_own`, etc.) may stack with org policies if incremental migrations were applied without cleanup, widening effective access. | Medium |
| M2 | RLS | `organization_settings` write policies in bootstrap SQL differ from `202606110001_organization_settings_owner_admin_write.sql` (owner/admin only). Production must run the migration. | Medium |
| M3 | Storage | `job-photos` bucket policies use first path segment as `auth.uid()`; org-scoped RBAC storage policies in later migrations partially supersede this — verify production has role-aware policies from `202605311600_rbac_roles.sql`. | Medium |
| M4 | Session | Auth cookies are session-only (good); idle timeout is 30 minutes. No server-side absolute session TTL beyond Supabase defaults. | Medium |
| M5 | Password reset | Reset flow uses Supabase `resetPasswordForEmail` with generic success message (no email enumeration). Recovery redirect goes to `/auth/callback?next=/reset-password&type=recovery`. | Low (positive) |

### Low / informational

| ID | Area | Finding | Severity |
|----|------|---------|----------|
| L1 | Environment | `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, and webhook secrets are server-only. Public config endpoint exposes anon key only (expected). | Info |
| L2 | Environment | `/api/admin/launch-status` reports env var **presence** (not values) to platform admins only via `ADMIN_EMAILS`. | Info |
| L3 | Authorization | Ownership transfer (`/api/team/transfer-ownership`) is correctly owner-only. Member delete/update blocks `role = owner`. | Info (positive) |
| L4 | API keys | `/api/v1/*` uses Bearer API keys with scoped permissions and plan gating; keys are hashed server-side. | Info (positive) |

---

## Fixes applied

### Application code

1. **`lib/role-assignment.ts`** — `parseAssignableMemberRole()` restricts team APIs to non-owner roles.
2. **`lib/roles.ts`** — `normalizeRole()` defaults unknown/null roles to `employee` instead of `owner`.
3. **`lib/org-validation.ts`** — Shared org-scoped validators for workflows, departments, users, customers, workers, and job statuses.
4. **`lib/api-session.ts`** — `requireApiSession()` helper for authenticated API guards (active account + org membership).
5. **`PATCH /api/team/members`** — Rejects `owner` and invalid roles; uses `parseAssignableMemberRole`.
6. **`POST /api/team/invite`** — Uses `parseAssignableMemberRole` consistently.
7. **`POST /api/workflows/[id]/steps`** — Verifies workflow org ownership before reorder/insert/delete; reorder fails on foreign steps.
8. **`POST /api/jobs/[id]/workflow`** — Validates `workflowTemplateId` and `stepId` against org-bound workflow.
9. **`POST /api/departments/[id]`** — Validates department and user org membership before membership changes.
10. **`POST /api/schedule/update`** — Validates `assigned_to` (worker) and `department_id` belong to org.
11. **`GET/POST /api/v1/jobs`** — Validates `status` against allowlist; validates `customer_id` org scope on create.
12. **`GET /api/workflows`** — Restricted to roles with `view_all_org_data` (matches UI/middleware).
13. **`middleware.ts`** — Session-authenticated `/api/*` routes (excluding public endpoints and `/api/v1/*`) now enforce disabled-account blocking.

### Database migration

14. **`supabase/migrations/202606120001_profiles_privileged_column_guard.sql`** — `BEFORE UPDATE` trigger blocks authenticated users from changing privileged profile columns; service role bypasses.

---

## Authentication & session handling (review)

| Control | Status |
|---------|--------|
| Login blocks disabled accounts | ✅ `app/api/auth/login` |
| Session cookies session-only (browser close ends session) | ✅ `lib/auth-cookies.ts` |
| Idle timeout (30 min) | ✅ `middleware.ts`, `components/session-guard.tsx` |
| Disabled account API block | ✅ `middleware.ts` (this audit) |
| Password reset anti-enumeration | ✅ Generic success message |
| Tab session sync / sign-out | ✅ `/api/auth/tab-session`, `/api/auth/sign-out` |

---

## Remaining recommendations

### Deploy immediately

1. **Run SQL migrations on production Supabase** (if not already applied):
   - `supabase/migrations/202606110001_organization_settings_owner_admin_write.sql`
   - `supabase/migrations/202606120001_profiles_privileged_column_guard.sql`

### Short term

2. **Split RLS write policies** — Replace `FOR ALL` org policies on `customers`, `workers`, `job_photos`, etc. with separate `INSERT`/`UPDATE`/`DELETE` policies requiring `can_manage_organization()` for destructive operations.
3. **Drop legacy `*_own` policies** on org-migrated tables after confirming no single-user tenants depend on `user_id`-only access.
4. **Adopt `requireApiSession()`** across remaining session-authenticated API routes for consistent guards.
5. **Add integration tests** — RLS + API authorization tests against a staging Supabase project.

### Medium term

6. **Enable Supabase Auth** leaked-password protection and MFA for platform admin accounts.
7. **Rate limiting** — Login, password reset, and team invite endpoints (Vercel WAF or Upstash).
8. **Audit logging** — Log failed authorization attempts on admin/service-role routes.
9. **CSP headers** — Tighten Content-Security-Policy in `next.config.mjs` for production.
10. **API key rotation UX** — Surface last-used timestamp and one-click revoke in Settings.

---

## Files changed in this audit

- `lib/role-assignment.ts` (new)
- `lib/org-validation.ts` (new)
- `lib/api-session.ts` (new)
- `lib/roles.ts`
- `middleware.ts`
- `app/api/team/members/route.ts`
- `app/api/team/invite/route.ts`
- `app/api/workflows/route.ts`
- `app/api/workflows/[id]/steps/route.ts`
- `app/api/jobs/[id]/workflow/route.ts`
- `app/api/departments/[id]/route.ts`
- `app/api/schedule/update/route.ts`
- `app/api/v1/jobs/route.ts`
- `supabase/migrations/202606120001_profiles_privileged_column_guard.sql` (new)
- `SECURITY_REPORT.md` (this file)

---

*This report supersedes portions of `docs/SECURITY_RLS_AUDIT.md` regarding onboarding middleware (onboarding is now optional) and reflects the current `main` branch as of the audit commit.*
