import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageTeam } from '@/lib/roles';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await fetchOrganizationContextForUser(supabase, user.id);
  if (!org || !canManageTeam(org.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = (await request.json()) as { jobId?: string; clientUserId?: string };
  if (!body.jobId || !body.clientUserId) {
    return NextResponse.json({ error: 'jobId and clientUserId are required' }, { status: 400 });
  }

  const { data: job } = await admin
    .from('jobs')
    .select('organization_id')
    .eq('id', body.jobId)
    .eq('organization_id', org.organizationId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { error } = await admin
    .from('job_client_access')
    .delete()
    .eq('job_id', body.jobId)
    .eq('client_user_id', body.clientUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: clientProfile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', body.clientUserId)
    .maybeSingle();

  const clientEmail = (clientProfile?.email || '').trim().toLowerCase();

  // Mark the matching invitations as revoked so the automatic client repair
  // process cannot recreate access from an old accepted or expired invite.
  if (clientEmail) {
    await admin
      .from('organization_invitations')
      .update({ status: 'revoked' })
      .eq('organization_id', org.organizationId)
      .eq('job_id', body.jobId)
      .eq('role', 'client')
      .ilike('email', clientEmail)
      .in('status', ['pending', 'accepted', 'expired']);
  }

  const { count: remainingOrgAccess } = await admin
    .from('job_client_access')
    .select('job_id', { count: 'exact', head: true })
    .eq('client_user_id', body.clientUserId)
    .eq('organization_id', org.organizationId);

  // Keep the client membership active while any other job from this workspace
  // is still shared. Otherwise remove the workspace from the client portal.
  if ((remainingOrgAccess || 0) === 0) {
    await admin
      .from('organization_members')
      .update({ active: false })
      .eq('organization_id', org.organizationId)
      .eq('user_id', body.clientUserId)
      .eq('role', 'client');
  }

  return NextResponse.json({ ok: true, message: 'Client access revoked.' });
}
