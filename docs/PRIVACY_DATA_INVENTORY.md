# Privacy Data Inventory

Inventory for App Store Privacy labels and Google Play Data Safety. **Do not claim data is uncollection if the server processes it.**

## Account and identity

| Data | Purpose | Source | Storage | Access | Sharing | Retention | Deletion | Apple | Google |
|------|---------|--------|---------|--------|---------|-----------|----------|-------|--------|
| Name | Account profile, display | User input | Supabase `profiles` | Org members per RLS | Not sold | Account lifetime | Account deletion workflow | Yes | Yes |
| Email | Auth, notifications | User input | Supabase Auth / `profiles` | User, org admins | Email provider (auth) | Account lifetime | Account deletion | Yes | Yes |
| Phone | Optional contact | User input | `profiles` / customers | Org per RLS | Not sold by default | Until updated/deleted | User/org admin | If collected | If collected |
| Password hash | Authentication | User input | Supabase Auth | Auth system only | None | Until password change/delete | Account deletion | No (hash) | No |

## Organization and team

| Data | Purpose | Source | Storage | Access | Sharing | Retention | Deletion | Apple | Google |
|------|---------|--------|---------|--------|---------|-----------|----------|-------|--------|
| Organization name/settings | Workspace context | User input | Supabase | Org members | None | Org lifetime | Org deletion policy | Yes | Yes |
| Team membership / role | Authorization | Admin assignment | Supabase | Org admins | None | Membership period | Remove member / delete account | Yes | Yes |

## Customer and job operations

| Data | Purpose | Source | Storage | Access | Sharing | Retention | Deletion | Apple | Google |
|------|---------|--------|---------|--------|---------|-----------|----------|-------|--------|
| Customer PII | CRM, jobs | User input | Supabase | Org per RLS | Not sold | Business records | Org/admin workflows | Yes | Yes |
| Property addresses | Scheduling, jobs | User input | Supabase | Org per RLS | None | Job/customer lifetime | Record deletion policies | Yes | Yes |
| Job details / notes | Operations | User input | Supabase | Authorized roles | None | Business need | Job deletion | Yes | Yes |
| Job photos | Before/after documentation | Camera / library / upload | Supabase Storage | Org per RLS | None | Business need | Photo delete APIs | Yes | Yes |
| Reports / PDFs | Client deliverables | Generated | Supabase / storage | Authorized roles | Client portal if shared | Business need | Delete workflows | Yes | Yes |
| Invoices / expenses | Billing operations | User input | Supabase | Finance roles | Stripe for payments | Legal/tax retention | Policy-based | Yes | Yes |

## Activity and diagnostics

| Data | Purpose | Source | Storage | Access | Sharing | Retention | Deletion | Apple | Google |
|------|---------|--------|---------|--------|---------|-----------|----------|-------|--------|
| Activity logs | Audit trail | App events | Supabase | Admins | None | Policy-based | Archival | Yes | Yes |
| In-app notifications | User alerts | System | Supabase | Recipient | None | Until read/expired | User delete/read | Yes | Yes |
| IP / request metadata | Security, rate limits | Server logs | Vercel/Supabase logs | Operators | Infrastructure providers | Short-term logs | Provider policy | Yes | Yes |
| User agent summary | Security events | Browser | Server logs | Security review | None | Short-term | Log rotation | Yes | Yes |

## AI (Ask Everitt)

| Data | Purpose | Source | Storage | Access | Sharing | Retention | Deletion | Apple | Google |
|------|---------|--------|---------|--------|---------|-----------|----------|-------|--------|
| AI prompts | Answer operator questions | User input | Server / provider* | Authorized user context | **Third-party AI provider** | Provider + app policy | Config-dependent | Yes | Yes |
| AI responses | Display answers | Provider | Transient / logs | User | Provider processing | Limited | N/A | Yes | Yes |

\*Configured provider (OpenAI, DeepSeek, etc.) — see `AI_PROVIDER` server env. **Not end-to-end encrypted.** Organization owners can disable AI features.

## Billing

| Data | Purpose | Source | Storage | Access | Sharing | Retention | Deletion | Apple | Google |
|------|---------|--------|---------|--------|---------|-----------|----------|-------|--------|
| Stripe customer ID | Subscriptions | Stripe Checkout | Supabase + Stripe | Billing admins | Stripe | Legal/subscription | Stripe + app policies | Yes | Yes |
| Subscription status | Plan enforcement | Stripe webhooks | Supabase | App + user | Stripe | Subscription lifetime | Cancel/delete flows | Yes | Yes |

## Mobile-specific (Phase 27)

| Data | Purpose | Source | Storage | Access | Sharing | Retention | Deletion | Apple | Google |
|------|---------|--------|---------|--------|---------|-----------|----------|-------|--------|
| Device identifiers | Not collected intentionally | — | — | — | — | — | — | No | No |
| Push tokens | Not implemented | — | — | — | — | — | — | N/A | N/A |

## Transport security

HTTPS/TLS protects data in transit. This is **not** end-to-end encryption of stored business records.

## Legal links

- Privacy Policy: `/privacy`
- Terms: `/terms`
- Account deletion: `/settings` (Workspace → Danger Zone) and documented public URL for stores

## Owner review

Legal should verify retention periods, AI disclosures, and store questionnaire answers against production configuration.
