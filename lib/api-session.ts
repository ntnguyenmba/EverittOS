import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isAccountActive } from '@/lib/account-status';
import { fetchOrganizationContextForUser, type OrganizationContext } from '@/lib/organization-server';
import { fetchProfileByUserId } from '@/lib/profile-query';
import { normalizeRole, type UserRole } from '@/lib/roles';

export type ApiSessionContext = {
  user: User;
  org: OrganizationContext;
  role: UserRole;
};

export type ApiSessionResult =
  | { ok: true; session: ApiSessionContext }
  | { ok: false; response: NextResponse };

/** Authenticated API guard: valid session, active account, organization membership. */
export async function requireApiSession(supabase: SupabaseClient): Promise<ApiSessionResult> {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const profileRead = await fetchProfileByUserId(supabase, user.id);
  if (!isAccountActive(profileRead.profile?.account_status)) {
    await supabase.auth.signOut();
    return {
      ok: false,
      response: NextResponse.json({ error: 'Account is disabled.' }, { status: 403 })
    };
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Organization not found.' }, { status: 404 })
    };
  }

  return {
    ok: true,
    session: {
      user,
      org,
      role: normalizeRole(org.role)
    }
  };
}
