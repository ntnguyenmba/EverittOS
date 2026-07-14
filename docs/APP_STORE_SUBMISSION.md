# App Store and Play Store Submission

Placeholders only — complete in App Store Connect and Play Console. Derive privacy answers from `docs/PRIVACY_DATA_INVENTORY.md`.

## Apple App Store

| Field | Value / guidance |
|-------|------------------|
| App name | EverittOS |
| Subtitle | Field operations for your team |
| Category | Business |
| Description | [Draft from marketing — operations platform for jobs, schedules, customers, photos, reports] |
| Keywords | field service, jobs, scheduling, contractors, CRM |
| Support URL | `https://app.everittventures.com/settings/support` or public support page |
| Marketing URL | Optional — `https://everittventures.com/tech` |
| Privacy Policy URL | `https://app.everittventures.com/privacy` |
| Age rating | Complete questionnaire (expected low maturity — business app) |
| App Privacy | Map from `PRIVACY_DATA_INVENTORY.md` |
| Review contact | Owner email |
| Review notes | Explain role-gated features; billing managed on web for mobile |
| Demo account | **Do not commit credentials** — create reviewer user in staging/production |
| Demo organization | Sample jobs/reports without real customer PII |
| Account deletion | `https://app.everittventures.com/settings` + public instructions URL |
| Screenshots | 6.7", 6.5", 5.5" iPhone; 12.9" iPad if supporting tablets |
| App icon | 1024×1024 from approved artwork |
| Export compliance | Standard HTTPS encryption — typically exempt documentation |
| Encryption declaration | Uses HTTPS; no proprietary cryptography |
| Content rights | Organization-owned operational data |
| Subscriptions | Document web-purchased SaaS; native IAP not enabled in Phase 27 |

### Reviewer instructions (template)

1. Sign in with provided demo email/password
2. Dashboard shows sample organization
3. Jobs → open sample job → view photos and reports
4. Settings → Plans & billing shows current plan (upgrades on web only in mobile build)
5. Settings → Workspace → Danger Zone documents account deletion

### Apple external checklist

- [ ] Developer Program active
- [ ] App ID `com.everittventures.everittos`
- [ ] Associated Domains enabled
- [ ] Provisioning profiles
- [ ] App Store Connect record
- [ ] Replace `TEAMID` in AASA file
- [ ] TestFlight validation
- [ ] Final privacy responses

## Google Play

| Field | Value / guidance |
|-------|------------------|
| App name | EverittOS |
| Short description | Run jobs, schedules, and field operations from one workspace. |
| Full description | [Expand from Apple description] |
| Category | Business |
| Contact email | Support email |
| Privacy Policy URL | `https://app.everittventures.com/privacy` |
| Data Safety | Map from `PRIVACY_DATA_INVENTORY.md` |
| Content rating | IARC questionnaire |
| Target audience | Business professionals — not child-directed |
| Ads | No ads |
| Account deletion URL | Public URL describing deletion request process |
| App access | Provide demo credentials in Play Console (not in Git) |
| Phone screenshots | Minimum 2 phone screenshots |
| Tablet screenshots | If tablet layout supported |
| Feature graphic | 1024×500 |
| High-res icon | 512×512 |
| Release notes | Per release |
| App signing | Play App Signing + upload key |
| Billing declaration | SaaS consumed via existing account; in-app purchases disabled pending policy |

### Google external checklist

- [ ] Play Console developer account
- [ ] App record with `com.everittventures.everittos`
- [ ] Upload key enrolled in Play App Signing
- [ ] Replace SHA-256 in `assetlinks.json`
- [ ] Internal testing track
- [ ] Data Safety form
- [ ] Content rating certificate

## Domain tasks

- [ ] Serve `/.well-known/apple-app-site-association` without redirect
- [ ] Serve `/.well-known/assetlinks.json`
- [ ] Correct `Content-Type: application/json`
- [ ] HTTPS valid on `app.everittventures.com`
- [ ] Stable privacy, support, and deletion URLs

## Review account setup (do not commit secrets)

1. Create `reviewer+everittos@yourdomain.com` in Supabase Auth
2. Seed sample organization with fake customers/jobs
3. Assign **owner** and **employee** test users for role-gated review
4. Store passwords in team password manager; paste into store consoles only
5. Reset credentials after each review cycle if needed
