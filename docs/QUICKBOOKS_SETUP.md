# QuickBooks integration

**Status: Partial** — safe OAuth scaffold and sync logging; live QuickBooks entity sync not implemented yet.

EverittOS is **not** accounting, tax, payroll, bookkeeping, or reconciliation software. QuickBooks is optional and remains the accounting system of record.

## What works

- `GET /api/integrations/quickbooks/status`
- `GET /api/integrations/quickbooks/connect` (owner/admin only)
- `GET /api/integrations/quickbooks/callback`
- `POST /api/integrations/quickbooks/disconnect`
- `POST /api/integrations/quickbooks/sync-customer` — logs attempt
- `POST /api/integrations/quickbooks/export-invoice` — logs attempt (manager+ with invoice access)
- `GET /api/integrations/quickbooks/sync-log`

## What is not done yet

- Live customer/invoice mapping to QuickBooks Online API
- Token refresh automation
- Background auto-sync

## Env (server only)

```
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_REDIRECT_URI=
QUICKBOOKS_ENVIRONMENT=sandbox
```

## Manual setup

1. Create app at [Intuit Developer](https://developer.intuit.com/)
2. Set redirect URI to `QUICKBOOKS_REDIRECT_URI`
3. Add env vars to Vercel
4. Run migrations `202609030001_post_v1_rls_integrations.sql` and `202609040001_post_v1_backend_repair.sql`
5. Settings → Integrations → Connect QuickBooks

## Migrations

- `202609030001_post_v1_rls_integrations.sql`
- `202609040001_post_v1_backend_repair.sql`
