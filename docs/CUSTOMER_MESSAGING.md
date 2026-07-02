# Customer messaging

**Status: Complete** (requires migrations applied in Supabase)

Email-first threads at `/messages`. No SMS.

## API

- `GET/POST /api/customer-messages`
- `GET/PATCH /api/customer-messages/[threadId]`
- `POST /api/customer-messages/[threadId]/reply`

## Behavior

- Sends via Resend when `RESEND_API_KEY` and `EMAIL_FROM` are configured.
- Saves `sent` or `failed` status with `failure_reason` when email cannot send.
- Customer/job links validated against organization scope.
- Internal notes are never emailed (compose uses customer message body only).

## Permissions

- Read: org members with `canSeeOrgWideData`
- Send/manage: owner/admin/manager

## Migrations

- `202608120002_customer_messaging_foundation.sql`
- `202609030001_post_v1_rls_integrations.sql`
- `202609040001_post_v1_backend_repair.sql`
