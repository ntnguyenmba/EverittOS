import type { ScheduleJob } from '@/components/schedule-views';

export type ScheduleVisit = {
  id: string;
  job_id: string;
  visit_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
};

export function expandScheduleJobsByVisits(jobs: ScheduleJob[], visits: ScheduleVisit[]): ScheduleJob[] {
  const visitsByJob = new Map<string, ScheduleVisit[]>();
  visits.forEach((visit) => {
    const current = visitsByJob.get(visit.job_id) || [];
    current.push(visit);
    visitsByJob.set(visit.job_id, current);
  });

  return jobs.flatMap((job) => {
    const jobVisits = visitsByJob.get(job.id) || [];
    if (!jobVisits.length) return [job];
    return jobVisits.map((visit) => ({
      ...job,
      schedule_key: `${job.id}:${visit.id}`,
      visit_id: visit.id,
      visit_date: visit.visit_date,
      visit_start_time: visit.start_time,
      visit_end_time: visit.end_time,
      visit_notes: visit.notes
    }));
  });
}
