# EverittOS launch checklist

Before launch, confirm the Vercel project is connected to `ntnguyenmba/EverittOS` and production deploys from `main`.

Then confirm:

1. Vercel production environment variables are filled in.
2. Supabase migrations have been run in filename order.
3. Supabase Auth redirect URLs point to the production app.
4. The job photo storage bucket exists.
5. Stripe webhook points to the production app webhook route.
6. Stripe payment links include the correct plan metadata.
7. A live signup, login, password reset, job creation, photo upload, report, and upgrade test all work.

Keep the current app structure for launch. Polish login, signup, pricing, cards, tables, spacing, and mobile views after production is stable.
