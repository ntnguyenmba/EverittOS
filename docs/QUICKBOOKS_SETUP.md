# QuickBooks Online integration

**Status: Implemented** — OAuth connect/disconnect, automatic token refresh, live customer sync, and live invoice export against the QuickBooks Online Accounting API.

EverittOS is **not** accounting, tax, payroll, bookkeeping, or reconciliation software. QuickBooks remains the accounting system of record.

## What works

- `GET /api/integrations/quickbooks/status` — connection status without tokens
- `GET /api/integrations/quickbooks/connect` — owner/admin; signed OAuth state
- `GET /api/integrations/quickbooks/callback` — uses the same `quickbooksRedirectUri()` as authorize
- `POST /api/integrations/quickbooks/disconnect` — revokes Intuit token when possible; clears local tokens
- `POST /api/integrations/quickbooks/sync-customer` — creates or updates a QuickBooks Customer
- `POST /api/integrations/quickbooks/export-invoice` — ensures customer exists, then creates or updates a QuickBooks Invoice
- `GET /api/integrations/quickbooks/sync-log` — recent sync history (includes `intuit_tid` when available)

## Environment (server only — never `NEXT_PUBLIC_`)

```
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=
QUICKBOOKS_ENVIRONMENT=sandbox
QUICKBOOKS_REDIRECT_URI=
QUICKBOOKS_STATE_SECRET=
```

| Variable | Notes |
|---|---|
| `QUICKBOOKS_CLIENT_ID` | Intuit app client id |
| `QUICKBOOKS_CLIENT_SECRET` | Intuit app client secret |
| `QUICKBOOKS_ENVIRONMENT` | `sandbox` (local/preview) or `production` (Vercel Production only) |
| `QUICKBOOKS_REDIRECT_URI` | Must exactly match Intuit app redirect URI |
| `QUICKBOOKS_STATE_SECRET` | Server-only HMAC secret for OAuth `state` (required) |

### Redirect URI

Production callback (must match Intuit settings exactly):

`https://app.everittventures.com/api/integrations/quickbooks/callback`

Use sandbox credentials for local and Vercel Preview. Use production credentials only on Vercel Production. After changing credentials or environment, disconnect and reconnect QuickBooks in Settings → Integrations.

## Manual setup

1. Create an app at [Intuit Developer](https://developer.intuit.com/).
2. Add the redirect URI above (and any preview URIs you need) in the Intuit app.
3. Set the env vars in Vercel (Production vs Preview/Development as appropriate).
4. Apply migrations, including `202609220001_quickbooks_api_integration.sql`.
5. Settings → Integrations → Connect QuickBooks.

## Security notes

- OAuth `state` is HMAC-SHA256 signed and expires within 10 minutes.
- Access and refresh tokens are stored in `quickbooks_connections` and are **not** returned by public API routes.
- Application-level token encryption is **not** implemented. The table has RLS enabled with **no authenticated client policies**, so only the server service role can read tokens. Do not grant broad SQL access to this table.
- Sync logs store `intuit_tid`, HTTP status, and safe error summaries — not secrets or full Intuit payloads.

## Migrations

- `202609030001_post_v1_rls_integrations.sql`
- `202609040001_post_v1_backend_repair.sql`
- `202609220001_quickbooks_api_integration.sql` — external IDs, `intuit_tid`, connection metadata, token RLS lockdown

## Limitations

- Invoices are exported as a single Sales line (EverittOS stores one invoice amount, not a multi-line catalog).
- Sales tax codes are not invented; tax is omitted unless you later add tested tax mapping.
- Background auto-sync is not implemented; sync runs when a user triggers customer sync or invoice export.
