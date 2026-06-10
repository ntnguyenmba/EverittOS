# EverittOS launch gap report

Generated from pricing page and codebase audit. Status: **Functional** = works end to end in app with migrations applied. **Partial** = UI or DB only. **Missing** = not built.

| Promised feature | Status | Notes |
|------------------|--------|-------|
| Free: 3 jobs | Functional | `plan_tier_limits` + triggers + UI |
| Free: 10 customers | Functional | Same |
| Free: 1 user | Functional | Team invite blocked on Free |
| Free: no photos | Functional | `photoUpload: false` + DB trigger |
| Pro: 25 jobs, 100 customers, 3 users | Functional | Owner plan enforced server-side |
| Pro: photos | Functional | Pro+ only |
| Business: team, crew, 150/1000/15 limits | Functional | Business+ |
| Operations: client + contractor portals | Functional | Portals + job grant/revoke + portal token links |
| Operations: branded reports | Functional | Branded header, plan-gated photos, print/PDF |
| Growth: API access | Functional | API keys + `/api/v1/*` routes |
| Growth: custom workflows | Functional | Templates, steps, job progress UI |
| Growth: department visibility | Functional | Departments + memberships + settings UI |
| Enterprise: unlimited limits | Functional | `-1` caps in config |
| Stripe checkout upgrade | Functional | Payment Links + webhook |
| Stripe downgrade/cancel | Functional | Webhook + billing portal + cancel API |
| Stripe billing portal | Functional | `/api/stripe/portal` when `stripe_customer_id` exists |
| Stripe failed payment | Functional | `invoice.payment_failed` sets `past_due` |
| Forgot password | Functional | `resetPasswordForEmail` + production URL in `app-url` |
| Reset password | Functional | PKCE `code` exchange + expired message |
| Email verification | Functional | Callback route + verified login message |
| Team invite email | Functional | Resend optional; copy link fallback |
| Team revoke | Functional | `/api/team/invitations/revoke` |
| Client invite | Functional | Grant/revoke + accept auto-links job |
| Role isolation | Partial | RLS + server routes; verify in Supabase after migrate |
| Storage private buckets | Functional | `job-photos`, `org-logos` private RLS |
| Platform metrics (investor) | Functional | `/admin/platform` + `ADMIN_EMAILS` |
| Drag-drop scheduling | Functional | Drag to day + date fallback + unscheduled list |
| PDF download file | Partial | Browser print labeled as PDF export (no server PDF lib) |

## Recommended fixes before public launch

1. Apply all migrations through `202605370001_launch_growth_features.sql`.
2. Configure Stripe webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
3. Enable Stripe Customer Portal in Dashboard.
4. Set `ADMIN_EMAILS` and test `/admin/platform`.
5. Configure Supabase email templates and redirect URLs for production.
6. Optionally set `RESEND_API_KEY` and `EMAIL_FROM` for transactional invites.
7. Run `supabase/demo_seed.sql` manually for investor walkthrough (see `docs/DEMO_SEED.md`).
