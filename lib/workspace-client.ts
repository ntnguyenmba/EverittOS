import { fetchOrganizationContext } from '@/lib/organization';
import type { OrganizationContext } from '@/lib/organization-server';

/**
 * Ensures the signed-in user has an organization workspace before data writes.
 */
export async function ensureOrganizationForUser(userId: string): Promise<OrganizationContext | null> {
  let org = await fetchOrganizationContext(userId);
  if (org?.organizationId) return org;

  try {
    await fetch('/api/auth/setup', { method: 'POST' });
  } catch {
    /* setup may retry on next navigation */
  }

  org = await fetchOrganizationContext(userId);
  return org;
}
