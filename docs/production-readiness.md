# Production readiness

Last verified on branch `main` after the financial dashboard and mobile subscription readiness pass.

## Build status

| Check | Status |
|-------|--------|
| `npm run typecheck` | See latest agent run |
| `npm run lint` | Pass with existing hook/image warnings |
| `npm test` | Pass |
| `npm run build` | Pass |
| `npx cap sync ios` | Run on this host when validating |
| `npx cap sync android` | Run on this host when validating |
| iOS Xcode compile | Requires macOS + Xcode |
| Android `assembleDebug` | Requires Android SDK |

## Database migrations to apply

1. `supabase/migrations/202609100001_store_billing_subscriptions.sql` (store entitlements)
2. `supabase/migrations/202609110001_invoice_payments_ledger.sql` (payment ledger + backfill)
3. `supabase/migrations/202607200001_job_payments_customer_photo_reports.sql` (direct job payments + customer photo reports)
4. `supabase/migrations/202609120001_editable_invoice_payments.sql` (editable invoice ledger + reconcile triggers)

Apply in Supabase before relying on period-accurate Paid to you, direct job payments, payment edit/delete, or customer report share links. The dashboard falls back to invoice summary fields if the invoice ledger table is missing.

## Environment variables

See `.env.example`. Groups:

* Supabase (public + server-only)
* App URL
* Stripe web billing
* Apple subscriptions (server-only keys)
* Google Play subscriptions (server-only service account)
* Capacitor / native
* Optional AI and integrations

Never prefix Apple private keys, Google service-account JSON, Stripe secrets, or Supabase service-role keys with `NEXT_PUBLIC_`.

## Known issues

* Android/iOS signed store uploads still require owner console products, signing, and screenshots.
* Payment ledger backfill uses a single legacy row per invoice; historical partial-payment dates before the ledger existed cannot be reconstructed.
* Expenses have no unpaid/pending state; expense `date` is treated as cash date.

## Deployment steps

1. Apply pending Supabase migrations
2. Set production env vars on Vercel
3. Deploy web build
4. `npx cap sync ios` / `npx cap sync android`
5. Archive / bundle with store signing on a developer machine

## Rollback steps

1. Revert the release commit on `main` or redeploy the prior Vercel deployment
2. Do not drop `invoice_payments` if live payments were recorded; leave the table in place
3. Store webhook endpoints can remain registered while inactive
