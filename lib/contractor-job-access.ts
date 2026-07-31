/** Shared contractor job authorization for list, detail, APIs, and notifications. */

export type ContractorAccessJob = {
  id: string;
  status?: string | null;
  assigned_to?: string | null;
};

export type ContractorAccessShare = {
  record_id?: string | null;
  shared_with_user_id?: string | null;
  access_level?: string | null;
};

export type ContractorAccessVisit = {
  job_id?: string | null;
  assigned_to?: string | null;
  worker_id?: string | null;
};

export type ContractorAccessAssignment = {
  job_id?: string | null;
  worker_id?: string | null;
};

export function normalizeContractorJobStatus(status: string | null | undefined): string {
  return String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function isContractorJobCompleted(status: string | null | undefined): boolean {
  const value = normalizeContractorJobStatus(status);
  return value === 'completed' || value === 'complete' || value === 'done';
}

export function isContractorJobCancelled(status: string | null | undefined): boolean {
  const value = normalizeContractorJobStatus(status);
  return value === 'cancelled' || value === 'canceled';
}

export function contractorCanAccessJob(input: {
  job: ContractorAccessJob;
  workerIds: string[];
  userId?: string;
  shares?: ContractorAccessShare[];
  visits?: ContractorAccessVisit[];
  assignments?: ContractorAccessAssignment[];
}): boolean {
  const workerIdSet = new Set(input.workerIds.map((id) => String(id || '').trim()).filter(Boolean));
  const assignedDirectly = Boolean(input.job.assigned_to && workerIdSet.has(String(input.job.assigned_to)));
  if (assignedDirectly) return true;

  for (const assignment of input.assignments || []) {
    if (String(assignment.job_id || '') !== input.job.id) continue;
    if (assignment.worker_id && workerIdSet.has(String(assignment.worker_id))) return true;
  }

  for (const visit of input.visits || []) {
    if (String(visit.job_id || '') !== input.job.id) continue;
    if (visit.assigned_to && workerIdSet.has(String(visit.assigned_to))) return true;
    if (visit.worker_id && workerIdSet.has(String(visit.worker_id))) return true;
  }

  return false;
}

export function contractorJobMode(status: string | null | undefined): 'active' | 'completed' | 'cancelled' {
  if (isContractorJobCancelled(status)) return 'cancelled';
  if (isContractorJobCompleted(status)) return 'completed';
  return 'active';
}

export function contractorJobDetailPath(jobId: string): string {
  return `/portal/contractor/jobs/${jobId}`;
}

/** Hide legacy technical sharing notifications from contractors. */
export function isLegacyContractorShareNotification(input: {
  title?: string | null;
  body?: string | null;
  type?: string | null;
}): boolean {
  const title = String(input.title || '').toLowerCase();
  const body = String(input.body || '').toLowerCase();
  if (title.includes('job shared with you')) return true;
  if (body.includes('edit access') || body.includes('view access')) return true;
  if (body.includes('access to a job record')) return true;
  return false;
}

export type ContractorSafeJobView = {
  id: string;
  title: string;
  status: string;
  mode: 'active' | 'completed' | 'cancelled';
  readOnly: boolean;
  scheduledDate: string | null;
  address: string | null;
  instructions: string | null;
  workNotes: string;
  customerName: string | null;
  phone: string | null;
  payAmount: number | null;
  paymentStatus: string | null;
};

export function toContractorSafeJobView(input: {
  id: string;
  title?: string | null;
  status?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  scheduled_start?: string | null;
  address?: string | null;
  notes?: string | null;
  customer_notes?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  payAmount?: number | null;
  paymentStatus?: string | null;
}): ContractorSafeJobView {
  const mode = contractorJobMode(input.status);
  return {
    id: input.id,
    title: String(input.title || 'Job'),
    status: String(input.status || 'new'),
    mode,
    readOnly: true,
    scheduledDate:
      String(input.scheduled_start || '').slice(0, 10) ||
      String(input.start_date || '').slice(0, 10) ||
      String(input.due_date || '').slice(0, 10) ||
      null,
    address: input.address || null,
    instructions: input.customer_notes || input.notes || null,
    workNotes: input.notes || '',
    customerName: input.customer_name || null,
    phone: input.phone || null,
    payAmount: input.payAmount ?? null,
    paymentStatus: input.paymentStatus || null
  };
}
