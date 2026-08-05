import { fetchOrganizationContext } from '@/lib/organization';
import type { OrganizationContext } from '@/lib/organization-server';
import { logWorkspaceRepair } from '@/lib/workspace-repair-log';

export type ClientWorkspace = OrganizationContext & {
  companyId?: string | null;
};

export type EnsureWorkspaceResult =
  | { ok: true; workspace: ClientWorkspace }
  | { ok: false; error: string; missingRecords?: string[]; code?: string };

const WORKSPACE_LOOKUP_TIMEOUT_MS = 2500;
const WORKSPACE_SETUP_TIMEOUT_MS = 6500;

async function withTimeout<T>(task: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loadOrganization(userId: string): Promise<ClientWorkspace | null> {
  return withTimeout(fetchOrganizationContext(userId), WORKSPACE_LOOKUP_TIMEOUT_MS, null);
}

async function requestWorkspaceSetup(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKSPACE_SETUP_TIMEOUT_MS);
  try {
    const response = await fetch('/api/auth/setup', {
      method: 'POST',
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the current workspace for dashboard reads.
 * Missing workspace repair runs in the background so the dashboard can render
 * immediately with user-scoped data instead of showing a blank loading state.
 */
export async function ensureOrganizationForUser(userId: string): Promise<ClientWorkspace | null> {
  const org = await loadOrganization(userId);
  if (org?.organizationId) return org;

  void requestWorkspaceSetup().catch(() => undefined);
  return null;
}

/** Client helper before workspace-scoped saves, runs bootstrap repair when needed. */
export async function ensureWorkspaceForSave(userId: string): Promise<EnsureWorkspaceResult> {
  let org = await loadOrganization(userId);
  if (org?.organizationId) {
    return { ok: true, workspace: org };
  }

  await requestWorkspaceSetup();
  org = await loadOrganization(userId);
  if (org?.organizationId) {
    return { ok: true, workspace: org };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WORKSPACE_SETUP_TIMEOUT_MS);
    const res = await fetch('/api/workspace/ensure', {
      method: 'POST',
      signal: controller.signal
    }).finally(() => clearTimeout(timer));
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

    org = await loadOrganization(userId);
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
    org = await loadOrganization(userId);
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
