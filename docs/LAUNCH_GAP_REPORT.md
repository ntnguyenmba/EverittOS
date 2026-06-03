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
| Operations: client + contractor portals | Partial | Portals exist; client needs `job_client_access` grant |
| Operations: branded reports | Partial | Print report; branded styling limited |
| Growth: API access | Missing | Flag only; no API keys/routes |
| Growth: custom workflows | Missing | Flag only |
| Growth: department visibility | Missing | Not implemented |
| Enterprise: unlimited limits | Functional | `-1` caps in config |
| Stripe checkout upgrade | Functional | Payment Links + webhook |
| Stripe downgrade/cancel | Partial | Webhook handles subscription.deleted; use Billing Portal |
| Stripe billing portal | Functional | `/api/stripe/portal` (requires `stripe_customer_id`) |
| Stripe failed payment | Partial | `invoice.payment_failed` sets `past_due` |
| Forgot password | Functional | `resetPasswordForEmail` + production URL in `app-url` |
| Reset password | Functional | PKCE `code` exchange + expired message |
| Email verification | Partial | Supabase sends; callback route exists |
| Team invite email | Partial | Returns accept URL; no transactional email provider |
| Team revoke | Functional | `/api/team/invitations/revoke` |
| Client invite | Partial | `/api/clients/grant-access` + invite flow |
| Role isolation | Partial | RLS + UI; verify in Supabase after migrate |
| Storage private buckets | Functional | `job-photos`, `org-logos` private RLS |
| Platform metrics (investor) | Functional | `/admin/platform` + `ADMIN_EMAILS` |
| Drag-drop scheduling | Missing | Calendar views only |
| PDF download file | Partial | Browser print on report page |

## Recommended fixes before public launch

1. Apply all migrations through `202605350001`.
2. Configure Stripe webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
3. Enable Stripe Customer Portal in Dashboard.
4. Set `ADMIN_EMAILS` and test `/admin/platform`.
5. Configure Supabase email templates and redirect URLs for production.
6. Seed demo company for investor walkthrough.
