# Final Production Checklist

## Before relying on production finance metrics

1. Run SQL from `docs/SUPABASE_SQL_TO_RUN.md` in Supabase.
2. Redeploy latest `main` on Vercel.
3. Confirm Vercel env: `NEXT_PUBLIC_APP_URL`, Supabase public keys, Stripe secrets (server only).
4. Enter payment dates on a few invoices and compare dashboard Cash Collected vs Booked Revenue.
5. Confirm unpaid invoices never increase Cash Collected.

## Web

- [ ] Login (target under ~1.5s typical)
- [ ] Signup / confirmation / password reset
- [ ] Dashboard finance cards
- [ ] Invoice partial / full pay updates
- [ ] Stripe checkout + portal (web only)
- [ ] Ask Everitt upgrade path for non-AI web users
- [ ] Account deletion from Settings

## Native iOS / Android

- [ ] `npm run mobile:sync`
- [ ] Simulator / emulator smoke test
- [ ] Login / logout / resume session
- [ ] AI-enabled account: Ask Everitt works, no billing UI
- [ ] Non-AI account: no AI chips, no View plans, no upgrade modal
- [ ] No Stripe / prices / purchase instructions
- [ ] Camera + photo library job uploads
- [ ] Account deletion entry reachable
- [ ] Privacy + Terms reachable

## Store

- [ ] Replace AASA `TEAMID`
- [ ] Replace `assetlinks.json` SHA-256
- [ ] Approved icons / splash / screenshots
- [ ] Apple / Google signing + review accounts (passwords not in git)

## Do not ship secrets

No keystores, certificates, service-role keys, Stripe secrets, AI provider keys, or review passwords in git.
