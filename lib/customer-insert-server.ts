import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabase } from '@/lib/supabase-admin';
import { logSaveFlowEvent } from '@/lib/save-flow-log';
import {
  mapWorkspaceSaveError,
  resolveCompanyIdForUser,
  type CurrentWorkspace
} from '@/lib/workspace-server';

type InsertCustomerInput = {
  supabase: SupabaseClient;
  userId: string;
  workspace: CurrentWorkspace;
  row: Record<string, unknown>;
};

export async function insertCustomerRecord(input: InsertCustomerInput): Promise<
  | { ok: true; id: string }
  | { ok: false; error: string; code?: string }
> {
  const { supabase, userId, workspace, row } = input;

  let payload = { ...row };
  if (workspace.companyId) {
    payload = { ...payload, company_id: workspace.companyId };
  }

  let result = await supabase.from('customers').insert(payload).select('id').single();

  if (result.error) {
    const lower = result.error.message.toLowerCase();
    logSaveFlowEvent('customer_insert_failed', {
      userId,
      organizationId: workspace.organizationId,
      reason: result.error.message
    });

    if (lower.includes('company_id')) {
      const admin = createAdminSupabase();
      if (admin) {
        const { data: profile } = await admin
          .from('profiles')
          .select('business_name')
          .eq('id', userId)
          .maybeSingle();

        const companyId = await resolveCompanyIdForUser(
          admin,
          userId,
          workspace.ownerUserId,
          profile?.business_name
        );

        if (companyId) {
          payload = { ...payload, company_id: companyId };
          result = await supabase.from('customers').insert(payload).select('id').single();
        }

        if (result.error) {
          const adminResult = await admin.from('customers').insert(payload).select('id').single();
          result = adminResult;
        }
      }
    }
  }

  if (result.error || !result.data?.id) {
    return {
      ok: false,
      error: mapWorkspaceSaveError(result.error?.message || '', 'Unable to save customer. Please try again.'),
      code: 'customer_insert_failed'
    };
  }

  logSaveFlowEvent('customer_insert_ok', {
    userId,
    organizationId: workspace.organizationId,
    customerId: result.data.id
  });

  return { ok: true, id: result.data.id };
}
