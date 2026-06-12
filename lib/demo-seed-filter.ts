import {
  isDemoSeedCustomer,
  isDemoSeedJob,
  isDemoSeedWorker
} from '@/lib/demo-seed-patterns';

type WorkerRow = { name?: string | null; phone?: string | null };
type CustomerRow = { company_name?: string | null; phone?: string | null; email?: string | null };
type JobRow = { title?: string | null; customer_name?: string | null };

/** Strip known demo seed rows from non-demo organizations (belt-and-suspenders with DB cleanup). */
export function filterDemoSeedWorkers<T extends WorkerRow>(rows: T[], organizationIsDemo: boolean): T[] {
  if (organizationIsDemo) return rows;
  return rows.filter((row) => !isDemoSeedWorker(row));
}

export function filterDemoSeedCustomers<T extends CustomerRow>(rows: T[], organizationIsDemo: boolean): T[] {
  if (organizationIsDemo) return rows;
  return rows.filter((row) => !isDemoSeedCustomer(row));
}

export function filterDemoSeedJobs<T extends JobRow>(rows: T[], organizationIsDemo: boolean): T[] {
  if (organizationIsDemo) return rows;
  return rows.filter((row) => !isDemoSeedJob(row));
}
