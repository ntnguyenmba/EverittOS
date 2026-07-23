import type { OrgMembership } from '@/lib/os-types';

export type OrgMembershipRow = {
  organizationId: string;
  organizationName: string;
  role: string;
  isOwner: boolean;
  deletedAt?: string | null;
};

/**
 * Normalize memberships for the workspace switcher:
 * - drop soft-deleted organizations
 * - dedupe by organization id
 * - collapse owner-side duplicate names (bootstrap race / migration leftovers)
 *   preferring the active organization when present
 */
export function normalizeOrgMemberships(
  rows: OrgMembershipRow[],
  activeOrganizationId?: string | null
): OrgMembership[] {
  const byId = new Map<string, OrgMembership>();

  for (const row of rows) {
    const organizationId = String(row.organizationId || '').trim();
    if (!organizationId) continue;
    if (row.deletedAt) continue;
    if (byId.has(organizationId)) continue;

    byId.set(organizationId, {
      organizationId,
      organizationName: String(row.organizationName || '').trim() || 'Workspace',
      role: row.role,
      isOwner: Boolean(row.isOwner)
    });
  }

  const unique = Array.from(byId.values());
  const preferred = activeOrganizationId ? String(activeOrganizationId).trim() : '';
  const ownerNameKept = new Map<string, OrgMembership>();
  const result: OrgMembership[] = [];

  for (const membership of unique) {
    if (!membership.isOwner) {
      result.push(membership);
      continue;
    }

    const nameKey = membership.organizationName.trim().toLowerCase();
    const existing = ownerNameKept.get(nameKey);
    if (!existing) {
      ownerNameKept.set(nameKey, membership);
      result.push(membership);
      continue;
    }

    const preferIncoming = preferred && membership.organizationId === preferred;
    if (!preferIncoming) continue;

    const idx = result.findIndex((item) => item.organizationId === existing.organizationId);
    if (idx >= 0) result[idx] = membership;
    ownerNameKept.set(nameKey, membership);
  }

  return result;
}
