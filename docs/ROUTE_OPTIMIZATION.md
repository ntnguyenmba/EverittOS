# Route optimization

**Status: Complete (basic heuristic only)**

Not true drive-time optimization. Depends on scheduled jobs having addresses.

## API

- `GET /api/routes`
- `POST /api/routes/optimize`
- `GET /api/routes/[id]`
- `POST /api/routes/[id]/apply` — confirms route; does **not** auto-change job schedule times

## Behavior

- Sorts by zip/city/address and schedule time.
- Flags jobs missing addresses.
- Apply sets run status to `applied` only.

## Permissions

Owner/admin/manager via `can_manage_organization` RLS and API role checks.

## Migrations

- `202609030001_post_v1_rls_integrations.sql`
- `202609040001_post_v1_backend_repair.sql`

## Limitations

- No mapping provider or drive-time estimates yet.
- `total_distance_miles` / `total_drive_minutes` are not populated in v1.
