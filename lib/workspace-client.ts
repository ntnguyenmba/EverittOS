import { fetchOrganizationContext } from '@/lib/organization';
import type { OrganizationContext } from '@/lib/organization-server';
import { logWorkspaceRepair } from '@/lib/workspace-repair-log';

export type ClientWorkspace = OrganizationContext & {
  companyId?: string | null;
};

export type EnsureWorkspaceResult =
  | { ok: true; workspace: ClientWorkspace }
  | { ok: false; error: string; missingRecords?: string[]; code?: string };

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
export async function ensureWorkspaceForSave(userId: string): Promise<EnsureWorkspaceResult> {
  let org = await ensureOrganizationForUser(userId);
  if (org?.organizationId) {
    return { ok: true, workspace: org };
  }

  try {
    const res = await fetch('/api/workspace/ensure', { method: 'POST' });
    const json = (await res.json().catch(() => ({}))) as {
      organizationId?: string;
      error?: string;
      code?: string;
      missingRecords?: string[];
      diagnosis?: {
        workspaceId?: string | null;
        organizationId?: string | null;
        ownerUserId?: string | null;
        membershipId?: string | null;
        profileId?: string | null;
        missingRecords?: string[];
      };
    };

    logWorkspaceRepair('workspace:repair_attempt', {
      userId,
      workspaceId: json.diagnosis?.workspaceId || json.organizationId || null,
      organizationId: json.diagnosis?.organizationId || json.organizationId || null,
      ownerUserId: json.diagnosis?.ownerUserId || null,
      membershipId: json.diagnosis?.membershipId || null,
      profileId: json.diagnosis?.profileId || null,
      missingRecords: json.missingRecords || json.diagnosis?.missingRecords || [],
      apiOk: res.ok
    });

    if (res.ok && json.organizationId) {
      org = await fetchOrganizationContext(userId);
      if (org?.organizationId) {
        return { ok: true, workspace: org };
      }
    }

    org = await fetchOrganizationContext(userId);
    if (org?.organizationId) {
      return { ok: true, workspace: org };
    }

    const missingRecords = json.missingRecords || json.diagnosis?.missingRecords || [];
    return {
      ok: false,
      error:
        json.error ||
        (missingRecords.length
          ? `Workspace linkage incomplete (missing: ${missingRecords.join(', ')}).`
          : 'Workspace linkage is incomplete.'),
      missingRecords,
      code: json.code
    };
  } catch {
    org = await fetchOrganizationContext(userId);
    if (org?.organizationId) {
      return { ok: true, workspace: org };
    }
    return { ok: false, error: 'Unable to verify workspace linkage. Check your connection and try again.' };
  }
}

/** @deprecated Prefer ensureWorkspaceForSave which returns structured errors. */
export async function ensureWorkspaceForSaveLegacy(userId: string): Promise<ClientWorkspace | null> {
  const result = await ensureWorkspaceForSave(userId);
  return result.ok ? result.workspace : null;
}
