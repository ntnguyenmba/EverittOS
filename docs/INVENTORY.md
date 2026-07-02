# Inventory

**Status: Complete** (requires migrations applied in Supabase)

## API

- `GET /api/inventory` — active items by default (`?includeInactive=1` for all)
- `POST /api/inventory`
- `PATCH /api/inventory/[id]`
- `DELETE /api/inventory/[id]` — soft deactivates (`active: false`)
- `POST /api/inventory/[id]/adjust`

## Behavior

- Adjustments update quantity and append `inventory_adjustments` row.
- Low stock when `quantity <= reorder_level` (when reorder level is set).
- Optional `job_id` on adjustments for supply use tracking.

## Permissions

- View: org members with operations visibility
- Manage: owner/admin/manager (`can_manage_organization` RLS + API checks)

## Migrations

- `202608120004_inventory_foundation.sql`
- `202609030001_post_v1_rls_integrations.sql`
- `202609040001_post_v1_backend_repair.sql`

## Limitations

- No accounting valuation or COGS integration.
