# i18n audit status (EverittOS)

Last updated: 2026-07-31

## Locales

- `en` (default), `es`, `vi`
- Catalog parity: `npm run i18n:audit` (`scripts/i18n-audit.ts`)
- Hardcoded UI phrase scan: `npm run i18n:ui-audit` (`scripts/i18n-hardcoded-ui-audit.ts`)
- Combined: `npm run i18n:check`

## Architecture

- `LocaleProvider` persists locale in `localStorage` + cookie (`everittos_locale`)
- Nested catalogs: `lib/i18n/messages/{en,es,vi}.ts` via `t()`
- Typed helpers: `lib/i18n/*-copy.ts` (billing-ops, export, receipt, auth, job detail/finance, etc.)
- API errors: prefer `code` + `lib/i18n/api-error-copy.ts` (`resolveApiError`)
- Visible money/dates: `lib/i18n/locale-format.ts`
- Busy/toast labels: locale-aware `FEEDBACK` proxy + `t('feedback.*')`

## Completed in this pass

| Area | Status |
|------|--------|
| Outbound hub/composer/list/tabs/autosave | Localized via `getBillingOpsCopy` |
| Invoices / receipts pages | Outstanding balances, payment connections, loading |
| Prefill API subjects/bodies | Locale query param + localized templates |
| Payment API error codes | `code` fields for client mapping |
| Jobs table | Local copy maps EN/ES/VI; silent auto-refresh |
| Exports | Existing `getExportCopy` EN/ES/VI |
| Receipt actions | Localized share/download chrome |
| Feedback busy labels | Locale-aware `FEEDBACK` |

## Remaining / lower priority English

These may still show English as API fallbacks (`json.error || '…'`) until each screen maps codes:

- Admin diagnostics / metrics / platform pages
- Bookings, services, availability, forms, templates, teams, referrals
- Some settings sub-pages button labels (Save branding, Update password, …)
- Marketing/legal static pages
- Estimate page description

Proper nouns kept intentionally: EverittOS, Ask Everitt, QuickBooks, Google Calendar, Stripe, Zelle, Venmo, ACH.
