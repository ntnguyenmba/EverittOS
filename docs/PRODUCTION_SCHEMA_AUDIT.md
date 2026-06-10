# EverittOS Production Schema Audit

**Project:** Everitt OS (`wxtatzlirexrwjehqgak`)  
**Date:** 2026-06-10  
**Branch policy:** Work on `main` only

## Branches detected (do not use)

| Branch | Status |
|--------|--------|
| `cursor/everittos-auth-account-e9ca` | Remote feature branch — not used |
| `cursor/legacy-bootstrap-e9ca` | Remote feature branch — not used |
| `cursor/supabase-full-setup-e9ca` | Remote feature branch — not used |

---

## 1. Existing database objects (legacy schema)

Reported by operator on project `wxtatzlirexrwjehqgak`:

### Tables
| Table | Purpose (legacy) |
|-------|------------------|
| `profiles` | Auth-linked user profile |
| `jobs` | Job/work orders |
| `customers` | CRM contacts |
| `invoices` | Billing records |
| `workers` | Workforce roster |
| `technicians` | Legacy technician roster |
| `job_photos` | Job photo metadata |
| `activity_events` | Legacy activity feed |
| `ai_generations` | Legacy AI usage log |
| `companies` | Legacy company/tenant data |

### Views
None reported in legacy schema.

### Functions / triggers / policies
Legacy schema likely has minimal or owner-only RLS. Newer incremental migrations **fail** because they reference tables that do not exist (`business_profiles`, `organizations`, etc.).

---

## 2. Missing database objects (required by current app)

### Core identity
| Object | Status |
|--------|--------|
| `business_profiles` | **Missing** |
| `profiles.organization_id` | **Missing** |
| `profiles.account_status` | **Missing** |
| `profiles.plan` / `subscription_status` / `stripe_customer_id` | **May be missing** |

### Organizations & team
| Object | Status |
|--------|--------|
| `organizations` | **Missing** |
| `organization_settings` | **Missing** |
| `organization_members` | **Missing** |
| `organization_invitations` | **Missing** |
| `organization_locations` | **Missing** |
| `departments` | **Missing** |
| `department_memberships` | **Missing** |

### Operations
| Object | Status |
|--------|--------|
| `job_assignments` | **Missing** |
| `job_timeline` | **Missing** |
| `job_reports` | **Missing** |
| `job_checklist_items` | **Missing** |
| `job_client_access` | **Missing** |
| `customer_properties` | **Missing** |
| `activity_logs` | **Missing** (distinct from `activity_events`) |
| `notifications` | **Missing** |
| `crews` | **Missing** |
| `workflow_templates` / `workflow_steps` / `job_workflow_progress` | **Missing** |
| `api_keys` | **Missing** |
| `plan_tier_limits` | **Missing** |

### Subscriptions
| Object | Status |
|--------|--------|
| `everittos_subscriptions` | **Missing** |
| `subscription_events` | **Missing** |
| `product_events` | **Missing** |

### Columns on existing tables
| Table | Missing columns |
|-------|-----------------|
| `jobs` | `organization_id`, scheduling, priority, workflow/department FKs |
| `customers` | `organization_id`, `department_id` |
| `workers` | `organization_id`, `auth_user_id`, `department_id` |
| `job_photos` | `storage_path`, `label`, `organization_id` |
| `invoices` | `organization_id`, `job_id`, `client_user_id` (for client portal) |

### Functions & triggers
| Object | Status |
|--------|--------|
| `handle_new_user` | **Missing or outdated** |
| Plan limit triggers | **Missing** |
| Org helper functions (`is_org_member`, etc.) | **Missing** |

### Storage
| Bucket | Status |
|--------|--------|
| `job-photos` | **May be missing policies** |
| `org-logos` | **Missing** |

---

## 3. Missing auth objects

| Requirement | App support | DB requirement |
|-------------|-------------|----------------|
| Signup | `app/signup/page.tsx` | `handle_new_user` trigger |
| Login | `app/login/page.tsx` | `profiles` row |
| Logout | Settings + API | None |
| Forgot password | `app/forgot-password/page.tsx` | Supabase Auth config |
| Reset password | `app/reset-password/page.tsx` | Redirect URLs |
| Email verification | `app/auth/callback/route.ts` | Redirect URLs |
| Protected routes | `middleware.ts` | `profiles.account_status`, plan |
| Session persistence | Supabase SSR cookies | None |
| Account disable | `profiles.account_status` | Column + middleware check |

---

## 4. Missing subscription objects

| Requirement | Tables / columns |
|-------------|------------------|
| Stripe checkout | Payment links + `profiles.stripe_customer_id` |
| Webhook | `everittos_subscriptions`, `subscription_events`, `profiles.plan` |
| Plan upgrades/downgrades | Webhook handlers in `app/api/stripe/webhook/route.ts` |
| Feature gating | `plan_tier_limits` + `lib/plan-config.ts` + triggers |
| Billing portal | `profiles.stripe_customer_id` |

---

## 5. Missing team management objects

| Requirement | Implementation |
|-------------|----------------|
| Organizations | `organizations` + backfill from existing users |
| Teams | `organization_members` + `departments` (Growth+) |
| Members | `organization_members`, invitations |
| Roles | Owner, Admin, Manager, Employee, Contractor, Viewer, Client |
| Permissions | `lib/permissions.ts` (app) + RLS (DB) |
| Contractor isolation | RLS + assignment-scoped queries |

---

## Remediation

**Single production migration:** [`supabase/production_bootstrap.sql`](../supabase/production_bootstrap.sql)

Run once in Supabase SQL Editor on project `wxtatzlirexrwjehqgak`.

Properties:
- Idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, policies only when missing)
- Preserves legacy tables (`invoices`, `technicians`, `activity_events`, `ai_generations`, `companies`)
- Backfills organizations from existing `profiles` / `companies`
- Adds viewer role and client-facing RLS for reports, customers, invoices

---

## Application tables required (29 total)

`profiles`, `business_profiles`, `organizations`, `organization_settings`, `organization_members`, `organization_invitations`, `organization_locations`, `plan_tier_limits`, `customers`, `customer_properties`, `workers`, `jobs`, `job_assignments`, `job_photos`, `job_timeline`, `job_reports`, `job_checklist_items`, `job_client_access`, `activity_logs`, `notifications`, `everittos_subscriptions`, `subscription_events`, `product_events`, `api_keys`, `workflow_templates`, `workflow_steps`, `job_workflow_progress`, `departments`, `department_memberships`

**Reused legacy table:** `invoices` (columns added, not duplicated)

**Legacy-only (preserved, not used by app):** `technicians`, `activity_events`, `ai_generations`, `companies`
