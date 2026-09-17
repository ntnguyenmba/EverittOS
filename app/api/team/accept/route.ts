import { NextResponse } from 'next/server';
import { repairClientPortalAccessForUser } from '@/lib/client-portal-repair';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { inviteAcceptLandingPath } from '@/lib/portal-access';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';
import { localeFromRequest } from '@/lib/i18n/server-request-locale';
import { getTeamInviteApiCopy } from '@/lib/i18n/team-invite-api-copy';

function normalizeEmail(value?: string | null): string { return (value || '').trim().toLowerCase(); }
function shouldMoveWorkspaceRecords(roleInput: string | null | undefined): boolean { const role = normalizeRole(roleInput); return !isClientRole(role) && !isContractorRole(role); }

async function moveUserRecordsToOrganization(admin: ReturnType<typeof createAdminSupabase>, userId: string, organizationId: string) {
  if (!admin) return;
  await admin.from('customers').update({ organization_id: organizationId }).eq('user_id', userId).neq('organization_id', organizationId);
  await admin.from('customers').update({ organization_id: organizationId }).eq('user_id', userId).is('organization_id', null);
  await admin.from('customers').update({ record_type: 'lead' }).eq('user_id', userId).in('pipeline_stage', ['lead', 'qualified']);
  await admin.from('jobs').update({ organization_id: organizationId }).eq('user_id', userId).neq('organization_id', organizationId);
  await admin.from('jobs').update({ organization_id: organizationId }).eq('user_id', userId).is('organization_id', null);
}

async function sharedJobIdsForClient(admin: NonNullable<ReturnType<typeof createAdminSupabase>>, userId: string): Promise<string[]> {
  const { data } = await admin.from('job_client_access').select('job_id').eq('client_user_id', userId);
  return (data || []).map((row) => String(row.job_id)).filter(Boolean);
}

function landingPayload(roleInput: string | null | undefined, organizationId: string, options?: { jobId?: string | null; sharedJobIds?: string[] | null; message?: string }) {
  const role = normalizeRole(roleInput);
  const redirectTo = inviteAcceptLandingPath(role, { jobId: options?.jobId, sharedJobIds: options?.sharedJobIds });
  return { ok: true as const, organizationId, role, jobId: options?.jobId || null, redirectTo, ...(options?.message ? { message: options.message } : {}) };
}

export async function POST(request: Request) {
  const c = getTeamInviteApiCopy(localeFromRequest(request));
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: c.signInToAccept }, { status: 401 });
  if (!admin) return NextResponse.json({ error: c.serverUnavailable }, { status: 503 });

  let body: { token?: string } = {};
  try { body = (await request.json()) as { token?: string }; } catch { body = {}; }
  const token = (body.token || '').trim();
  const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).maybeSingle();
  const userEmail = normalizeEmail(profile?.email || user.email);
  if (!token && !userEmail) return NextResponse.json({ error: c.signInInvitedEmail }, { status: 400 });

  let invite = null as Record<string, any> | null;
  if (token) { const { data } = await admin.from('organization_invitations').select('*').eq('token', token).maybeSingle(); invite = data; }
  if (!invite && userEmail) {
    const { data } = await admin.from('organization_invitations').select('*').eq('email', userEmail).order('created_at', { ascending: false }).limit(1).maybeSingle();
    invite = data;
  }
  if (!invite) return NextResponse.json({ error: c.noInvitationFor(userEmail || c.signInInvitedEmail) }, { status: 404 });

  const inviteEmail = normalizeEmail(invite.email);
  if (userEmail !== inviteEmail) return NextResponse.json({ error: c.emailMismatch(String(invite.email || inviteEmail), userEmail) }, { status: 403 });

  if (invite.status === 'accepted') {
    await admin.from('profiles').update({ organization_id: invite.organization_id, role: invite.role }).eq('id', user.id);
    await admin.from('organization_members').upsert({ organization_id: invite.organization_id, user_id: user.id, role: invite.role, active: true }, { onConflict: 'organization_id,user_id' });
    if (shouldMoveWorkspaceRecords(invite.role)) await moveUserRecordsToOrganization(admin, user.id, invite.organization_id);
    if (invite.role === 'client' && invite.job_id) {
      const { data: org } = await admin.from('organizations').select('owner_user_id').eq('id', invite.organization_id).maybeSingle();
      await admin.from('job_client_access').upsert({ job_id: invite.job_id, client_user_id: user.id, owner_user_id: org?.owner_user_id, organization_id: invite.organization_id, granted_at: new Date().toISOString() }, { onConflict: 'job_id,client_user_id' });
    }
    if (invite.role === 'client') await repairClientPortalAccessForUser(admin, user.id, userEmail);
    const sharedJobIds = invite.role === 'client' ? await sharedJobIdsForClient(admin, user.id) : [];
    return NextResponse.json(landingPayload(invite.role, invite.organization_id, { jobId: invite.job_id || null, sharedJobIds, message: c.alreadyAccepted }));
  }

  if (invite.status !== 'pending') return NextResponse.json({ error: c.invalidInvitationStatus(String(invite.status || '')) }, { status: 409 });
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    await admin.from('organization_invitations').update({ status: 'expired' }).eq('id', invite.id);
    return NextResponse.json({ error: c.expired }, { status: 410 });
  }

  const { error: memberError } = await admin.from('organization_members').upsert({ organization_id: invite.organization_id, user_id: user.id, role: invite.role, active: true }, { onConflict: 'organization_id,user_id' });
  if (memberError) return NextResponse.json({ error: c.acceptError }, { status: 400 });

  await admin.from('organization_invitations').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', invite.id);
  await admin.from('profiles').update({ organization_id: invite.organization_id, role: invite.role }).eq('id', user.id);
  if (shouldMoveWorkspaceRecords(invite.role)) await moveUserRecordsToOrganization(admin, user.id, invite.organization_id);
  if (invite.role === 'client' && invite.job_id) {
    const { data: org } = await admin.from('organizations').select('owner_user_id').eq('id', invite.organization_id).maybeSingle();
    await admin.from('job_client_access').upsert({ job_id: invite.job_id, client_user_id: user.id, owner_user_id: org?.owner_user_id, organization_id: invite.organization_id, granted_at: new Date().toISOString() }, { onConflict: 'job_id,client_user_id' });
  }
  if (invite.role === 'client') await repairClientPortalAccessForUser(admin, user.id, userEmail);
  const sharedJobIds = invite.role === 'client' ? await sharedJobIdsForClient(admin, user.id) : [];
  return NextResponse.json(landingPayload(invite.role, invite.organization_id, { jobId: invite.job_id || null, sharedJobIds }));
}
