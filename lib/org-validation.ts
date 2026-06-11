import type { SupabaseClient } from '@supabase/supabase-js';

export async function workflowBelongsToOrg(
  admin: SupabaseClient,
  workflowId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await admin
    .from('workflow_templates')
    .select('id')
    .eq('id', workflowId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function departmentBelongsToOrg(
  admin: SupabaseClient,
  departmentId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await admin
    .from('departments')
    .select('id')
    .eq('id', departmentId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function userBelongsToOrg(
  admin: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await admin
    .from('organization_members')
    .select('user_id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('active', true)
    .maybeSingle();
  return Boolean(data?.user_id);
}

export async function customerBelongsToOrg(
  admin: SupabaseClient,
  customerId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await admin
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function workerBelongsToOrg(
  admin: SupabaseClient,
  workerId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await admin
    .from('workers')
    .select('id')
    .eq('id', workerId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function workflowStepBelongsToOrg(
  admin: SupabaseClient,
  stepId: string,
  workflowId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await admin
    .from('workflow_steps')
    .select('id')
    .eq('id', stepId)
    .eq('workflow_id', workflowId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  return Boolean(data?.id);
}

export const ALLOWED_JOB_STATUSES = new Set([
  'new',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'on_hold'
]);
