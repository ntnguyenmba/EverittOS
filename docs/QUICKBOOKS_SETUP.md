# QuickBooks integration

QuickBooks is **optional**. EverittOS is an operations platform and sync tool — not accounting, tax, payroll, bookkeeping, reconciliation, or financial advisory software. **QuickBooks remains the accounting system of record.**

## User-controlled actions

- Connect QuickBooks
- Disconnect QuickBooks
- Sync customer
- Export invoice to QuickBooks
- View sync log

No background auto-sync in the first version.

## Environment variables (server only)

```
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REDIRECT_URI=https://app.everittventures.com/api/integrations/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox
```

Never use `NEXT_PUBLIC_` for secrets.

## Developer setup

1. Create an app in [Intuit Developer](https://developer.intuit.com/).
2. Add OAuth redirect URI matching `QUICKBOOKS_REDIRECT_URI`.
3. Copy Client ID and Client Secret into deployment env.
4. Use sandbox for testing; switch `QUICKBOOKS_ENVIRONMENT` to `production` when ready.
5. In EverittOS: Settings → Integrations → Connect QuickBooks.

If credentials are missing, connect returns a clear error and sync log records the failure.

## Permissions

- Connect / disconnect: owner and admin only
- Export invoice: owner, admin, manager (when invoice permissions allow)
- Sync log: org members with financial visibility

## Manual Supabase step

Run `supabase/migrations/202609030001_post_v1_rls_integrations.sql` for `quickbooks_connections` and `quickbooks_sync_logs` tables plus RLS.
