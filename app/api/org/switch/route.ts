import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { ACTIVE_ORG_COOKIE } from '@/lib/org-context-cookie';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getOrgApiCopy } from '@/lib/i18n/org-api-copy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrgCopy = ReturnType<typeof getOrgApiCopy>;

async function resolveSwitchTarget(userId: string, organizationId: string, c: OrgCopy) {
  const admin = createAdminSupabase();
  if (!admin) return { error: c.serverUnavailable, status: 503 } as const;

  const [{ data: membership, error: membershipError }, { data: organization, error: organizationError }] = await Promise.all([
    admin.from('organization_members').select('role').eq('user_id', userId).eq('organization_id', organizationId).eq('active', true).maybeSingle(),
    admin.from('organizations').select('owner_user_id').eq('id', organizationId).maybeSingle()
  ]);

  if (membershipError || organizationError) return { error: c.switchWorkspace, status: 500 } as const;
  if (!membership || !organization) return { error: c.notMember, status: 403 } as const;

  const role = organization.owner_user_id === userId ? 'owner' : normalizeRole(membership.role);
  return { role, destination: dashboardPathForRole(role) } as const;
}

async function persistActiveWorkspace(userId: string, organizationId: string) {
  const admin = createAdminSupabase();
  if (!admin) return;
  await admin.from('profiles').update({ organization_id: organizationId }).eq('id', userId);
}

function setActiveWorkspace(response: NextResponse, organizationId: string) {
  response.cookies.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  });
}

export async function GET(request: Request) {
  const c = getOrgApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organizationId')?.trim();
  if (!organizationId) return NextResponse.redirect(new URL('/dashboard', request.url));

  const target = await resolveSwitchTarget(user.id, organizationId, c);
  if ('error' in target) return NextResponse.redirect(new URL('/dashboard', request.url));

  const prior = await fetchOrganizationContextForUser(supabase, user.id);
  await persistActiveWorkspace(user.id, organizationId);
  await logActivityServer({
    organizationId,
    userId: user.id,
    entityType: 'organization',
    entityId: organizationId,
    action: 'org_switched',
    message: `Switched company to ${organizationId}`,
    metadata: { from: prior?.organizationId || null, role: target.role }
  });

  const response = NextResponse.redirect(new URL(target.destination, request.url), 303);
  setActiveWorkspace(response, organizationId);
  return response;
}

export async function POST(request: Request) {
  const c = getOrgApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.unauthorized }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { organizationId?: string };
  const organizationId = body.organizationId?.trim();
  if (!organizationId) return NextResponse.json({ error: c.organizationIdRequired }, { status: 400 });

  const target = await resolveSwitchTarget(user.id, organizationId, c);
  if ('error' in target) return NextResponse.json({ error: target.error }, { status: target.status });

  const prior = await fetchOrganizationContextForUser(supabase, user.id);
  await persistActiveWorkspace(user.id, organizationId);
  await logActivityServer({
    organizationId,
    userId: user.id,
    entityType: 'organization',
    entityId: organizationId,
    action: 'org_switched',
    message: `Switched company to ${organizationId}`,
    metadata: { from: prior?.organizationId || null, role: target.role }
  });

  const response = NextResponse.json({ ok: true, organizationId, role: target.role, destination: target.destination });
  setActiveWorkspace(response, organizationId);
  return response;
}
