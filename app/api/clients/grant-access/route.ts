import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { fetchOrganizationContextForUser } from '@/lib/organization-server';
import { canManageTeam, normalizeRole } from '@/lib/roles';
import { limitsForPlan } from '@/lib/everittos-limits';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { appUrl } from '@/lib/app-url';

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
    return NextResponse.json({ error: 'Client portal requires Operations plan or higher.' }, { status: 403 });
  }

  const body = (await request.json()) as { email?: string; jobId?: string };
  const email = (body.email || '').trim().toLowerCase();
  const jobId = body.jobId;

  if (!email || !jobId) {
    return NextResponse.json({ error: 'email and jobId are required' }, { status: 400 });
  }

  const { data: invite, error: inviteError } = await admin
    .from('organization_invitations')
    .insert({
      organization_id: org.organizationId,
      email,
      role: 'client',
      invited_by: user.id,
      status: 'pending'
    })
    .select('token')
    .single();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  const { data: clientProfile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();

  if (clientProfile?.id) {
    await admin.from('job_client_access').upsert(
      {
        job_id: jobId,
        client_user_id: clientProfile.id,
        owner_user_id: org.ownerUserId
      },
      { onConflict: 'job_id,client_user_id' }
    );
  }

  return NextResponse.json({
    ok: true,
    acceptUrl: appUrl(`/team/accept?token=${invite.token}`),
    note: clientProfile?.id
      ? 'Client linked to job. They can sign in and open the client portal.'
      : 'Share the accept link. After signup, grant job access again if needed.'
  });
}
