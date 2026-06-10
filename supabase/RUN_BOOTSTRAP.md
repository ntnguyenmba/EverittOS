# Run EverittOS database bootstrap (legacy Supabase)

Project: **Everitt OS** (`wxtatzlirexrwjehqgak`)

## Step 1 — Diagnose (optional but recommended)

In Supabase **SQL Editor**, run the entire file:

`supabase/diagnose_schema.sql`

This prints your real table/column names. If bootstrap fails again, save that output.

## Step 2 — Bootstrap (required)

In SQL Editor, run the **entire** file from line 1 to the end:

`supabase/production_bootstrap.sql`

**Important:**
- Run the **whole file**, not just the bottom backfill section
- Wait until it finishes (can take 30–60 seconds)
- Success message: `EverittOS production bootstrap complete`
- The last query shows `has_user_id = true` for customers, jobs, workers, job_photos

## If it still fails

Copy the **exact error** from Supabase, including:
- `ERROR:` line
- `LINE` number

Common causes:
1. **Partial run** — an earlier failed run left half-applied objects. Re-run the full file (it is idempotent).
2. **Wrong snippet** — only the `UPDATE` block at the end was run without Phase A adding `user_id` first.
3. **Legacy owner column** — your tables may use a column name not in the backfill list; run `diagnose_schema.sql` and share the "OWNER-LIKE COLUMNS" section.

## After success

1. Configure Auth redirect URLs (`/auth/callback`, `/reset-password`)
2. Set app env vars (`NEXT_PUBLIC_SUPABASE_URL`, keys, Stripe)
3. Log in to EverittOS and verify dashboard loads
