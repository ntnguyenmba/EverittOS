import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appUrl } from '@/lib/app-url';
import { clientPortalUrl, sendClientInviteEmail } from '@/lib/email';
import { repairClientPortalAccessForUser } from '@/lib/client-portal-repair';
import { limitsForPlan } from '@/lib/everittos-limits';
import type { EverittosPlan } from '@/lib/everittos-plans';

export type GrantJobClientAccessInput = {
  admin: SupabaseClient;
  organizationId: string;
  organizationName: string;
  grantedByUserId: string;
  jobId: string;
  jobTitle: string;
  email: string;
  plan: EverittosPlan;
  sendEmail?: boolean;
};

export type GrantJobClientAccessResult =
  | {
      ok: true;
      reused: boolean;
      accessGranted: boolean;
      emailSent: boolean;
      message: string;
    }
  | { ok: false; error: string; code?: string };

/**
 * Grant client portal access for a job email without creating duplicate access rows
 * or duplicate pending invitations for the same job + email.
 */
export async function grantJobClientAccess(
  input: GrantJobClientAccessInput
): Promise<GrantJobClientAccessResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'A valid customer email is required.', code: 'invalid_email' };
  }

  if (!limitsForPlan(input.plan).clientPortal) {
    return {
      ok: false,
      error: 'Client portal requires Growth plan or higher.',
      code: 'plan_required'
    };
  }

  const { data: clientProfile } = await input.admin
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (clientProfile?.id) {
    const { data: existingAccess } = await input.admin
      .from('job_client_access')
      .select('client_user_id, portal_token')
      .eq('job_id', input.jobId)
      .eq('client_user_id', clientProfile.id)
      .maybeSingle();

    if (existingAccess) {
      return {
        ok: true,
        reused: true,
        accessGranted: true,
        emailSent: false,
        message: 'Client access already enabled for this customer.'
      };
    }

    const portalToken = randomBytes(24).toString('hex');
    const { error: directAccessError } = await input.admin.from('job_client_access').upsert(
      {
        job_id: input.jobId,
        client_user_id: clientProfile.id,
        owner_user_id: input.grantedByUserId,
        organization_id: input.organizationId,
        portal_token: portalToken,
        granted_at: new Date().toISOString()
      },
      { onConflict: 'job_id,client_user_id' }
    );

    if (directAccessError) {
      return {
        ok: false,
        error: directAccessError.message || 'Could not grant client access to this job.',
        code: 'access_upsert_failed'
      };
    }

    await input.admin.from('organization_members').upsert(
      {
        organization_id: input.organizationId,
        user_id: clientProfile.id,
        role: 'client',
        active: true
      },
      { onConflict: 'organization_id,user_id' }
    );

    await repairClientPortalAccessForUser(input.admin, clientProfile.id, email);

    let emailSent = false;
    if (input.sendEmail !== false) {
      const emailResult = await sendClientInviteEmail({
        to: email,
        organizationName: input.organizationName,
        acceptUrl: appUrl('/portal/client'),
        jobTitle: input.jobTitle,
        portalUrl: clientPortalUrl(portalToken)
      });
      emailSent = emailResult.sent;
    }

    return {
      ok: true,
      reused: false,
      accessGranted: true,
      emailSent,
      message: 'Client access granted. The shared job is available now.'
    };
  }

  const { data: pendingInvite } = await input.admin
    .from('organization_invitations')
    .select('id, token')
    .eq('organization_id', input.organizationId)
    .eq('job_id', input.jobId)
    .eq('role', 'client')
    .eq('status', 'pending')
    .ilike('email', email)
    .maybeSingle();

  if (pendingInvite?.token) {
    return {
      ok: true,
      reused: true,
      accessGranted: false,
      emailSent: false,
      message: 'Client invitation already pending for this email.'
    };
  }

  const { data: invite, error: inviteError } = await input.admin
    .from('organization_invitations')
    .insert({
      organization_id: input.organizationId,
      email,
      role: 'client',
      invited_by: input.grantedByUserId,
      status: 'pending',
      job_id: input.jobId
    })
    .select('token')
    .single();

  if (inviteError || !invite?.token) {
    return {
      ok: false,
      error: inviteError?.message || 'Unable to create client invitation.',
      code: 'invite_failed'
    };
  }

  let emailSent = false;
  if (input.sendEmail !== false) {
    const emailResult = await sendClientInviteEmail({
      to: email,
      organizationName: input.organizationName,
      acceptUrl: appUrl(`/team/accept?token=${invite.token}`),
      jobTitle: input.jobTitle
    });
    emailSent = emailResult.sent;
  }

  return {
    ok: true,
    reused: false,
    accessGranted: false,
    emailSent,
    message: emailSent
      ? 'Invitation sent. Access will appear after the client accepts.'
      : 'Invitation created. Access will appear after the client accepts.'
  };
}
