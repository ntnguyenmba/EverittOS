import type { SupabaseClient } from '@supabase/supabase-js';

type AssignmentInput = {
  organizationId: string;
  userId: string;
  jobId: string;
  workerId: string;
};

/**
 * Keep a job's canonical assigned worker and assignment row in sync.
 * Falls back to a checked insert when older databases do not support the
 * job_id,worker_id upsert conflict target.
 */
export async function saveJobAssignment(
  supabase: SupabaseClient,
  input: AssignmentInput
): Promise<{ ok: boolean; error?: string }> {
  const row = {
    organization_id: input.organizationId,
    user_id: input.userId,
    job_id: input.jobId,
    worker_id: input.workerId
  };

  const { error: jobError } = await supabase
    .from('jobs')
    .update({ assigned_to: input.workerId })
    .eq('id', input.jobId)
    .eq('organization_id', input.organizationId);

  if (jobError) return { ok: false, error: jobError.message };

  const { error: upsertError } = await supabase
    .from('job_assignments')
    .upsert(row, { onConflict: 'job_id,worker_id', ignoreDuplicates: true });

  if (!upsertError) return { ok: true };

  const { data: existing, error: lookupError } = await supabase
    .from('job_assignments')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('job_id', input.jobId)
    .eq('worker_id', input.workerId)
    .maybeSingle();

  if (lookupError) return { ok: false, error: lookupError.message };
  if (existing?.id) return { ok: true };

  const { error: insertError } = await supabase.from('job_assignments').insert(row);
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true };
}
