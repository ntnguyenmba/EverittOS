# Demo company seed

Use this for investor or sales walkthroughs only. The seed does not run automatically.

## Steps

1. Create a Supabase Auth user with email `demo@everittventures.com` (or edit the SQL file).
2. Apply all migrations through `202605370001_launch_growth_features.sql`.
3. Open the Supabase SQL editor and run `supabase/demo_seed.sql`.
4. Sign in as the demo user and open `/dashboard`.

## What gets created

- Demo organization with Growth plan on the owner profile
- Organization settings with contact fields for branded reports
- Customer, worker, scheduled job, department, workflow template, and sample report row

## Notes

- Safe to re-run after adjusting the script for your demo email.
- Do not run in production unless you intend to create demo data there.
