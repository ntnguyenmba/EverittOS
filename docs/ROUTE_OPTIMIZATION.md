# Route optimization (later)

Route optimization is a **later** tool — not a core v1 feature. It depends on reliable schedule dates and job addresses.

## Current behavior

- User selects a service date.
- System loads scheduled jobs for that date.
- **Heuristic fallback** sorts by zip/city/address and schedule time.
- Labeled as basic ordering, not true drive-time optimization.
- **Apply** confirms the route order without automatically changing schedule times.

## Permissions

Owner, admin, and manager can create and apply routes. Clients cannot access.

## UI

`/routes` (nav when `routesNav` flag is enabled).

## Future

A mapping provider can be wired later for drive-time optimization. Provider name is stored on each run.

## Migration

`supabase/migrations/202609030001_post_v1_rls_integrations.sql`
