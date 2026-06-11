# EverittOS funding readiness

This document summarizes enterprise, security, analytics, and investor capabilities added for funding discussions, accelerator applications, strategic partnerships, and commercial sales.

Production app: https://app.everittventures.com

## Features completed

### Enterprise team management
- `/team` and `/settings/team` — invite by email, resend/revoke invitations, role assignment, deactivate/reactivate, remove members, ownership transfer
- Permission matrix for Owner, Admin, Manager, Technician, Client
- Team audit history on settings team page
- RBAC enforced via `lib/permissions.ts`, `middleware.ts`, and API routes

### Audit trail
- `/activity` — organization timeline with search, event type filter, user filter, and date range filters
- Server-side logging via `lib/activity-server.ts` for auth, team, and operational events
- `activity_logs` table with timestamp, user, organization, event_type, metadata

### Executive dashboard
- Owner/admin executive widgets on `/dashboard`: MRR, ARR, active users, monthly jobs, technician utilization, revenue growth, client activity, report completion, subscription breakdown
- Trend charts for jobs, revenue, and team growth
- `/api/org/metrics` org-scoped API

### Investor metrics center
- `/admin/metrics` — platform-wide MRR, ARR, customers, churn, trial conversion, ARPA, retention, monthly growth
- CSV export at `/api/admin/metrics/export`
- Restricted to `ADMIN_EMAILS` platform operators

### Analytics system
- `/analytics` — adoption, usage, and growth metrics (30-day window)
- `/api/analytics/summary` internal analytics layer
- `product_events` tracking for signup, onboarding, jobs, billing, portal usage
- Google Analytics wired via `AnalyticsGate` on marketing pages

### Demo mode
- `/demo` — full demo entry with isolated sample workspace
- `/api/demo/enter` seeds demo company, technicians, clients, jobs via `organizations.is_demo`
- **View demo** CTA on landing page
- Demo banner when viewing demo organization data

### White labeling
- `/settings/branding` — company name, logo, primary/secondary colors, support email
- Branding stored in `organization_settings` (`brand_primary_color`, `brand_accent_color`, `logo_path`)
- Applies to client portal surfaces, reports, invite emails, and dashboard preview

### Security hardening
- Session idle timeout + warning (existing, verified)
- Login rate limiting and failed login tracking
- `security_events` table with org admin review on `/settings/security`
- Login/logout security event logging from auth API routes
- RLS on tenant tables; API authorization on Stripe and team routes

### Onboarding system
- `/onboarding` six-step wizard (company, team, client, job, photo, report)
- Completion percentage via `onboarding_step` / `onboarding_completed` on dashboard checklist
- Product event tracking per step

### Email automation
- Branded HTML templates in `lib/email-templates.ts`: welcome, invite, invitation accepted, trial ending, payment failed, subscription activated/canceled, report available, job assigned
- Resend integration for team and client invites

### Mobile audit
- Responsive tables, touch targets (44px), filter grids, and navigation overflow fixes in `globals.css`
- `AppShell` + `MobileNav` on new enterprise pages

### Platform status center
- `/admin/status` — database health, API health, storage usage, active users, organization count, recent security events
- `/admin/launch-status` — launch readiness score (existing)

## Security controls

| Control | Implementation |
|---------|----------------|
| Authentication | Supabase Auth, server login route, session cookies |
| Authorization | RBAC permissions, middleware route gates, API role checks |
| Session timeout | Idle enforcement client + server |
| Rate limiting | Login, signup, reset, team invite, API v1 |
| Audit logging | `activity_logs`, `security_events` |
| Secrets | Service role and Stripe keys server-only |
| Tenant isolation | Supabase RLS on org-scoped tables |

## Analytics capabilities

- Organization analytics dashboard (`/analytics`)
- Executive org metrics (`/api/org/metrics`)
- Product event pipeline (`product_events`)
- Platform investor metrics (`/admin/metrics`)

## Enterprise capabilities

- Multi-role team management with permission matrix
- Organization branding and white-label settings
- Activity and security audit trails
- Demo environment for sales and investor walkthroughs

## Investor metrics available

- MRR / ARR estimates
- Active and total customers
- Churn and retention rates
- Trial conversion rate
- ARPA and average users per organization
- Monthly growth and subscription breakdown
- CSV export for diligence

## Env vars to verify

See `docs/LAUNCH_AUTH_CHECKLIST.md` for auth and billing env vars. Additional:

| Variable | Purpose |
|----------|---------|
| `ADMIN_EMAILS` | Platform admin access to `/admin/*` |
| `RESEND_API_KEY` / `EMAIL_FROM` | Branded transactional email |

## Database migration

Run `supabase/migrations/202606150001_enterprise_funding_readiness.sql` for:
- `organizations.is_demo`
- `security_events` table + RLS

## Manual verification checklist

1. `/settings/team` — invite, role change, deactivate, permission matrix
2. `/activity` — filters and search
3. `/dashboard` — executive widgets (owner/admin)
4. `/admin/metrics` — KPIs + CSV export (platform admin)
5. `/analytics` — usage charts
6. `/demo` — enter demo, confirm banner and sample data
7. `/settings/branding` — save colors and logo
8. `/settings/security` — security audit events after login/logout
9. `/admin/status` — health overview
