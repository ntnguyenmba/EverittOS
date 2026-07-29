import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { clientPortalUrl, sendClientInviteEmail } from '@/lib/email';
import { limitsForPlan } from '@/lib/everittos-limits';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { canManageTeam } from '@/lib/roles';
import { appUrl } from '@/lib/app-url';
import { repairClientPortalAccessForUser } from '@/lib/client-portal-repair';

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

  const { plan } = await resolveOrganizationPlan(supabase, user.id);
  if (!limitsForPlan(plan).clientPortal) {
    return NextResponse.json({ error: 'Client portal requires Growth plan or higher.' }, { status: 403 });
  }

  const body = (await request.json()) as { email?: string; jobId?: string };
  const email = (body.email || '').trim().toLowerCase();
  const jobId = body.jobId;

  if (!email || !jobId) {
    return NextResponse.json({ error: 'email and jobId are required' }, { status: 400 });
  }

  const { data: job } = await admin
    .from('jobs')
    .select('id, title, organization_id')
    .eq('id', jobId)
    .eq('organization_id', org.organizationId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: 'Job not found in your organization.' }, { status: 404 });
  }

  const { data: invite, error: inviteError } = await admin
    .from('organization_invitations')
    .insert({
      organization_id: org.organizationId,
      email,
      role: 'client',
      invited_by: user.id,
      status: 'pending',
      job_id: jobId
    })
    .select('token')
    .single();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  const acceptUrl = appUrl(`/team/accept?token=${invite.token}`);
  let portalUrl: string | undefined;

  const { data: clientProfile } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (clientProfile?.id) {
    const portalToken = randomBytes(24).toString('hex');
    const { error: directAccessError } = await admin.from('job_client_access').upsert(
      {
        job_id: jobId,
        client_user_id: clientProfile.id,
        owner_user_id: user.id,
        organization_id: org.organizationId,
        portal_token: portalToken,
        granted_at: new Date().toISOString()
      },
      { onConflict: 'job_id,client_user_id' }
    );

    if (directAccessError) {
      return NextResponse.json(
        { error: directAccessError.message || 'Could not grant client access to this job.' },
        { status: 500 }
      );
    }

    await admin.from('organization_members').upsert(
      {
        organization_id: org.organizationId,
        user_id: clientProfile.id,
        role: 'client',
        active: true
      },
      { onConflict: 'organization_id,user_id' }
    );

    await repairClientPortalAccessForUser(admin, clientProfile.id, email);
    portalUrl = clientPortalUrl(portalToken);
  }

  const emailResult = await sendClientInviteEmail({
    to: email,
    organizationName: org.organizationName,
    acceptUrl,
    jobTitle: job.title,
    portalUrl
  });

  return NextResponse.json({
    ok: true,
    emailSent: emailResult.sent,
    accessGranted: Boolean(clientProfile?.id),
    message: clientProfile?.id
      ? 'Client access granted. The shared job is available now.'
      : emailResult.sent
        ? 'Invitation sent. Access will appear after the client accepts.'
        : 'Invitation created. Access will appear after the client accepts.'
  });
}
