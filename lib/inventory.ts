export const INVENTORY_ADJUSTMENT_TYPES = ['purchase', 'used', 'count', 'loss', 'repair', 'retired'] as const;
export type InventoryAdjustmentType = (typeof INVENTORY_ADJUSTMENT_TYPES)[number];

export type InventoryItem = {
  id: string;
  organization_id: string;
  name: string;
  category: string | null;
  item_type: string;
  quantity: number;
  unit: string | null;
  reorder_level: number | null;
  location: string | null;
  vendor: string | null;
  active: boolean;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function isLowStock(item: Pick<InventoryItem, 'quantity' | 'reorder_level'>): boolean {
  if (item.reorder_level == null) return false;
  return Number(item.quantity) <= Number(item.reorder_level);
}

export function adjustmentTypeLabel(type: string): string {
  switch (type) {
    case 'purchase':
      return 'Purchase';
    case 'used':
      return 'Used';
    case 'count':
      return 'Count';
    case 'loss':
      return 'Loss';
    case 'repair':
      return 'Repair';
    case 'retired':
      return 'Retired';
    default:
      return type;
  }
}
