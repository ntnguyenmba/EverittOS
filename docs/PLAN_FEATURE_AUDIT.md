# EverittOS Plan Feature Audit

Last updated: 2026-05-31 (plan alignment pass)

Central config: `lib/plan-config.ts` with helpers in `lib/plan-helpers.ts`, `lib/plan-access.ts`, `lib/plan-validate.ts`, `lib/plan-enforce-server.ts`.

DB mirror: `plan_tier_limits` (migration `202606210001_plan_tier_alignment.sql`).

Status key: **Built** | **Partial** | **Missing** | **Fixed in this pass**

---

## Plan limits (enforced)

| Resource | Free | Pro | Business | Operations | Growth | Enterprise |
|----------|------|-----|----------|------------|--------|------------|
| Jobs | 3 | 25 | 150 | 500 | 2,500 | Unlimited |
| Customers | 10 | 100 | 1,000 | 5,000 | 25,000 | Unlimited |
| Users | 1 | 3 | 15 | 50 | 250 | Unlimited |
| Photos | 20 | 100 | Unlimited | Unlimited | Unlimited | Unlimited |
| Reports | 0 | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |

---

## Free

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard | Built | Real metrics, schedule, plan usage, quick links |
| Jobs (CRUD, tasks, notes) | Built | Plan limits enforced on create |
| Customers | Built | 10 customer cap |
| Schedule | Built | Included on all tiers |
| Notifications | Built | DB-backed, read/unread |
| Billing | Built | Shows Free plan, upgrade links |
| Settings | Built | Workspace, account, security, integrations |
| Photo uploads (basic) | Built | 20 photo cap; no before/after comparison |
| PDF reports | Missing on Free | **Fixed in this pass** (`pdfReports: false`, reports cap 0) |
| Before/after comparison | Missing on Free | **Fixed in this pass** (`beforeAfterPhotos: false`) |
| Workers / Team | Missing | Gated to Business+ |
| Activity / Analytics | Missing | Gated to Business+ |
| Workflows / Portals | Missing | Gated to Operations+ |

---

## Pro ($9)

| Feature | Status | Notes |
|---------|--------|-------|
| Everything in Free (expanded limits) | Built | 25 jobs, 100 customers, 3 users |
| Before/after photos | Built | **Fixed in this pass** (Pro+ only) |
| Professional job records | Built | Notes, checklist, timeline |
| Standard reports | Built | **Fixed in this pass** (Free blocked) |
| Photo cap 100 | Built | **Fixed in this pass** (was unlimited) |
| Client portal | Missing on Pro | **Fixed in this pass** (Operations+ only; billing copy updated) |
| Workers / Team | Missing | Business+ |

---

## Business ($39)

| Feature | Status | Notes |
|---------|--------|-------|
| Everything in Pro | Built | |
| Workers | Built | Crew cap 100 |
| Team + invitations | Built | Invite link fallback when email not configured |
| Activity feed | Built | Real `activity_logs` only |
| Analytics | Built | Real counts; API gated Business+ **Fixed in this pass** |
| Job assignments | Built | |
| Internal notes | Built | Role-gated |
| Customer history | Built | Linked jobs/reports on customer detail |
| Advanced reporting | Built | **Fixed in this pass** (DB `advanced_reporting: true`) |
| Workflows | Missing | Operations+ |

---

## Operations ($149)

| Feature | Status | Notes |
|---------|--------|-------|
| Everything in Business | Built | |
| Workflows | Built | **Fixed in this pass** (was incorrectly Growth-only in UI/API) |
| Client portal | Built | RLS + server routes |
| Contractor portal | Built | Assigned work only |
| Branded reports / branding | Built | **Fixed in this pass** (copy aligned to Operations+) |
| Role-based permissions | Built | RBAC in middleware + RLS |
| Priority support language | Built | In plan marketing copy |

---

## Growth ($399)

| Feature | Status | Notes |
|---------|--------|-------|
| Everything in Operations | Built | |
| Departments | Built | Growth+ |
| API access | Built | `/settings/api`, `/api/v1/*`, API keys |
| Multi-location foundation | Partial | `organization_locations`, location caps; selector when multiple |
| Custom workflows (marketing) | Partial | Same workflow system as Operations; Growth adds departments/API |
| Operational dashboards | Partial | Analytics page; executive metrics component exists but not on dashboard |

---

## Enterprise ($799)

| Feature | Status | Notes |
|---------|--------|-------|
| Unlimited jobs/customers/users | Built | Caps = -1 |
| Multi-location | Built | Unlimited locations |
| Custom branding | Built | Logo, colors in settings |
| Enterprise permissions | Partial | Role matrix; dedicated onboarding fields in settings |
| Custom reporting structure | Partial | Branded PDF reports; no fully custom report builder |
| Dedicated onboarding | Partial | Support-oriented fields; not a managed service flow |

---

## Cross-cutting areas

| Area | Status | Notes |
|------|--------|-------|
| Central plan config | **Fixed in this pass** | `lib/plan-config.ts`, `lib/plan-helpers.ts` |
| Middleware route gates | **Fixed in this pass** | workers, workflows, portals, API |
| DB plan_tier_limits sync | **Fixed in this pass** | Migration `202606210001` |
| RLS on protected tables | Built | Org-scoped; client/contractor policies |
| Stripe billing | Built | Preserved checkout links; portal/cancel/resume routes with fallback |
| Webhook plan updates | Built | `app/api/stripe/webhook` updates org plan |
| Account disable | Built | `account_status = disabled`; middleware blocks |
| Google Calendar integrations | Built | Settings > Integrations states |
| Onboarding | Built | Industries, skip/cancel, restart from settings |
| i18n (en/es/vi) | Partial | Core nav, dashboard, settings; legal/billing may stay English |
| Demo/fake data | **Fixed in this pass** | Demo guard, seed filters, cleanup migration; no production seed |
| `/book` public booking | Missing | Stub only; not a gated SaaS tier feature |

---

## Removed / blocked fake data

- Demo workers: Jordan Lee, Marcus Reed, Sophia Nguyen, Daniel Brooks (filtered + cleanup SQL)
- Sample jobs and fake dashboard metrics removed
- `demo@everittventures.com` / `512-555-*` patterns blocked in production
- Analytics and activity feeds use real DB records only

---

## Supabase actions still required (manual)

1. Run migration `202606210001_plan_tier_alignment.sql` in production Supabase.
2. Run `202606200001_remove_production_demo_seed.sql` if not already applied.
3. Verify Stripe webhook secret and billing portal env vars in deployment host.
4. Confirm RLS policies active on all org tables after migration.

---

## Remaining partial gaps

- Executive metrics component (`components/dashboard/executive-metrics.tsx`) is built but not mounted on dashboard (intentionally simplified UI).
- Full i18n coverage for every page string.
- `/book` online booking page not implemented.
- Enterprise "custom reporting structure" is foundational (branded PDFs), not a report designer.
- Email invite delivery depends on SMTP/env configuration; copy-link fallback works.
