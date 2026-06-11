import { supabase } from '@/lib/supabase';

/** Count photos per job id (for job cards and lists). */
export async function fetchPhotoCountsByJobIds(jobIds: string[]): Promise<Record<string, number>> {
  if (jobIds.length === 0) return {};

  const { data, error } = await supabase.from('job_photos').select('job_id').in('job_id', jobIds);

  if (error) return {};

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const id = row.job_id as string;
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}
