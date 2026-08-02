/**
 * Contractor dashboard domain helpers.
 *
 * Canonical earnings source: public.job_labor
 *   - total_cost = amount earned
 *   - payment_status = unpaid | pending | paid
 *   - paid_at = cash paid date
 *   - worker_id → workers.id (never customer invoice revenue)
 */

import { localToday } from '@/lib/schedule-times';
import {
  getEffectiveJobSchedule,
  isJobAssignedToWorker,
  normalizeJobStatus,
  type AssignableJob,
  type WorkerIdentity
} from '@/lib/worker-assignment';

export const CONTRACTOR_HOME_PATH = '/portal/contractor';
export const CONTRACTOR_SETTINGS_PATH = '/portal/contractor/settings';

export type ContractorLaborRow = {
  id?: string | null;
  job_id?: string | null;
  worker_id?: string | null;
  total_cost?: number | string | null;
  payment_status?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  organization_id?: string | null;
};

export type ContractorJobRow = AssignableJob & {
  id: string;
  title?: string | null;
  customer_name?: string | null;
  address?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  user_id?: string | null;
  expected_contractor_cost?: number | string | null;
};

export type ContractorDashboardMetrics = {
  assignedJobs: number;
  upcomingJobs: number;
  completedJobs: number;
  totalEarnings: number;
  paidEarnings: number;
  owedEarnings: number;
};

export type ContractorPaymentHistoryRow = {
  laborId: string;
  jobId: string | null;
  jobTitle: string;
  customerName: string;
  workDate: string | null;
  amountEarned: number;
  amountPaid: number;
  outstandingAmount: number;
  paymentStatus: 'paid' | 'pending' | 'unpaid';
  paidDate: string | null;
  workerId: string | null;
};

export type ContractorJobCardModel = {
  id: string;
  title: string;
  customerName: string;
  date: string | null;
  address: string;
  status: string;
  payAmount: number;
  payIsPlanned: boolean;
  paymentStatus: 'paid' | 'pending' | 'unpaid' | 'none';
  userId: string | null;
};

export type ContractorLoadErrorCode =
  | 'worker_not_linked'
  | 'worker_lookup_failed'
  | 'assignment_query_failed'
  | 'jobs_query_failed'
  | 'earnings_query_failed'
  | 'payment_query_failed'
  | 'access_blocked';

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeLaborPaymentStatus(status: string | null | undefined): 'paid' | 'pending' | 'unpaid' {
  const normalized = String(status || 'unpaid')
    .trim()
    .toLowerCase();
  if (normalized === 'paid') return 'paid';
  if (normalized === 'pending') return 'pending';
  return 'unpaid';
}

export function contractorNavItems(): Array<{ id: string; label: string; href: string }> {
  return [
    { id: 'overview', label: 'Dashboard', href: CONTRACTOR_HOME_PATH },
    { id: 'jobs', label: 'Jobs', href: `${CONTRACTOR_HOME_PATH}#jobs` },
    { id: 'schedule', label: 'Schedule', href: `${CONTRACTOR_HOME_PATH}#schedule` },
    { id: 'earnings', label: 'Earnings', href: `${CONTRACTOR_HOME_PATH}#earnings` },
    { id: 'account', label: 'Settings', href: CONTRACTOR_SETTINGS_PATH }
  ];
}

/** True when a "dashboard" link would loop back to the contractor home. */
export function contractorDashboardLinkLoops(href: string, currentPath = CONTRACTOR_HOME_PATH): boolean {
  const path = href.split('?')[0].split('#')[0];
  return path === currentPath || path === '/dashboard';
}

export function uniqueWorkerIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
}

function normalizePersonName(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export type ContractorWorkerCandidate = {
  id?: string | null;
  auth_user_id?: string | null;
  email?: string | null;
  name?: string | null;
  active?: boolean | null;
  organization_id?: string | null;
};

/**
 * Resolve which workers.id values belong to the signed-in contractor.
 * Never creates workers — only matches existing rows.
 *
 * Match order:
 * 1. auth_user_id === userId
 * 2. email (case-insensitive)
 * 3. unique display-name match within the provided candidate set
 */
export function contractorIdentityFromWorkers(
  userId: string,
  workers: ContractorWorkerCandidate[],
  userEmail?: string | null,
  displayName?: string | null
): WorkerIdentity {
  const email = String(userEmail || '')
    .trim()
    .toLowerCase();
  const name = normalizePersonName(displayName);

  const byAuthOrEmail = workers.filter((worker) => {
    if (worker.auth_user_id && worker.auth_user_id === userId) return true;
    if (email && String(worker.email || '').trim().toLowerCase() === email) return true;
    return false;
  });

  if (byAuthOrEmail.length) {
    return { userId, workerIds: uniqueWorkerIds(byAuthOrEmail.map((worker) => worker.id)) };
  }

  if (name) {
    const byName = workers.filter((worker) => normalizePersonName(worker.name) === name);
    if (byName.length === 1) {
      return { userId, workerIds: uniqueWorkerIds(byName.map((worker) => worker.id)) };
    }
  }

  return { userId, workerIds: [] };
}

/** Explain why a worker set failed to link — for diagnostics/tests. */
export function explainContractorWorkerLinkFailure(input: {
  userId: string;
  userEmail?: string | null;
  displayName?: string | null;
  workers: ContractorWorkerCandidate[];
}): string {
  const identity = contractorIdentityFromWorkers(
    input.userId,
    input.workers,
    input.userEmail,
    input.displayName
  );
  if ((identity.workerIds || []).length) return 'linked';

  const email = String(input.userEmail || '')
    .trim()
    .toLowerCase();
  const hasAuthMatch = input.workers.some((w) => w.auth_user_id === input.userId);
  const hasEmailMatch = email
    ? input.workers.some((w) => String(w.email || '').trim().toLowerCase() === email)
    : false;
  const name = normalizePersonName(input.displayName);
  const nameMatches = name
    ? input.workers.filter((w) => normalizePersonName(w.name) === name)
    : [];

  if (!input.workers.length) {
    return 'no_visible_workers';
  }
  if (!hasAuthMatch && !hasEmailMatch && nameMatches.length === 0) {
    return 'auth_user_id_null_and_email_name_mismatch';
  }
  if (nameMatches.length > 1) {
    return 'ambiguous_name_match';
  }
  return 'unresolved';
}

export function filterLaborForWorkers(
  laborRows: ContractorLaborRow[],
  workerIds: string[]
): ContractorLaborRow[] {
  const allowed = new Set(workerIds);
  return laborRows.filter((row) => {
    const workerId = String(row.worker_id || '').trim();
    return Boolean(workerId && allowed.has(workerId));
  });
}

export function computeContractorDashboardMetrics(
  jobs: ContractorJobRow[],
  laborRows: ContractorLaborRow[],
  identity: WorkerIdentity,
  today = localToday(),
  assignmentWorkerIdsByJob?: Map<string, string[]>
): ContractorDashboardMetrics {
  const mine = jobs.filter((job) => isJobAssignedToWorker(job, identity, assignmentWorkerIdsByJob));
  let assignedJobs = 0;
  let upcomingJobs = 0;
  let completedJobs = 0;

  for (const job of mine) {
    const status = normalizeJobStatus(job.status);
    if (status === 'cancelled') continue;
    if (status === 'completed') {
      completedJobs += 1;
      continue;
    }
    assignedJobs += 1;
    const schedule = getEffectiveJobSchedule(job);
    if (schedule && schedule >= today) upcomingJobs += 1;
  }

  const scopedLabor = filterLaborForWorkers(laborRows, identity.workerIds || []);
  let totalEarnings = 0;
  let paidEarnings = 0;
  let owedEarnings = 0;
  for (const row of scopedLabor) {
    const amount = num(row.total_cost);
    totalEarnings += amount;
    const status = normalizeLaborPaymentStatus(row.payment_status);
    if (status === 'paid') paidEarnings += amount;
    else owedEarnings += amount;
  }

  return {
    assignedJobs,
    upcomingJobs,
    completedJobs,
    totalEarnings: Number(totalEarnings.toFixed(2)),
    paidEarnings: Number(paidEarnings.toFixed(2)),
    owedEarnings: Number(owedEarnings.toFixed(2))
  };
}

export function buildContractorPaymentHistory(
  laborRows: ContractorLaborRow[],
  jobsById: Map<string, ContractorJobRow>,
  workerIds: string[]
): ContractorPaymentHistoryRow[] {
  const scoped = filterLaborForWorkers(laborRows, workerIds);
  return scoped
    .map((row) => {
      const jobId = row.job_id ? String(row.job_id) : null;
      const job = jobId ? jobsById.get(jobId) : undefined;
      const amountEarned = num(row.total_cost);
      const paymentStatus = normalizeLaborPaymentStatus(row.payment_status);
      const amountPaid = paymentStatus === 'paid' ? amountEarned : 0;
      const outstandingAmount = paymentStatus === 'paid' ? 0 : amountEarned;
      const workDate =
        getEffectiveJobSchedule(job || {}) ||
        String(job?.completed_at || row.created_at || '').slice(0, 10) ||
        null;

      return {
        laborId: String(row.id || `${row.job_id || 'job'}-${row.worker_id || 'worker'}`),
        jobId,
        jobTitle: job?.title?.trim() || 'Job',
        customerName: job?.customer_name?.trim() || 'Customer',
        workDate,
        amountEarned: Number(amountEarned.toFixed(2)),
        amountPaid: Number(amountPaid.toFixed(2)),
        outstandingAmount: Number(outstandingAmount.toFixed(2)),
        paymentStatus,
        paidDate: row.paid_at ? String(row.paid_at).slice(0, 10) : null,
        workerId: row.worker_id ? String(row.worker_id) : null
      };
    })
    .sort((a, b) => String(b.workDate || '').localeCompare(String(a.workDate || '')));
}

export function buildContractorJobCards(
  jobs: ContractorJobRow[],
  laborRows: ContractorLaborRow[],
  identity: WorkerIdentity,
  assignmentWorkerIdsByJob?: Map<string, string[]>
): ContractorJobCardModel[] {
  const scopedLabor = filterLaborForWorkers(laborRows, identity.workerIds || []);
  const laborByJob = new Map<string, ContractorLaborRow[]>();
  for (const row of scopedLabor) {
    const jobId = String(row.job_id || '');
    if (!jobId) continue;
    const list = laborByJob.get(jobId) || [];
    list.push(row);
    laborByJob.set(jobId, list);
  }

  return jobs
    .filter((job) => isJobAssignedToWorker(job, identity, assignmentWorkerIdsByJob))
    .map((job) => {
      const rows = laborByJob.get(job.id) || [];
      const recordedPay = Number(rows.reduce((sum, row) => sum + num(row.total_cost), 0).toFixed(2));
      const plannedPay = Number(num(job.expected_contractor_cost).toFixed(2));
      const payAmount = rows.length ? recordedPay : plannedPay;
      const payIsPlanned = rows.length === 0 && plannedPay > 0;
      let paymentStatus: ContractorJobCardModel['paymentStatus'] = 'none';
      if (rows.length) {
        const statuses = rows.map((row) => normalizeLaborPaymentStatus(row.payment_status));
        if (statuses.every((status) => status === 'paid')) paymentStatus = 'paid';
        else if (statuses.some((status) => status === 'pending')) paymentStatus = 'pending';
        else paymentStatus = 'unpaid';
      }

      return {
        id: job.id,
        title: job.title?.trim() || 'Untitled job',
        customerName: job.customer_name?.trim() || 'Not set',
        date: getEffectiveJobSchedule(job),
        address: job.address?.trim() || 'Not set',
        status: job.status || 'new',
        payAmount,
        payIsPlanned,
        paymentStatus,
        userId: job.user_id || null
      };
    })
    .sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
}

export function formatContractorMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);
}
