# Inventory

Operational tracking for supplies and equipment — not accounting valuation.

## Features

- Items with quantity, unit, category, reorder level, location, vendor, notes
- Adjustments: purchase, used, count, loss, repair, retired
- Low-stock when quantity is at or below reorder level

## Permissions

- View: org members with operations visibility (owner/admin/manager/worker per nav policy)
- Manage: owner, admin, manager

Clients cannot access inventory.

## UI

`/inventory` (Tools nav when `inventoryNav` flag is enabled).

## Migrations

- `supabase/migrations/202608120004_inventory_foundation.sql`
- `supabase/migrations/202609030001_post_v1_rls_integrations.sql` (RLS)
