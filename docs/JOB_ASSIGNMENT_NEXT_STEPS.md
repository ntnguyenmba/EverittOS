# Job assignment and unassigned workflow next steps

The current app supports assigning work, but the user experience should be tightened so owners, admins, and managers can quickly see what needs coverage while workers and contractors only see relevant assigned work.

## Goals

- Make `Unassigned` mean a job truly has no assigned worker or crew.
- Show unassigned work only where it helps operations, not as confusing customer-facing copy.
- Give owners, admins, and managers a clear way to assign work from job list, schedule, and job detail pages.
- Hide assignment controls from workers, contractors, viewers, and clients.

## Role behavior

- Owner: can view all jobs, assigned jobs, and unassigned jobs; can assign and reassign work.
- Admin: can view all operational jobs; can assign and reassign work.
- Manager: can view assigned and unassigned operational work; can assign work if workspace policy allows.
- Worker: sees only assigned jobs and can update status/photos/checklists according to permissions.
- Contractor: sees only assigned contractor work and should not see employee/team controls.
- Viewer: read-only access only.
- Client: no internal assignment information unless explicitly exposed in the client portal.

## UI changes

- Jobs list: add a clear `Needs assignment` filter for manager-level roles only.
- Schedule: show unassigned jobs as an operations queue, not mixed awkwardly into customer-facing copy.
- Job detail: show an assignment selector only to roles that can assign jobs.
- My Work: show only work assigned to the current worker or contractor.
- Dashboard: do not show internal assignment noise to everyone.

## Data rules

- Use workspace-scoped queries for owner, admin, and manager views.
- Use assigned-user/worker filters for worker and contractor views.
- Keep RLS aligned with the UI so hidden data is not accessible through direct requests.

## Copy guidance

Use simple operational language:

- `Needs assignment`
- `Assign worker`
- `No worker assigned yet`
- `Assigned to [name]`

Avoid confusing copy like `Create job unassigned` or anything that sounds like the unassigned state is a job type.
