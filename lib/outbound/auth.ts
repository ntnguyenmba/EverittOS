import { fetchOrganizationContextWithRepair } from '@/lib/workspace-server';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { createServerSupabase } from '@/lib/supabase-server';

export type OutboundApiContext =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabase>>;
      userId: string;
      organizationId: string;
      canManage: boolean;
      role: import('@/lib/roles').UserRole;
    }
  | { ok: false; error: string; status: number };

export async function requireOutboundApiAccess(): Promise<OutboundApiContext> {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Unauthorized', status: 401 };
  }

  const org = await fetchOrganizationContextWithRepair(supabase, user.id, {
    email: user.email || '',
    userMetadata: user.user_metadata || undefined
  });

  if (!org) {
    return { ok: false, error: 'Organization not found', status: 404 };
  }

  const role = normalizeRole(org.role);
  const canManage = isManagerRole(role);

  return {
    ok: true,
    supabase,
    userId: user.id,
    organizationId: org.organizationId,
    canManage,
    role
  };
}
