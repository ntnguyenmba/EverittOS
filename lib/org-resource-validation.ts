import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidUuid } from '@/lib/input-validation';

export async function assertCustomerInOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  customerId: string | null | undefined
): Promise<string | null> {
  if (!customerId) return null;
  if (!isValidUuid(customerId)) return 'Invalid customer id.';
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (!data) return 'Customer not found in this workspace.';
  return null;
}

export async function assertJobInOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  jobId: string | null | undefined
): Promise<string | null> {
  if (!jobId) return null;
  if (!isValidUuid(jobId)) return 'Invalid job id.';
  const { data } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (!data) return 'Job not found in this workspace.';
  return null;
}
