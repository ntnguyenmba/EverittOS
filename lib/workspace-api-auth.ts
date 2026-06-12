import type { SupabaseClient } from '@supabase/supabase-js';
import { isManagerRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';
import {
  getCurrentWorkspaceForUser,
  type CurrentWorkspace
} from '@/lib/workspace-server';

export type WorkspaceSessionContext =
  | {
      ok: true;
      supabase: SupabaseClient;
      userId: string;
      email: string;
      workspace: CurrentWorkspace;
      canManage: boolean;
    }
  | { ok: false; status: number; error: string; code?: string };

export async function requireWorkspaceSession(options?: {
  requireManager?: boolean;
  requireCompany?: boolean;
}): Promise<WorkspaceSessionContext> {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: 'Sign in required.', code: 'unauthorized' };
  }

  const workspaceResult = await getCurrentWorkspaceForUser(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined,
    repair: true,
    requireCompany: options?.requireCompany
  });

  if (!workspaceResult.ok) {
    return {
      ok: false,
      status: workspaceResult.status,
      error: workspaceResult.error,
      code: workspaceResult.code
    };
  }

  const canManage = isManagerRole(workspaceResult.workspace.role);
  if (options?.requireManager && !canManage) {
    return { ok: false, status: 403, error: 'You do not have permission to perform this action.', code: 'forbidden' };
  }

  return {
    ok: true,
    supabase,
    userId: user.id,
    email: user.email || '',
    workspace: workspaceResult.workspace,
    canManage
  };
}
