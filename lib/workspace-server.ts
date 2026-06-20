import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureUserWorkspace } from '@/lib/profile-bootstrap-server';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import type { OrganizationContext } from '@/lib/organization-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { logSaveFlowEvent } from '@/lib/save-flow-log';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { diagnoseWorkspaceLinkage, repairWorkspaceLinkage } from '@/lib/workspace-repair';
import { logWorkspaceRepair } from '@/lib/workspace-repair-log';

export type CurrentWorkspace = OrganizationContext & {
  companyId: string | null;
};

export type WorkspaceResult =
  | { ok: true; workspace: CurrentWorkspace }
  | { ok: false; status: number; error: string; code?: string };

function isMissingRelationOrColumn(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('does not exist') ||
    lower.includes('could not find') ||
    lower.includes('schema cache') ||
    lower.includes('column')
  );
}

async function lookupCompanyId(
  admin: SupabaseClient,
  userId: string,
  ownerUserId: string
): Promise<string | null> {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('company_id, business_name')
    .eq('id', userId)
    .maybeSingle();

  if (!profileError && profile?.company_id) {
    return profile.company_id;
  }

  const ownerLookup = await admin
    .from('companies')
    .select('id')
    .eq('owner_id', ownerUserId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!ownerLookup.error && ownerLookup.data?.id) {
    return ownerLookup.data.id;
  }
  if (ownerLookup.error && isMissingRelationOrColumn(ownerLookup.error.message)) {
    return null;
  }

  const userLookup = await admin
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!userLookup.error && userLookup.data?.id) {
    return userLookup.data.id;
  }
  if (userLookup.error && isMissingRelationOrColumn(userLookup.error.message)) {
    return null;
  }

  return null;
}

async function createCompanyRecord(
  admin: SupabaseClient,
  userId: string,
  ownerUserId: string,
  businessName?: string | null,
  organizationId?: string | null
): Promise<string | null> {
  const label = businessName?.trim() || 'My Business';

  const attempts: Array<Record<string, string>> = [
    ...(organizationId
      ? [
          { owner_id: ownerUserId, organization_id: organizationId, company_name: label },
          { user_id: userId, organization_id: organizationId, name: label },
          { organization_id: organizationId, company_name: label }
        ]
      : []),
    { owner_id: ownerUserId, company_name: label },
    { user_id: userId, name: label },
    { owner_id: ownerUserId, name: label },
    { user_id: userId, company_name: label },
    { owner_id: ownerUserId },
    { user_id: userId }
  ];

  for (const row of attempts) {
    const { data, error } = await admin.from('companies').insert(row).select('id').single();
    if (!error && data?.id) {
      return data.id;
    }
    if (error && isMissingRelationOrColumn(error.message)) {
      continue;
    }
    if (error) {
      logSaveFlowEvent('company_insert_attempt_failed', {
        userId,
        reason: error.message
      });
    }
  }

  return null;
}

async function linkProfileCompanyId(admin: SupabaseClient, userId: string, companyId: string): Promise<void> {
  const { error } = await admin.from('profiles').update({ company_id: companyId }).eq('id', userId);
  if (error && !isMissingRelationOrColumn(error.message)) {
    /* non-fatal */
  }
}

export async function resolveCompanyIdForUser(
  admin: SupabaseClient,
  userId: string,
  ownerUserId: string,
  businessName?: string | null,
  organizationId?: string | null
): Promise<string | null> {
  let companyId = await lookupCompanyId(admin, userId, ownerUserId);
  if (companyId) return companyId;

  companyId = await createCompanyRecord(admin, userId, ownerUserId, businessName, organizationId);
  if (!companyId) {
    const { data: rpcId, error: rpcError } = await admin.rpc('ensure_user_company', { p_user_id: userId });
    if (!rpcError && rpcId) {
      companyId = rpcId as string;
    } else if (rpcError) {
      logSaveFlowEvent('ensure_user_company_rpc_failed', {
        userId,
        reason: rpcError.message
      });
    }
  }
  if (!companyId) {
    logSaveFlowEvent('company_resolve_failed', { userId, organizationId: organizationId || null });
    return null;
  }

  await linkProfileCompanyId(admin, userId, companyId);
  return companyId;
}

/** Whether to attempt company resolution before customer writes. */
export async function customersRequireCompanyId(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.from('customers').select('company_id').limit(0);
  if (error && isMissingRelationOrColumn(error.message)) {
    return false;
  }
  return Boolean(!error);
}

/** Server-side workspace for the signed-in user, with optional bootstrap repair. */
export async function getCurrentWorkspaceForUser(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    email?: string;
    userMetadata?: Record<string, unknown>;
    repair?: boolean;
    requireCompany?: boolean;
  }
): Promise<WorkspaceResult> {
  let org = await fetchOrganizationContextForRequest(supabase, userId);

  if (!org && options?.repair !== false) {
    const admin = createAdminSupabase();
    if (admin) {
      const repair = await repairWorkspaceLinkage(admin, userId, {
        email: options?.email,
        userMetadata: options?.userMetadata
      });

      logSaveFlowEvent('workspace_repair_attempted', {
        userId,
        repaired: repair.repaired ? 1 : 0,
        missingRecords: repair.diagnosis.missingRecords.join(',') || 'none',
        organizationId: repair.diagnosis.organizationId || null,
        membershipId: repair.diagnosis.membershipId || null
      });

      if (repair.repaired) {
        org = await fetchOrganizationContextForRequest(supabase, userId);
      }
    }

    if (!org) {
      const bootstrap = await ensureUserWorkspace(
        userId,
        options?.email || '',
        options?.userMetadata,
        supabase
      );
      if (!bootstrap.ok) {
        return {
          ok: false,
          status: bootstrap.code === 'bootstrap_unavailable' ? 503 : 409,
          error: bootstrap.message,
          code: bootstrap.code
        };
      }
      org = await fetchOrganizationContextForRequest(supabase, userId);
    }
  }

  if (!org?.organizationId) {
    const admin = createAdminSupabase();
    const diagnosis = admin ? await diagnoseWorkspaceLinkage(admin, userId) : null;
    const missing = diagnosis?.missingRecords?.length
      ? diagnosis.missingRecords.join(', ')
      : 'organization context';

    logWorkspaceRepair(
      'workspace:repair_failed',
      {
        userId,
        workspaceId: diagnosis?.workspaceId || null,
        organizationId: diagnosis?.organizationId || null,
        ownerUserId: diagnosis?.ownerUserId || null,
        membershipId: diagnosis?.membershipId || null,
        profileId: diagnosis?.profileId || null,
        missingRecords: diagnosis?.missingRecords || ['organization context'],
        blockReason: 'workspace_missing'
      },
      'error'
    );

    return {
      ok: false,
      status: 409,
      error: `Workspace linkage incomplete (missing: ${missing}). Refresh the page or sign out and sign back in.`,
      code: 'workspace_missing'
    };
  }

  const admin = createAdminSupabase();
  let companyId: string | null = null;

  if (admin) {
    const needsCompany = await customersRequireCompanyId(admin);
    if (needsCompany) {
      const { data: profile } = await admin
        .from('profiles')
        .select('business_name')
        .eq('id', userId)
        .maybeSingle();

      companyId = await resolveCompanyIdForUser(
        admin,
        userId,
        org.ownerUserId,
        profile?.business_name,
        org.organizationId
      );

      if (!companyId) {
        logSaveFlowEvent('company_missing_nonblocking', {
          userId,
          organizationId: org.organizationId,
          requireCompany: options?.requireCompany ? 1 : 0
        });
      }
    } else {
      logSaveFlowEvent('admin_client_unavailable', { userId, organizationId: org.organizationId });
    }
  }

  return {
    ok: true,
    workspace: {
      ...org,
      companyId
    }
  };
}

export function workspaceScopedFields(
  workspace: CurrentWorkspace,
  userId: string
): { user_id: string; organization_id: string; company_id?: string } {
  const fields: { user_id: string; organization_id: string; company_id?: string } = {
    user_id: userId,
    organization_id: workspace.organizationId
  };
  if (workspace.companyId) {
    fields.company_id = workspace.companyId;
  }
  return fields;
}

/** Organization context with automatic workspace and membership repair. */
export async function fetchOrganizationContextWithRepair(
  supabase: SupabaseClient,
  userId: string,
  options?: { email?: string; userMetadata?: Record<string, unknown> }
): Promise<OrganizationContext | null> {
  const result = await getCurrentWorkspaceForUser(supabase, userId, {
    email: options?.email,
    userMetadata: options?.userMetadata,
    repair: true
  });
  if (!result.ok) return null;
  const workspace = result.workspace;
  return {
    organizationId: workspace.organizationId,
    organizationName: workspace.organizationName,
    role: workspace.role,
    ownerUserId: workspace.ownerUserId
  };
}

export function mapWorkspaceSaveError(message: string, fallback = 'Unable to save. Try again.'): string {
  const lower = message.toLowerCase();
  if (lower.includes('company_id')) {
    return 'Workspace setup is still finishing. Refresh the page and try again.';
  }
  if (lower.includes('organization_id') && lower.includes('not-null')) {
    return 'Workspace setup is still finishing. Refresh and try again.';
  }
  return friendlyErrorMessage(message, fallback);
}
