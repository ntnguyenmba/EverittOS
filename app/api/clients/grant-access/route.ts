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

  // Existing accounts should receive access immediately. A previous version silently
  // ignored access-write failures, leaving accepted clients with an empty portal.
  const { data: clientProfile } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (clientProfile?.id) {
    const repair = await repairClientPortalAccessForUser(admin, clientProfile.id, email);
    if (!repair.ok) {
      return NextResponse.json(
        { error: repair.error || 'Could not grant client access to this job.' },
        { status: 500 }
      );
    }

    const { data: access, error: accessError } = await admin
      .from('job_client_access')
      .select('portal_token')
      .eq('job_id', jobId)
      .eq('client_user_id', clientProfile.id)
      .maybeSingle();

    if (accessError || !access) {
      return NextResponse.json(
        { error: accessError?.message || 'Client access was not created for this job.' },
        { status: 500 }
      );
    }

    const portalToken = access.portal_token as string | undefined;
    if (portalToken) portalUrl = clientPortalUrl(portalToken);
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
        ? 'Invitation sent. Check your email.'
        : 'Invitation created. Email is not configured.'
  });
}
