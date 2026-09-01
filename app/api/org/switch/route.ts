import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { ACTIVE_ORG_COOKIE } from '@/lib/org-context-cookie';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { normalizeRole } from '@/lib/roles';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveSwitchTarget(userId: string, organizationId: string) {
  const admin = createAdminSupabase();
  if (!admin) return { error: 'Server not configured', status: 503 } as const;

  const [{ data: membership, error: membershipError }, { data: organization, error: organizationError }] = await Promise.all([
    admin
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('active', true)
      .maybeSingle(),
    admin
      .from('organizations')
      .select('owner_user_id')
      .eq('id', organizationId)
      .maybeSingle()
  ]);

  if (membershipError || organizationError) {
    return { error: membershipError?.message || organizationError?.message || 'Unable to switch workspace', status: 500 } as const;
  }
  if (!membership || !organization) {
    return { error: 'You are not a member of this organization', status: 403 } as const;
  }

  const role = organization.owner_user_id === userId ? 'owner' : normalizeRole(membership.role);
  return { role, destination: dashboardPathForRole(role) } as const;
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
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));

  const url = new URL(request.url);
  const organizationId = url.searchParams.get('organizationId')?.trim();
  if (!organizationId) return NextResponse.redirect(new URL('/dashboard', request.url));

  const target = await resolveSwitchTarget(user.id, organizationId);
  if ('error' in target) return NextResponse.redirect(new URL('/dashboard', request.url));

  const prior = await fetchOrganizationContextForUser(supabase, user.id);
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
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { organizationId?: string };
  const organizationId = body.organizationId?.trim();
  if (!organizationId) return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });

  const target = await resolveSwitchTarget(user.id, organizationId);
  if ('error' in target) return NextResponse.json({ error: target.error }, { status: target.status });

  const prior = await fetchOrganizationContextForUser(supabase, user.id);
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
