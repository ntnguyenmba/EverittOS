import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isAccountActive } from '@/lib/account-status';
import { fetchOrganizationContextForUser, type OrganizationContext } from '@/lib/organization-server';
import { fetchProfileByUserId } from '@/lib/profile-query';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { LOCALE_COOKIE_NAME, normalizeLocale, type Locale } from '@/lib/i18n/config';

export type ApiSessionContext = {
  user: User;
  org: OrganizationContext;
  role: UserRole;
};

export type ApiSessionResult =
  | { ok: true; session: ApiSessionContext }
  | { ok: false; response: NextResponse };

const SESSION_COPY: Record<Locale, { unauthorized:string; disabled:string; organizationNotFound:string }> = {
  en: { unauthorized:'Unauthorized.', disabled:'Account is disabled.', organizationNotFound:'Organization not found.' },
  es: { unauthorized:'No autorizado.', disabled:'La cuenta está deshabilitada.', organizationNotFound:'No se encontró la organización.' },
  vi: { unauthorized:'Không được phép.', disabled:'Tài khoản đã bị vô hiệu hóa.', organizationNotFound:'Không tìm thấy tổ chức.' }
};

async function sessionCopy() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  return SESSION_COPY[locale] || SESSION_COPY.en;
}

/** Authenticated API guard: valid session, active account, organization membership. */
export async function requireApiSession(supabase: SupabaseClient): Promise<ApiSessionResult> {
  const c = await sessionCopy();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: c.unauthorized }, { status: 401 }) };
  }

  const profileRead = await fetchProfileByUserId(supabase, user.id);
  if (!isAccountActive(profileRead.profile?.account_status)) {
    await supabase.auth.signOut();
    return { ok: false, response: NextResponse.json({ error: c.disabled }, { status: 403 }) };
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org) {
    return { ok: false, response: NextResponse.json({ error: c.organizationNotFound }, { status: 404 }) };
  }

  return { ok: true, session: { user, org, role: normalizeRole(org.role) } };
}
