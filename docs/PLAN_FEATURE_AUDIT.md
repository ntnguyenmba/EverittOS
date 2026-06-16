# EverittOS Plan Feature Audit

Last updated: 2026-06-10 (Operations tier removed)

Central config: `lib/plan-config.ts` with helpers in `lib/plan-helpers.ts`, `lib/plan-access.ts`, `lib/plan-validate.ts`, `lib/plan-enforce-server.ts`.

DB mirror: `plan_tier_limits` (migration `202606210001_plan_tier_alignment.sql`, removal `202608220001_remove_operations_plan.sql`).

Status key: **Built** | **Partial** | **Missing** | **Fixed in this pass**

---

## Plan limits (enforced)

| Resource | Free | Pro | Business | Growth | Enterprise |
|----------|------|-----|----------|--------|------------|
| Jobs | 3 | 25 | 150 | 2,500 | Unlimited |
| Customers | 10 | 100 | 1,000 | 25,000 | Unlimited |
| Users | 1 | 3 | 15 | 250 | Unlimited |
| Photos | 20 | 100 | Unlimited | Unlimited | Unlimited |
| Reports | 0 | Unlimited | Unlimited | Unlimited | Unlimited |

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
| Workflows / Portals | Missing | Gated to Growth+ |

---

## Pro ($9)

| Feature | Status | Notes |
|---------|--------|-------|
| Everything in Free (expanded limits) | Built | 25 jobs, 100 customers, 3 users |
| Before/after photos | Built | **Fixed in this pass** (Pro+ only) |
| Professional job records | Built | Notes, checklist, timeline |
| Standard reports | Built | **Fixed in this pass** (Free blocked) |
| Photo cap 100 | Built | **Fixed in this pass** (was unlimited) |
| Client portal | Missing on Pro | **Fixed in this pass** (Growth+ only; billing copy updated) |
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
| Workflows | Missing | Growth+ |

---

## Growth ($399)

| Feature | Status | Notes |
|---------|--------|-------|
| Everything in Business | Built | |
| Workflows | Built | Growth+ |
| Client portal | Built | RLS + server routes |
| Contractor portal | Built | Assigned work only |
| Branded reports / branding | Built | Growth+ |
| Role-based permissions | Built | RBAC in middleware + RLS |
| Priority support language | Built | In plan marketing copy |
| Departments | Built | Growth+ |
| API access | Built | `/settings/api`, `/api/v1/*`, API keys |
| Multi-location foundation | Partial | `organization_locations`, location caps; selector when multiple |
| Operational dashboards | Partial | Analytics page; executive metrics component exists but not on dashboard |

---

## Enterprise ($799)

| Feature | Status | Notes |
|---------|--------|-------|
| Unlimited jobs/customers/users | Built | Caps = -1 |
| Multi-location | Built | Unlimited locations |
| Custom branding | Built | Logo, colors in settings |
| Enterprise permissions | Partial | Role matrix; dedicated onboarding fields in settings |
