import { fetchOrganizationContext } from '@/lib/organization';
import type { OrganizationContext } from '@/lib/organization-server';

export type ClientWorkspace = OrganizationContext & {
  companyId?: string | null;
};

/**
 * Ensures the signed-in user has an organization workspace before data writes.
 */
export async function ensureOrganizationForUser(userId: string): Promise<ClientWorkspace | null> {
  let org = await fetchOrganizationContext(userId);
  if (org?.organizationId) return org;

  try {
    const res = await fetch('/api/auth/setup', { method: 'POST' });
    if (res.ok) {
      org = await fetchOrganizationContext(userId);
      if (org?.organizationId) return org;
    }
  } catch {
    /* setup may retry on next navigation */
  }

  org = await fetchOrganizationContext(userId);
  return org;
}

/** Client helper before workspace-scoped saves — runs bootstrap repair when needed. */
export async function ensureWorkspaceForSave(userId: string): Promise<ClientWorkspace | null> {
  return ensureOrganizationForUser(userId);
}
