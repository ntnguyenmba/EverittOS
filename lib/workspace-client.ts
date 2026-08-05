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
const WORKSPACE_CACHE_TTL_MS = 60_000;

type WorkspaceCacheEntry = {
  value: ClientWorkspace | null;
  expiresAt: number;
};

const workspaceCache = new Map<string, WorkspaceCacheEntry>();
const workspaceRequests = new Map<string, Promise<ClientWorkspace | null>>();
const workspaceSetupRequests = new Map<string, Promise<boolean>>();

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

function readCachedWorkspace(userId: string): ClientWorkspace | null | undefined {
  const cached = workspaceCache.get(userId);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    workspaceCache.delete(userId);
    return undefined;
  }
  return cached.value;
}

function cacheWorkspace(userId: string, value: ClientWorkspace | null) {
  workspaceCache.set(userId, {
    value,
    expiresAt: Date.now() + WORKSPACE_CACHE_TTL_MS
  });
}

export function clearWorkspaceClientCache(userId?: string) {
  if (userId) {
    workspaceCache.delete(userId);
    workspaceRequests.delete(userId);
    workspaceSetupRequests.delete(userId);
    return;
  }
  workspaceCache.clear();
  workspaceRequests.clear();
  workspaceSetupRequests.clear();
}

async function loadOrganization(userId: string, force = false): Promise<ClientWorkspace | null> {
  if (!force) {
    const cached = readCachedWorkspace(userId);
    if (cached !== undefined) return cached;

    const activeRequest = workspaceRequests.get(userId);
    if (activeRequest) return activeRequest;
  }

  const request = withTimeout(fetchOrganizationContext(userId), WORKSPACE_LOOKUP_TIMEOUT_MS, null)
    .then((result) => {
      cacheWorkspace(userId, result);
      return result;
    })
    .finally(() => {
      workspaceRequests.delete(userId);
    });

  workspaceRequests.set(userId, request);
  return request;
}

async function requestWorkspaceSetup(userId: string): Promise<boolean> {
  const activeRequest = workspaceSetupRequests.get(userId);
  if (activeRequest) return activeRequest;

  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WORKSPACE_SETUP_TIMEOUT_MS);
    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        signal: controller.signal
      });
      if (response.ok) workspaceCache.delete(userId);
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    workspaceSetupRequests.delete(userId);
  });

  workspaceSetupRequests.set(userId, request);
  return request;
}

/**
 * Returns the current workspace for dashboard reads.
 * Reuses one short-lived lookup across the shell, dashboard, portals, and helper
 * components so each page does not repeat the same organization request.
 * Missing workspace repair runs in the background so the page can render with
 * user-scoped data instead of waiting on setup.
 */
export async function ensureOrganizationForUser(userId: string): Promise<ClientWorkspace | null> {
  const org = await loadOrganization(userId);
  if (org?.organizationId) return org;

  void requestWorkspaceSetup(userId).catch(() => undefined);
  return null;
}

/** Client helper before workspace-scoped saves, runs bootstrap repair when needed. */
export async function ensureWorkspaceForSave(userId: string): Promise<EnsureWorkspaceResult> {
  let org = await loadOrganization(userId);
  if (org?.organizationId) {
    return { ok: true, workspace: org };
  }

  await requestWorkspaceSetup(userId);
  org = await loadOrganization(userId, true);
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

    workspaceCache.delete(userId);
    org = await loadOrganization(userId, true);
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
    workspaceCache.delete(userId);
    org = await loadOrganization(userId, true);
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
