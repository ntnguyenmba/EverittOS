import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScheduleJob } from '@/components/schedule-views';
import { expandScheduleJobsByVisits, type ScheduleVisit } from '@/lib/schedule-visits';

type WorkerRow = { id: string; name: string };

export async function loadScheduleVisits(
  supabase: SupabaseClient,
  jobs: ScheduleJob[],
  organizationId?: string | null
): Promise<ScheduleJob[]> {
  const jobIds = jobs.map((job) => job.id).filter(Boolean);
  if (!jobIds.length) return jobs;

  let query = supabase
    .from('job_visits')
    .select('id, job_id, visit_date, start_time, end_time, notes')
    .in('job_id', jobIds)
    .order('visit_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data } = await query;
  return expandScheduleJobsByVisits(jobs, (data || []) as ScheduleVisit[]);
}

export async function loadWorkerNames(
  supabase: SupabaseClient,
  userId: string,
  organizationId?: string | null
): Promise<Record<string, string>> {
  let query = supabase.from('workers').select('id, name').order('name');
  query = organizationId ? query.eq('organization_id', organizationId) : query.eq('user_id', userId);

  const { data } = await query;
  const map: Record<string, string> = {};
  ((data || []) as WorkerRow[]).forEach((worker) => {
    map[worker.id] = worker.name;
  });
  return map;
}
