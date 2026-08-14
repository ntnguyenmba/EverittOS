/**
 * Portal export loaders.
 * Client: only jobs in job_client_access — never contractor pay / profit / internal notes.
 * Contractor: only assigned jobs — own pay from job_labor only; never company revenue/profit.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { appUrl } from '@/lib/app-url';
import { EXPORT_MAX_ROWS } from '@/lib/exports/job-export-data';
import {
  displayPersonName,
  formatExportDate,
  formatExportMoney,
  formatExportTime
} from '@/lib/exports/format';
import { getJobOperationalDate } from '@/lib/job-operational-date';
import { getEffectiveJobSchedule, isJobAssignedToWorker, normalizeJobStatus } from '@/lib/worker-assignment';

export type PortalExportRow = Record<string, string | number>;

export type PortalExportResult = {
  rows: PortalExportRow[];
  summary: { jobCount: number };
  appliedFilters: string[];
  companyName: string;
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function selectInChunks<T>(
  load: (ids: string[]) => Promise<T[]>,
  ids: string[],
  chunkSize = 200
): Promise<T[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: T[] = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    out.push(...(await load(unique.slice(i, i + chunkSize))));
  }
  return out;
}

function clientPortalRangeBounds(range: string): { start: string; end: string } | null {
  if (range !== 'today' && range !== 'week' && range !== 'month' && range !== 'year') return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  if (range === 'today') end.setDate(end.getDate() + 1);
  if (range === 'week') end.setDate(end.getDate() + 7);
  if (range === 'month') end.setMonth(end.getMonth() + 1);
  if (range === 'year') end.setFullYear(end.getFullYear() + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function loadClientPortalJobsExport(input: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  userId: string;
  range?: string | null;
}): Promise<{ ok: true; data: PortalExportResult } | { ok: false; error: string; status: number }> {
  const { data: accessRows, error: accessError } = await input.admin
    .from('job_client_access')
    .select('job_id')
    .eq('client_user_id', input.userId);

  if (accessError) {
    return { ok: false, error: 'Unable to load shared jobs.', status: 500 };
  }

  const jobIds = Array.from(
    new Set((accessRows || []).map((row) => String(row.job_id || '')).filter(Boolean))
  ).slice(0, EXPORT_MAX_ROWS);

  if (!jobIds.length) {
    return {
      ok: true,
      data: {
        rows: [],
        summary: { jobCount: 0 },
        appliedFilters: ['Shared jobs'],
        companyName: 'EverittOS'
      }
    };
  }

  const jobs = await selectInChunks(async (ids) => {
    const { data } = await input.admin
      .from('jobs')
      .select(
        'id, title, address, status, completed_at, start_date, due_date, scheduled_start, scheduled_end, timezone, customer_notes, organization_id'
      )
      .in('id', ids);
    return (data || []) as Array<{
      id: string;
      title: string | null;
      address: string | null;
      status: string | null;
      completed_at: string | null;
      start_date: string | null;
      due_date: string | null;
      scheduled_start: string | null;
      scheduled_end: string | null;
      timezone: string | null;
      customer_notes: string | null;
      organization_id: string | null;
    }>;
  }, jobIds);

  const orgIds = Array.from(new Set(jobs.map((j) => j.organization_id).filter((id): id is string => Boolean(id))));
  const { data: orgs } = orgIds.length
    ? await input.admin.from('organizations').select('id, name').in('id', orgIds)
    : { data: [] as Array<{ id: string; name: string | null }> };
  const orgNameById = new Map((orgs || []).map((o) => [o.id, String(o.name || '')]));

  const reports = await selectInChunks(async (ids) => {
    const { data } = await input.admin
      .from('job_reports')
      .select('job_id, share_token, share_revoked_at, title')
      .in('job_id', ids);
    return (data || []) as Array<{
      job_id: string;
      share_token: string | null;
      share_revoked_at: string | null;
      title: string | null;
    }>;
  }, jobIds);

  const reportByJob = new Map<string, string>();
  for (const report of reports) {
    if (reportByJob.has(report.job_id)) continue;
    if (report.share_token && !report.share_revoked_at) {
      reportByJob.set(report.job_id, appUrl(`/report/${report.share_token}`));
    } else if (report.share_revoked_at) {
      reportByJob.set(report.job_id, 'Revoked');
    } else {
      reportByJob.set(report.job_id, 'Not shared');
    }
  }

  const invoices = await selectInChunks(async (ids) => {
    const { data } = await input.admin
      .from('invoices')
      .select('job_id, invoice_number, status, payment_status, amount, amount_paid, created_at')
      .in('job_id', ids)
      .order('created_at', { ascending: false });
    return (data || []) as Array<{
      job_id: string | null;
      invoice_number: string | null;
      status: string | null;
      payment_status: string | null;
      amount: number | null;
      amount_paid: number | null;
      created_at: string | null;
    }>;
  }, jobIds);

  const invoiceByJob = new Map<
    string,
    {
      invoice_number: string | null;
      status: string | null;
      payment_status: string | null;
      amount: number | null;
      amount_paid: number | null;
    }
  >();
  for (const invoice of invoices) {
    if (!invoice.job_id || invoiceByJob.has(invoice.job_id)) continue;
    invoiceByJob.set(invoice.job_id, invoice);
  }

  const bounds = clientPortalRangeBounds(String(input.range || '').toLowerCase());
  const scopedJobs = bounds
    ? jobs.filter((job) => {
        const date = getJobOperationalDate(job);
        return Boolean(date && date >= bounds.start && date < bounds.end);
      })
    : jobs;

  const companyName = orgNameById.get(scopedJobs[0]?.organization_id || jobs[0]?.organization_id || '') || 'EverittOS';

  const rows: PortalExportRow[] = scopedJobs.map((job) => {
    const tz = job.timezone;
    const invoice = invoiceByJob.get(job.id);
    const total = num(invoice?.amount);
    const paid = num(invoice?.amount_paid);
    const balance = Math.max(0, Number((total - paid).toFixed(2)));

    return {
      jobTitle: String(job.title || ''),
      serviceAddress: String(job.address || ''),
      scheduledDate:
        formatExportDate(getEffectiveJobSchedule(job), tz) ||
        formatExportDate(job.start_date || job.due_date, tz),
      startTime: formatExportTime(job.scheduled_start, tz),
      endTime: formatExportTime(job.scheduled_end, tz),
      jobStatus: String(job.status || ''),
      assignedCompany: orgNameById.get(job.organization_id || '') || companyName,
      completionDate: formatExportDate(job.completed_at, tz),
      sharedNotes: String(job.customer_notes || ''),
      sharedReport: reportByJob.get(job.id) || 'No report',
      invoiceNumber: String(invoice?.invoice_number || ''),
      invoiceStatus: String(invoice?.payment_status || invoice?.status || ''),
      invoiceTotal: invoice ? formatExportMoney(total) : '',
      amountPaid: invoice ? formatExportMoney(paid) : '',
      balanceDue: invoice ? formatExportMoney(balance) : ''
    };
  });

  return {
    ok: true,
    data: {
      rows,
      summary: { jobCount: rows.length },
      appliedFilters: bounds ? ['Shared jobs', `range=${String(input.range || '')}`] : ['Shared jobs'],
      companyName
    }
  };
}

export async function loadContractorPortalJobsExport(input: {
  supabase: SupabaseClient;
  userId: string;
  email?: string | null;
}): Promise<{ ok: true; data: PortalExportResult } | { ok: false; error: string; status: number }> {
  const { data: membership } = await input.supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', input.userId)
    .eq('active', true)
    .maybeSingle();

  const organizationId = (membership?.organization_id as string | null) || null;

  let workersQuery = input.supabase
    .from('workers')
    .select('id, auth_user_id, email, name, organization_id')
    .eq('auth_user_id', input.userId);
  if (organizationId) workersQuery = workersQuery.eq('organization_id', organizationId);

  const { data: workerRows } = await workersQuery;
  let workers = workerRows || [];

  if (!workers.length && input.email) {
    let emailQuery = input.supabase
      .from('workers')
      .select('id, auth_user_id, email, name, organization_id')
      .ilike('email', input.email);
    if (organizationId) emailQuery = emailQuery.eq('organization_id', organizationId);
    const { data: byEmail } = await emailQuery;
    workers = byEmail || [];
  }

  const workerIds = workers.map((w) => String(w.id)).filter(Boolean);
  const orgId = organizationId || (workers[0]?.organization_id as string | null) || null;

  if (!workerIds.length) {
    return {
      ok: true,
      data: {
        rows: [],
        summary: { jobCount: 0 },
        appliedFilters: ['Assigned jobs'],
        companyName: 'EverittOS'
      }
    };
  }

  const identity = { userId: input.userId, workerIds };

  const [assignmentRes, directJobsRes, laborRes] = await Promise.all([
    input.supabase.from('job_assignments').select('job_id, worker_id').in('worker_id', workerIds),
    orgId
      ? input.supabase
          .from('jobs')
          .select(
            'id, title, customer_name, address, status, completed_at, start_date, due_date, scheduled_start, scheduled_end, timezone, notes, assigned_to, organization_id'
          )
          .eq('organization_id', orgId)
          .or(`assigned_to.in.(${workerIds.join(',')}),assigned_to.eq.${input.userId}`)
      : input.supabase
          .from('jobs')
          .select(
            'id, title, customer_name, address, status, completed_at, start_date, due_date, scheduled_start, scheduled_end, timezone, notes, assigned_to, organization_id'
          )
          .or(`assigned_to.in.(${workerIds.join(',')}),assigned_to.eq.${input.userId}`),
    input.supabase
      .from('job_labor')
      .select('job_id, worker_id, total_cost, payment_status')
      .in('worker_id', workerIds)
  ]);

  const assignmentJobIds = Array.from(
    new Set((assignmentRes.data || []).map((r) => String(r.job_id || '')).filter(Boolean))
  );

  let assignmentJobs: Array<Record<string, unknown>> = [];
  if (assignmentJobIds.length) {
    const { data } = await input.supabase
      .from('jobs')
      .select(
        'id, title, customer_name, address, status, completed_at, start_date, due_date, scheduled_start, scheduled_end, timezone, notes, assigned_to, organization_id'
      )
      .in('id', assignmentJobIds);
    assignmentJobs = (data || []) as Array<Record<string, unknown>>;
  }

  const assignmentWorkerIdsByJob = new Map<string, string[]>();
  for (const row of assignmentRes.data || []) {
    const jobId = String(row.job_id || '');
    const workerId = String(row.worker_id || '');
    if (!jobId || !workerId) continue;
    const list = assignmentWorkerIdsByJob.get(jobId) || [];
    if (!list.includes(workerId)) list.push(workerId);
    assignmentWorkerIdsByJob.set(jobId, list);
  }

  const merged = new Map<string, Record<string, unknown>>();
  for (const job of [...assignmentJobs, ...((directJobsRes.data || []) as Array<Record<string, unknown>>)]) {
    const id = String(job.id || '');
    if (!id) continue;
    if (
      isJobAssignedToWorker(
        { id, assigned_to: job.assigned_to as string | null },
        identity,
        assignmentWorkerIdsByJob
      )
    ) {
      merged.set(id, job);
    }
  }

  const laborByJob = new Map<string, { amount: number; status: string }>();
  for (const row of laborRes.data || []) {
    const jobId = String(row.job_id || '');
    if (!jobId) continue;
    const current = laborByJob.get(jobId) || { amount: 0, status: '' };
    current.amount = Number((current.amount + num(row.total_cost)).toFixed(2));
    const status = String(row.payment_status || '').trim();
    if (status) current.status = status;
    laborByJob.set(jobId, current);
  }

  // Include jobs that only appear via own labor rows (still assigned earnings history).
  const missingLaborJobIds = Array.from(laborByJob.keys()).filter((id) => !merged.has(id));
  if (missingLaborJobIds.length) {
    const laborJobs = await selectInChunks(async (ids) => {
      const { data } = await input.supabase
        .from('jobs')
        .select(
          'id, title, customer_name, address, status, completed_at, start_date, due_date, scheduled_start, scheduled_end, timezone, notes, assigned_to, organization_id'
        )
        .in('id', ids);
      return (data || []) as Array<Record<string, unknown>>;
    }, missingLaborJobIds);
    for (const job of laborJobs) {
      merged.set(String(job.id), job);
    }
  }

  const jobs = Array.from(merged.values()).slice(0, EXPORT_MAX_ROWS);
  const photoRows = await selectInChunks(async (ids) => {
    const { data } = await input.supabase.from('job_photos').select('job_id').in('job_id', ids);
    return (data || []) as Array<{ job_id: string }>;
  }, jobs.map((j) => String(j.id)));
  const photoCounts = new Map<string, number>();
  for (const row of photoRows) {
    photoCounts.set(row.job_id, (photoCounts.get(row.job_id) || 0) + 1);
  }

  let companyName = 'EverittOS';
  if (orgId) {
    const { data: org } = await input.supabase.from('organizations').select('name').eq('id', orgId).maybeSingle();
    if (org?.name) companyName = String(org.name);
  }

  const rows: PortalExportRow[] = jobs.map((job) => {
    const tz = job.timezone as string | null;
    const scheduleJob = {
      scheduled_start: job.scheduled_start as string | null,
      start_date: job.start_date as string | null,
      due_date: job.due_date as string | null
    };
    const pay = laborByJob.get(String(job.id));
    const completed =
      normalizeJobStatus(job.status as string | null) === 'completed'
        ? formatExportDate(job.completed_at as string | null, tz)
        : formatExportDate(job.completed_at as string | null, tz);

    return {
      jobTitle: String(job.title || ''),
      customerDisplayName: displayPersonName(job.customer_name as string | null, null),
      serviceAddress: String(job.address || ''),
      scheduledDate:
        formatExportDate(getEffectiveJobSchedule(scheduleJob), tz) ||
        formatExportDate((job.start_date as string | null) || (job.due_date as string | null), tz),
      startTime: formatExportTime(job.scheduled_start as string | null, tz),
      endTime: formatExportTime(job.scheduled_end as string | null, tz),
      jobStatus: String(job.status || ''),
      completionDate: completed,
      assignedNotes: String(job.notes || ''),
      photoCount: photoCounts.get(String(job.id)) || 0,
      payStatus: pay?.status || '',
      payAmount: pay ? formatExportMoney(pay.amount) : ''
    };
  });

  return {
    ok: true,
    data: {
      rows,
      summary: { jobCount: rows.length },
      appliedFilters: ['Assigned jobs'],
      companyName
    }
  };
}
