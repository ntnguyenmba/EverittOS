import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureUserWorkspace } from '@/lib/profile-bootstrap-server';
import { fetchOrganizationContextForRequest } from '@/lib/organization-request';
import type { OrganizationContext } from '@/lib/organization-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { friendlyErrorMessage } from '@/lib/user-errors';

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
  businessName?: string | null
): Promise<string | null> {
  const label = businessName?.trim() || 'My Business';

  const ownerInsert = await admin
    .from('companies')
    .insert({ owner_id: ownerUserId, company_name: label })
    .select('id')
    .single();

  if (!ownerInsert.error && ownerInsert.data?.id) {
    return ownerInsert.data.id;
  }

  const userInsert = await admin
    .from('companies')
    .insert({ user_id: userId, name: label })
    .select('id')
    .single();

  if (!userInsert.error && userInsert.data?.id) {
    return userInsert.data.id;
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
  businessName?: string | null
): Promise<string | null> {
  let companyId = await lookupCompanyId(admin, userId, ownerUserId);
  if (companyId) return companyId;

  companyId = await createCompanyRecord(admin, userId, ownerUserId, businessName);
  if (!companyId) return null;

  await linkProfileCompanyId(admin, userId, companyId);
  return companyId;
}

export async function customersRequireCompanyId(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.from('customers').select('company_id').limit(0);
  if (!error) return true;
  return !isMissingRelationOrColumn(error.message);
}

/** Server-side workspace for the signed-in user, with optional bootstrap repair. */
export async function getCurrentWorkspaceForUser(
  supabase: SupabaseClient,
  userId: string,
  options?: { email?: string; userMetadata?: Record<string, unknown>; repair?: boolean }
): Promise<WorkspaceResult> {
  let org = await fetchOrganizationContextForRequest(supabase, userId);

  if (!org && options?.repair !== false) {
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

  if (!org?.organizationId) {
    return {
      ok: false,
      status: 409,
      error: 'Workspace not found. Refresh the page or sign out and sign back in.',
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
        profile?.business_name
      );

      if (!companyId) {
        return {
          ok: false,
          status: 409,
          error: 'Your workspace company record could not be created. Contact support if this continues.',
          code: 'company_missing'
        };
      }
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

export function mapWorkspaceSaveError(message: string, fallback = 'Unable to save. Try again.'): string {
  const lower = message.toLowerCase();
  if (lower.includes('company_id') && lower.includes('not-null')) {
    return 'Your workspace company record is missing. Sign out, sign back in, and try again.';
  }
  if (lower.includes('organization_id') && lower.includes('not-null')) {
    return 'Workspace setup is still finishing. Refresh and try again.';
  }
  return friendlyErrorMessage(message, fallback);
}
