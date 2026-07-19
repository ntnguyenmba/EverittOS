# Google Play Data Safety

Owner must complete Play Console Data safety. Based on current EverittOS behavior:

## Data types

| Type | Collected | Shared | Purpose |
|------|-----------|--------|---------|
| Email | Yes | No (except processors: Supabase/hosting/email) | Account |
| User IDs | Yes | No | Account |
| Photos / media | Yes (job photos) | No | App functionality |
| Financial info | Subscription status via Play; business invoices stored for the workspace | No | App functionality |
| Customer / job content | Yes | No | App functionality |
| Approximate location | Only if present in user-entered addresses | No | App functionality |

## Security practices

* Data encrypted in transit (HTTPS)
* Account deletion available in Settings → Account
* Encryption at rest depends on Supabase/hosting configuration — verify before claiming

## Owner actions

- [ ] Complete Data safety form in Play Console
- [ ] Declare Play Billing subscription data handling
- [ ] Link Privacy Policy: `https://app.everittventures.com/privacy`
- [ ] Confirm no undeclared analytics SDKs
