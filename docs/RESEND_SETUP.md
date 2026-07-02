# Resend setup for EverittOS

v1 launch still comes first after Resend works.

## Required environment variables

- `RESEND_API_KEY` — server only
- `EMAIL_FROM` — verified sender, e.g. `EverittOS <notifications@everittventures.com>`

Auth email remains Supabase Auth only. Resend is used for transactional email:

- Team invites (with copy-link fallback)
- Client invites (with copy-link fallback)
- Outbound invoices, estimates, proposals, reviews, messages
- Customer messaging threads
- Booking confirmation resend when configured

## Domain verification

1. Add everittventures.com (or your sending domain) in [Resend Domains](https://resend.com/domains).
2. Add DNS records Resend provides.
3. Wait until the domain shows verified.
4. Set `EMAIL_FROM` to an address on that domain.

Until the domain is verified, sends fail with a clear non-technical message. The app does not crash; copy-link fallback still works for invites.

## Test steps

1. Set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel (or local `.env`).
2. Open `/admin/launch-status` as a platform admin — email readiness should show configured.
3. Send a team invite — email sends or shows domain verification error.
4. Send an outbound invoice or customer message — delivery status shows sent or failed honestly.
5. Remove env vars — app still loads; invites show copy-link fallback.

## Launch gate

Do not claim launch readiness if `RESEND_API_KEY` or `EMAIL_FROM` is missing. See `docs/launch-checklist.md`.
