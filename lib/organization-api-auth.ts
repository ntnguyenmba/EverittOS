import type { SupabaseClient } from '@supabase/supabase-js';
import { canManageOrganizationSettings, isManagerRole } from '@/lib/roles';
import { requireWorkspaceSession, type WorkspaceSessionContext } from '@/lib/workspace-api-auth';

export type OrganizationSessionContext = WorkspaceSessionContext;

/** Organization session with automatic workspace repair on every request. */
export async function requireOrganizationSession(options?: {
  requireManager?: boolean;
  requireSettingsManager?: boolean;
}): Promise<OrganizationSessionContext> {
  const ctx = await requireWorkspaceSession({ requireManager: options?.requireManager });
  if (!ctx.ok) return ctx;

  if (options?.requireSettingsManager && !canManageOrganizationSettings(ctx.workspace.role)) {
    return { ok: false, status: 403, error: 'You do not have permission to perform this action.', code: 'forbidden' };
  }

  return ctx;
}

export function orgCanManage(ctx: Extract<OrganizationSessionContext, { ok: true }>): boolean {
  return isManagerRole(ctx.workspace.role);
}
