# Final Release Audit

Audit date: 2026-07-14  
Branch: `main`  
App: https://app.everittventures.com

## Issues

| Area | File | Current | Expected | Severity | Fix | Validation | Status |
|------|------|---------|----------|----------|-----|------------|--------|
| Invoice PATCH truncated | `app/api/invoices/[id]/route.ts` | Missing success return | Return `{ invoice }` | Critical | Restored return | Build + tests | Fixed |
| Cash migration truncated | `supabase/migrations/202607140004_dashboard_cash_revenue_metrics.sql` | Mid-statement | Complete IF NOT EXISTS DDL | Critical | Completed file + `202609090001` | SQL doc | Fixed |
| Login connectivity probe | `app/api/auth/login/route.ts` | Always probed before auth | Auth request is connectivity | High | Removed probe | Login tests | Fixed |
| Login duplicate workspace | same | ensure + getCurrentWorkspace repair | Bootstrap only | High | Removed repair call | Manual | Fixed |
| Login blocking analytics | same | Awaited DB logs | Timeout-bounded side effects | High | `Promise.allSettled` + timeout | Manual | Fixed |
| Dashboard timezone | `lib/dashboard-metrics.ts` | `toISOString().slice` | Local date-only | High | `formatLocalDateOnly` | Unit tests | Fixed |
| Cancelled pending | same | Included in pending | Excluded | High | Skip cancelled | Logic review | Fixed |
| Cash anti-pattern elsewhere | `lib/finance-server.ts`, search engine | `paid or amount` | amount_paid / booked amount only | High | Removed fallback | Grep | Fixed |
| Native website purchase CTA | billing grid / checkout button | Directed to app.everittventures.com | No purchase direction | Critical | Neutral notice only | Grep | Fixed |
| Ask Everitt native upsell | `ask-everitt-command.tsx` | View plans / modal | Hide AI / no upsell | Critical | `ask-everitt-ui-access` | Unit tests | Fixed |
| Native billing page | `settings/billing` | Plans/checkout UI | Neutral account access | Critical | Early native render | Code review | Fixed |
| Owner-contractor $0 | contractor compensation | Zero-pay support | Remains zero | Medium | Verified existing | Existing tests | Already complete |
| Capacitor / PWA | ios/android/public | Present | Release-ready config | Medium | Prior Phase 27 | Sync | Already complete |
| Physical device QA | — | Not run | Device matrix | High | Documented | Matrix | Physical device testing required |
| Apple/Google signing | — | Missing | Store upload | High | External | Docs | External setup required |
| AASA Team ID / assetlinks SHA | `.well-known` | Placeholders | Real values | High | Owner | Domain deploy | External setup required |

## Overall

Code fixes for truncated files, login latency, finance correctness, and native store-safe account access are complete on `main`. Remaining work is external (Supabase SQL apply, signing, physical devices, store consoles).
