# Apple App Privacy (nutrition labels)

Owner must complete App Store Connect privacy answers. Based on current EverittOS behavior:

## Data collected (account / app usage)

| Category | Examples | Linked to user | Used for tracking |
|----------|----------|----------------|-------------------|
| Contact info | Email | Yes | No |
| Identifiers | User ID, organization ID | Yes | No |
| User content | Customers, jobs, photos, invoices, messages | Yes | No |
| Purchases | Subscription status / store transaction identifiers (server-side) | Yes | No |
| Diagnostics | Crash / performance if enabled by host platform | Possibly | No |
| Location | Only if user-entered job/customer addresses (not continuous GPS background tracking unless separately enabled) | Yes | No |

## Not claimed without verification

* End-to-end encryption of all content
* “No data collected” — false; backend stores business data
* Advertising tracking — not part of core product; do not declare unless an SDK is added

## Owner actions

- [ ] Confirm analytics / crash SDKs actually in the release binary
- [ ] Complete App Privacy questionnaire in App Store Connect
- [ ] Link Privacy Policy: `https://app.everittventures.com/privacy`
