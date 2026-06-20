import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureUserWorkspace } from '@/lib/profile-bootstrap-server';
import { updateProfileLink } from '@/lib/profile-query';
import { normalizeRole, roleToDb } from '@/lib/roles';
import { logWorkspaceRepair } from '@/lib/workspace-repair-log';

export type WorkspaceLinkageDiagnosis = {
  userId: string;
  profileId: string | null;
  profileOrganizationId: string | null;
  workspaceId: string | null;
  organizationId: string | null;
  organizationExists: boolean;
  ownerUserId: string | null;
  ownerProfileExists: boolean;
  membershipId: string | null;
  membershipActive: boolean;
  ownedOrganizationId: string | null;
  missingRecords: string[];
};

export type WorkspaceRepairResult = {
  diagnosis: WorkspaceLinkageDiagnosis;
  repaired: boolean;
  repairActions: string[];
  error?: string;
};

function pushMissing(list: string[], key: string) {
  if (!list.includes(key)) list.push(key);
}

export function computeMissingWorkspaceRecords(input: {
  profileId: string | null;
  profileOrganizationId: string | null;
  organizationId: string | null;
  organizationExists: boolean;
  ownerUserId: string | null;
  ownerProfileExists: boolean;
  membershipId: string | null;
  membershipActive: boolean;
}): string[] {
  const missingRecords: string[] = [];
  if (!input.profileId) pushMissing(missingRecords, 'profile');
  if (!input.organizationId) pushMissing(missingRecords, 'organization_id');
  if (input.organizationId && !input.organizationExists) {
    pushMissing(missingRecords, 'organization');
  } else {
    if (input.organizationId && input.ownerUserId && !input.ownerProfileExists) {
      pushMissing(missingRecords, 'owner_profile');
    }
    if (input.organizationId && !input.membershipActive) pushMissing(missingRecords, 'organization_members');
    if (input.organizationId && input.membershipActive && !input.profileOrganizationId) {
      pushMissing(missingRecords, 'profile_organization_link');
    }
  }
  return missingRecords;
}

export async function diagnoseWorkspaceLinkage(
  admin: SupabaseClient,
  userId: string
): Promise<WorkspaceLinkageDiagnosis> {
  const { data: profile } = await admin
    .from('profiles')
    .select('id, organization_id, role')
    .eq('id', userId)
    .maybeSingle();

  const { data: memberships } = await admin
    .from('organization_members')
    .select('id, organization_id, role, active')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const activeMembership = memberships?.find((row) => row.active) || null;
  const anyMembership = activeMembership || memberships?.[0] || null;

  const { data: ownedOrg } = await admin
    .from('organizations')
    .select('id, owner_user_id')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const organizationId =
    profile?.organization_id || activeMembership?.organization_id || anyMembership?.organization_id || ownedOrg?.id || null;

  const { data: organization } = organizationId
    ? await admin.from('organizations').select('id, owner_user_id').eq('id', organizationId).maybeSingle()
    : { data: null };

  const ownerUserId = organization?.owner_user_id || ownedOrg?.owner_user_id || null;
  const { data: ownerProfile } = ownerUserId
    ? await admin.from('profiles').select('id').eq('id', ownerUserId).maybeSingle()
    : { data: null };

  const missingRecords = computeMissingWorkspaceRecords({
    profileId: profile?.id || null,
    profileOrganizationId: profile?.organization_id || null,
    organizationId,
    organizationExists: Boolean(organization?.id),
    ownerUserId,
    ownerProfileExists: Boolean(ownerProfile?.id),
    membershipId: activeMembership?.id || anyMembership?.id || null,
    membershipActive: Boolean(activeMembership?.id)
  });

  const diagnosis: WorkspaceLinkageDiagnosis = {
    userId,
    profileId: profile?.id || null,
    profileOrganizationId: profile?.organization_id || null,
    workspaceId: organizationId,
    organizationId,
    organizationExists: Boolean(organization?.id),
    ownerUserId,
    ownerProfileExists: Boolean(ownerProfile?.id),
    membershipId: activeMembership?.id || anyMembership?.id || null,
    membershipActive: Boolean(activeMembership?.id),
    ownedOrganizationId: ownedOrg?.id || null,
    missingRecords
  };

  logWorkspaceRepair('workspace:diagnose', diagnosis);

  for (const missing of missingRecords) {
    logWorkspaceRepair('workspace:missing_record', {
      userId,
      workspaceId: organizationId,
      organizationId,
      ownerUserId,
      membershipId: diagnosis.membershipId,
      profileId: diagnosis.profileId,
      missingRecord: missing
    });
  }

  return diagnosis;
}

export async function repairWorkspaceLinkage(
  admin: SupabaseClient,
  userId: string,
  options?: { email?: string; userMetadata?: Record<string, unknown> }
): Promise<WorkspaceRepairResult> {
  const diagnosis = await diagnoseWorkspaceLinkage(admin, userId);
  const repairActions: string[] = [];

  if (!diagnosis.missingRecords.length) {
    return { diagnosis, repaired: false, repairActions };
  }

  logWorkspaceRepair('workspace:repair_attempt', {
    userId,
    workspaceId: diagnosis.workspaceId,
    organizationId: diagnosis.organizationId,
    ownerUserId: diagnosis.ownerUserId,
    membershipId: diagnosis.membershipId,
    profileId: diagnosis.profileId,
    missingRecords: diagnosis.missingRecords
  });

  let organizationId = diagnosis.organizationId;

  if (!diagnosis.profileId || !organizationId) {
    const bootstrap = await ensureUserWorkspace(
      userId,
      options?.email || '',
      options?.userMetadata,
      admin
    );

    if (!bootstrap.ok) {
      logWorkspaceRepair(
        'workspace:repair_failed',
        {
          userId,
          reason: bootstrap.code,
          details: bootstrap.details || bootstrap.message,
          missingRecords: diagnosis.missingRecords
        },
        'error'
      );
      return {
        diagnosis,
        repaired: false,
        repairActions,
        error: bootstrap.message
      };
    }

    repairActions.push('ensure_user_workspace');
    const refreshed = await diagnoseWorkspaceLinkage(admin, userId);
    return {
      diagnosis: refreshed,
      repaired: refreshed.missingRecords.length === 0,
      repairActions
    };
  }

  if (diagnosis.missingRecords.includes('organization')) {
    const bootstrap = await ensureUserWorkspace(
      userId,
      options?.email || '',
      options?.userMetadata,
      admin
    );
    if (!bootstrap.ok) {
      return {
        diagnosis,
        repaired: false,
        repairActions,
        error: bootstrap.message
      };
    }
    repairActions.push('recreate_organization');
    const refreshed = await diagnoseWorkspaceLinkage(admin, userId);
    return {
      diagnosis: refreshed,
      repaired: refreshed.missingRecords.length === 0,
      repairActions
    };
  }

  organizationId = diagnosis.organizationId!;
  const role = roleToDb(
    normalizeRole(
      (await admin.from('profiles').select('role').eq('id', userId).maybeSingle()).data?.role ||
        (diagnosis.ownerUserId === userId ? 'owner' : 'admin')
    )
  );

  if (
    diagnosis.missingRecords.includes('organization_members') ||
    (diagnosis.membershipId && !diagnosis.membershipActive)
  ) {
    const { data: membership, error } = await admin
      .from('organization_members')
      .upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          role,
          active: true
        },
        { onConflict: 'organization_id,user_id' }
      )
      .select('id')
      .maybeSingle();

    if (error) {
      logWorkspaceRepair(
        'workspace:repair_failed',
        {
          userId,
          organizationId,
          reason: 'organization_members_upsert_failed',
          details: error.message
        },
        'error'
      );
      return {
        diagnosis,
        repaired: false,
        repairActions,
        error: error.message
      };
    }

    repairActions.push('organization_members');
    logWorkspaceRepair('workspace:repair_completed', {
      userId,
      organizationId,
      membershipId: membership?.id || diagnosis.membershipId,
      repairAction: 'organization_members'
    });
  }

  if (diagnosis.missingRecords.includes('profile_organization_link')) {
    const link = await updateProfileLink(admin, userId, organizationId, role);
    if (link.error || !link.profile) {
      logWorkspaceRepair(
        'workspace:repair_failed',
        {
          userId,
          organizationId,
          reason: 'profile_organization_link_failed',
          details: link.error || 'profile update returned no row'
        },
        'error'
      );
      return {
        diagnosis,
        repaired: false,
        repairActions,
        error: link.error || 'Unable to link profile to organization.'
      };
    }
    repairActions.push('profile_organization_link');
  }

  const refreshed = await diagnoseWorkspaceLinkage(admin, userId);
  const repaired = refreshed.missingRecords.length === 0;

  logWorkspaceRepair(repaired ? 'workspace:repair_completed' : 'workspace:repair_failed', {
    userId,
    workspaceId: refreshed.workspaceId,
    organizationId: refreshed.organizationId,
    ownerUserId: refreshed.ownerUserId,
    membershipId: refreshed.membershipId,
    profileId: refreshed.profileId,
    repairActions,
    remainingMissingRecords: refreshed.missingRecords
  }, repaired ? 'log' : 'error');

  return {
    diagnosis: refreshed,
    repaired,
    repairActions,
    error: repaired ? undefined : `Missing records remain: ${refreshed.missingRecords.join(', ')}`
  };
}
