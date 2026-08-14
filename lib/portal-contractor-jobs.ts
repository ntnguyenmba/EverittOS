import type { SupabaseClient } from '@supabase/supabase-js';
import {
  contractorIdentityFromWorkers,
  uniqueWorkerIds,
  type ContractorLaborRow
} from '@/lib/contractor-dashboard';
import {
  contractorCanAccessJob,
  toContractorSafeJobView,
  type ContractorSafeJobView
} from '@/lib/contractor-job-access';
import {
  CONTRACTOR_SAFE_JOB_COLUMNS,
  contractorEarningsTotals,
  contractorPayFromLabor
} from '@/lib/portal-role-financials';

export type ContractorPortalJobRow = {
  id: string;
  title: string | null;
  customerName: string | null;
  address: string | null;
  status: string | null;
  scheduledStart: string | null;
  startDate: string | null;
  dueDate: string | null;
  payAmount: number | null;
  paymentStatus: 'paid' | 'pending' | 'unpaid' | null;
};

export type ContractorPortalTotals = {
  assigned: number;
  upcoming: number;
  completed: number;
  total: number;
  paid: number;
  owed: number;
};

type WorkerRow = {
  id?: string | null;
  auth_user_id?: string | null;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
};

type JobRow = {
  id: string;
  title?: string | null;
  customer_name?: string | null;
  address?: string | null;
  status?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  scheduled_start?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
  customer_notes?: string | null;
  phone?: string | null;
};

function normalizedStatus(value: string | null | undefined) {
  return String(value || 'scheduled')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function isCompleted(value: string | null | undefined) {
  return ['completed', 'complete', 'done', 'finished', 'closed'].includes(normalizedStatus(value));
}

function isCancelled(value: string | null | undefined) {
  return ['cancelled', 'canceled'].includes(normalizedStatus(value));
}

async function resolveContractorWorkers(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
) {
  const workerFields = 'id, auth_user_id, email, name, full_name';
  const lookupEmail = String(email || '')
    .trim()
    .toLowerCase();
  const [byUser, byEmail] = await Promise.all([
    supabase.from('workers').select(workerFields).eq('auth_user_id', userId),
    lookupEmail
      ? supabase.from('workers').select(workerFields).ilike('email', lookupEmail)
      : Promise.resolve({ data: [] as WorkerRow[], error: null })
  ]);

  if (byUser.error && byEmail.error) {
    return { ok: false as const, error: byUser.error.message || byEmail.error.message };
  }

  const workerMap = new Map<string, WorkerRow>();
  for (const row of [...((byUser.data || []) as WorkerRow[]), ...((byEmail.data || []) as WorkerRow[])]) {
    if (row.id) workerMap.set(String(row.id), row);
  }
  const workers = Array.from(workerMap.values());
  const identity = contractorIdentityFromWorkers(userId, workers, lookupEmail);
  const workerIds = uniqueWorkerIds(identity.workerIds || workers.map((row) => row.id));
  const workerName =
    workers.find((row) => String(row.name || row.full_name || '').trim())?.name ||
    workers.find((row) => String(row.full_name || '').trim())?.full_name ||
    lookupEmail ||
    '';

  return { ok: true as const, workerIds, workerName: String(workerName || '').trim() };
}

function toListJob(job: JobRow, pay: ReturnType<typeof contractorPayFromLabor>): ContractorPortalJobRow {
  return {
    id: job.id,
    title: job.title || null,
    customerName: job.customer_name || null,
    address: job.address || null,
    status: job.status || null,
    scheduledStart: job.scheduled_start || null,
    startDate: job.start_date || null,
    dueDate: job.due_date || null,
    payAmount: pay.payAmount,
    paymentStatus: pay.paymentStatus
  };
}

export async function loadContractorPortalDashboard(input: {
  supabase: SupabaseClient;
  userId: string;
  email?: string | null;
}): Promise<
  | { ok: true; notLinked: true; workerName: string }
  | {
      ok: true;
      notLinked?: false;
      workerName: string;
      jobs: ContractorPortalJobRow[];
      totals: ContractorPortalTotals;
    }
  | { ok: false; error: string; status: number }
> {
  const workers = await resolveContractorWorkers(input.supabase, input.userId, input.email);
  if (!workers.ok) {
    return { ok: false, error: workers.error, status: 500 };
  }
  if (!workers.workerIds.length) {
    return { ok: true, notLinked: true, workerName: workers.workerName };
  }

  const workerIds = workers.workerIds;
  const [assignmentsResult, directJobsResult, laborResult] = await Promise.all([
    input.supabase.from('job_assignments').select('job_id, worker_id').in('worker_id', workerIds),
    input.supabase.from('jobs').select(CONTRACTOR_SAFE_JOB_COLUMNS).in('assigned_to', workerIds),
    input.supabase
      .from('job_labor')
      .select('id, job_id, worker_id, total_cost, payment_status')
      .in('worker_id', workerIds)
  ]);

  if (assignmentsResult.error) {
    return { ok: false, error: assignmentsResult.error.message, status: 500 };
  }
  if (directJobsResult.error) {
    return { ok: false, error: directJobsResult.error.message, status: 500 };
  }
  if (laborResult.error) {
    return { ok: false, error: laborResult.error.message, status: 500 };
  }

  const assignments = (assignmentsResult.data || []) as Array<{ job_id: string; worker_id: string }>;
  const assignmentJobIds = Array.from(new Set(assignments.map((row) => row.job_id).filter(Boolean)));
  let assignedJobs: JobRow[] = [];
  if (assignmentJobIds.length) {
    const assignedResult = await input.supabase
      .from('jobs')
      .select(CONTRACTOR_SAFE_JOB_COLUMNS)
      .in('id', assignmentJobIds);
    if (assignedResult.error) {
      return { ok: false, error: assignedResult.error.message, status: 500 };
    }
    assignedJobs = (assignedResult.data || []) as JobRow[];
  }

  const merged = new Map<string, JobRow>();
  for (const job of [...((directJobsResult.data || []) as JobRow[]), ...assignedJobs]) {
    if (
      contractorCanAccessJob({
        job: { id: job.id, status: job.status, assigned_to: job.assigned_to },
        workerIds,
        userId: input.userId,
        assignments
      })
    ) {
      merged.set(job.id, job);
    }
  }

  const labor = (laborResult.data || []) as ContractorLaborRow[];
  const jobs = Array.from(merged.values()).map((job) =>
    toListJob(job, contractorPayFromLabor(labor, workerIds, job.id))
  );
  const earnings = contractorEarningsTotals(labor, workerIds);
  const upcoming = jobs.filter((job) => !isCompleted(job.status) && !isCancelled(job.status)).length;
  const completed = jobs.filter((job) => isCompleted(job.status)).length;

  return {
    ok: true,
    workerName: workers.workerName,
    jobs,
    totals: {
      assigned: jobs.length,
      upcoming,
      completed,
      total: earnings.total,
      paid: earnings.paid,
      owed: earnings.owed
    }
  };
}

export async function loadContractorPortalJob(input: {
  supabase: SupabaseClient;
  userId: string;
  email?: string | null;
  jobId: string;
}): Promise<
  | { ok: true; job: ContractorSafeJobView }
  | { ok: false; error: string; status: number }
> {
  const workers = await resolveContractorWorkers(input.supabase, input.userId, input.email);
  if (!workers.ok) {
    return { ok: false, error: workers.error, status: 500 };
  }
  if (!workers.workerIds.length) {
    return { ok: false, error: 'Your login is not linked to a contractor profile yet.', status: 403 };
  }

  const [{ data: job, error: jobError }, { data: assignments, error: assignmentError }] = await Promise.all([
    input.supabase.from('jobs').select(CONTRACTOR_SAFE_JOB_COLUMNS).eq('id', input.jobId).maybeSingle(),
    input.supabase.from('job_assignments').select('job_id, worker_id').eq('job_id', input.jobId)
  ]);

  if (jobError) {
    return { ok: false, error: jobError.message, status: 500 };
  }
  if (assignmentError) {
    return { ok: false, error: assignmentError.message, status: 500 };
  }
  if (!job) {
    return { ok: false, error: 'Job not found.', status: 404 };
  }

  const allowed = contractorCanAccessJob({
    job: { id: job.id, status: job.status, assigned_to: job.assigned_to },
    workerIds: workers.workerIds,
    userId: input.userId,
    assignments: assignments || []
  });
  if (!allowed) {
    return { ok: false, error: 'You do not have access to this job.', status: 403 };
  }

  const { data: labor, error: laborError } = workers.workerIds.length
    ? await input.supabase
        .from('job_labor')
        .select('total_cost, payment_status, worker_id, job_id')
        .eq('job_id', input.jobId)
        .in('worker_id', workers.workerIds)
    : { data: [] as ContractorLaborRow[], error: null };

  if (laborError) {
    return { ok: false, error: laborError.message, status: 500 };
  }

  const pay = contractorPayFromLabor((labor || []) as ContractorLaborRow[], workers.workerIds, input.jobId);
  return {
    ok: true,
    job: toContractorSafeJobView({
      id: job.id,
      title: job.title,
      status: job.status,
      start_date: job.start_date,
      due_date: job.due_date,
      scheduled_start: job.scheduled_start,
      address: job.address,
      notes: job.notes,
      customer_notes: job.customer_notes,
      customer_name: job.customer_name,
      phone: job.phone,
      payAmount: pay.payAmount,
      paymentStatus: pay.paymentStatus
    })
  };
}
