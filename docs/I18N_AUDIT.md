# i18n audit status (EverittOS)

Last updated: 2026-05-31

## Locales

- `en` (default), `es`, `vi`
- Catalog parity enforced in `tests/i18n.test.ts` via `lib/i18n/collect-keys.ts`

## Completed in this pass

| Area | Status |
|------|--------|
| Dashboard revenue metrics | All 12 metric labels use `dashboard.revenue.*` |
| Dashboard header + help strip | `dashboard.navSubtitle`, `supportTraining.*` |
| Toast feedback (`useAppFeedback`) | `feedback.*` keys; locale-aware on switch |
| Nav labels | `inventory`, `routes`, `photos` added to `nav` + `nav-i18n.ts` |
| Post-v1 pages | `invoices`, `messages`, `inventory`, `routes` page headers |
| Post-v1 panels | `recurring-invoices`, `customer-messages`, `quickbooks` |
| Customer/job detail access errors | `pages.customers.notFound`, `pages.jobs.notFound` |

## Remaining hardcoded English (not yet wired)

These areas still contain user-facing English outside the translation system:

### High priority
- `components/outbound/outbound-hub.tsx` — invoice/estimate compose UI
- `app/jobs/page.tsx`, `app/jobs/[id]/page.tsx` — most action buttons and section labels
- `app/customers/page.tsx`, `app/customers/[id]/page.tsx` — forms and tables (except not-found)
- `app/bookings/page.tsx` — booking management UI
- `app/expenses/page.tsx` — expense forms and table headers
- `components/job-photos-section.tsx`, `components/job-creator.tsx` — job workflows
- Auth pages: `app/login`, `signup`, `forgot-password`, `reset-password`
- `app/layout.tsx` — document metadata (title/description)

### Medium priority
- Settings sub-pages with `FEEDBACK.loading` + English button labels
- `components/team/team-management-panel.tsx`
- Portal pages (`app/portal/*`)
- Legal/marketing static pages
- `lib/feedback-labels.ts` — still used directly in ~40 components for `FEEDBACK.loading` busy states

### Low priority / acceptable
- API error strings returned from server (shown raw when not mapped)
- Stripe/legal copy noted in `language.note`
- Proper nouns: EverittOS, Ask Everitt, QuickBooks, Google Calendar

## Switching languages

Locale is stored in `localStorage` + cookie. `LocaleProvider` re-renders all `useTranslation()` consumers immediately. Components that still import `FEEDBACK` from `lib/feedback-labels.ts` directly will show English busy labels until migrated to `useAppFeedback().feedbackMessage('loading')` or `t('feedback.loading')`.

## Organization data sharing (paired audit)

See migration `202609050001_team_work_photos_reports_rls.sql` and fixes in:

- `app/schedule/page.tsx` — `scopeJobsForWorkspace` with role
- `components/schedule-create-form.tsx` — passes workspace role
- `app/customers/[id]/page.tsx`, `app/jobs/[id]/page.tsx` — `canAccessWorkspaceRecord`
- `lib/customers-query.ts`, `lib/workspace-record-access.ts` — shared scoping helpers

Owners/admins/managers see all org-scoped records per RLS (`can_manage_org_work`). Staff see org records they created or are assigned to.
