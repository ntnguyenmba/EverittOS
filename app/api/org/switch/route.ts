import { NextResponse } from 'next/server';
import { logActivityServer } from '@/lib/activity-server';
import { ACTIVE_ORG_COOKIE } from '@/lib/org-context-cookie';
import { verifyOrgMembership } from '@/lib/organization-active';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as { organizationId?: string };
  const organizationId = body.organizationId?.trim();
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  const allowed = await verifyOrgMembership(supabase, user.id, organizationId);
  if (!allowed) {
    return NextResponse.json({ error: 'You are not a member of this organization' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const { error } = await admin.from('profiles').update({ organization_id: organizationId }).eq('id', user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const prior = await fetchOrganizationContextForUser(supabase, user.id);
  await logActivityServer({
    organizationId,
    userId: user.id,
    entityType: 'organization',
    entityId: organizationId,
    action: 'org_switched',
    message: `Switched workspace to ${organizationId}`,
    metadata: { from: prior?.organizationId || null }
  });

  const response = NextResponse.json({ ok: true, organizationId });
  response.cookies.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}
