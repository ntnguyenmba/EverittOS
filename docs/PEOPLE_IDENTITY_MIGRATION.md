# People identity migration

## Current state

EverittOS now presents **People** as the primary product model for teammates and assignees.

- `/people` is the main People page (invites, roles, access).
- `/settings/people` is the settings view for People management.
- `/team`, `/workers`, and `/settings/team` redirect to the People routes for compatibility.
- Sidebar, dashboard links, and mobile nav prefer `/people`.
- Job creation and job detail assignment pickers load **organization_members** first via `lib/people-assignment.ts`.
- Legacy crew rows without linked accounts still appear as fallback options when needed.

## What is People-first

- Navigation labels: People (not Workers / Team for the people hub).
- User-facing copy: invite person, team member, employee, unassigned jobs.
- Assignment pickers: EverittOS user accounts from `organization_members`.
- Settings: People section for invites and roles.

## What still uses `workers` internally

These remain for compatibility and are not shown as the primary product model:

| Internal surface | Why it remains |
| --- | --- |
| `workers` table | Legacy crew roster, schedule API validation, job labor, bookings |
| `app/api/workers` routes | Existing crew CRUD and plan limits |
| `jobs.assigned_to` | May store auth user IDs (preferred) or legacy worker IDs |
| `job_assignments.worker_id` | Multi-assign crew links |
| `workers.auth_user_id` | Bridge between people accounts and crew rows |

`lib/people-assignment.ts` documents and implements this bridge:

- `getPeopleForAssignment()` — members first, legacy crew fallback
- `workerIdForPerson()` — lookup linked worker row
- `ensureWorkerForPerson()` — create/link worker row when schedule or crew APIs require it
- `resolveAssignedUserId()` — read existing `assigned_to` whether user or worker id

## Why `workers` cannot be removed yet

1. **Schedule API** (`/api/schedule/update`) validates `assigned_to` as a worker id via `workerBelongsToOrg`.
2. **Job assignments** (`job_assignments`) reference `worker_id`.
3. **Bookings, labor, expenses, analytics** still join on `workers`.
4. **Production data** may store worker ids in `jobs.assigned_to` from older flows.
5. **RLS and migrations** assume the table exists across environments.

Removing `workers` requires a planned database migration, backfill, and API updates.

## Final migration steps (future)

1. Add `jobs.assigned_user_id` (or standardize `assigned_to` as user id only) and backfill from `workers.auth_user_id`.
2. Update schedule APIs to accept user ids and validate against `organization_members`.
3. Migrate `job_assignments` to user-based assignments or a join table on `organization_members`.
4. Repoint bookings, labor, and analytics to People/user ids.
5. Run migration to archive unlinked legacy crew rows or link them to invited accounts.
6. Drop or rename `workers` only after all readers/writers are migrated and RLS is updated.

Until then, keep `workers` as an internal compatibility layer and treat **People** as the user-facing source of truth.
