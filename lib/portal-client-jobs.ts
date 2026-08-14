import type { SupabaseClient } from '@supabase/supabase-js';
import { repairClientPortalAccessForUser } from '@/lib/client-portal-repair';
import {
  CLIENT_SAFE_JOB_COLUMNS,
  clientJobCharges,
  toClientFacingCharges
} from '@/lib/portal-role-financials';

export type ClientPortalJobRow = {
  id: string;
  title: string;
  status: string | null;
  customerName: string | null;
  address: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string | null;
  jobTotal: number | null;
  paid: number;
  balanceDue: number | null;
};

export type ClientPortalInvoiceRow = {
  id: string;
  job_id: string | null;
  amount: number | null;
  amount_paid: number | null;
  status: string | null;
  due_date: string | null;
};

type JobRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  customer_name?: string | null;
  customer_notes?: string | null;
  address?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  timezone?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  revenue_amount?: number | string | null;
};

type InvoiceRow = {
  id: string;
  job_id?: string | null;
  amount?: number | string | null;
  amount_paid?: number | string | null;
  status?: string | null;
  due_date?: string | null;
  created_at?: string | null;
};

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

function toInvoiceRow(invoice: InvoiceRow): ClientPortalInvoiceRow {
  return {
    id: invoice.id,
    job_id: invoice.job_id || null,
    amount: invoice.amount == null ? null : Number(invoice.amount),
    amount_paid: invoice.amount_paid == null ? null : Number(invoice.amount_paid),
    status: invoice.status || null,
    due_date: invoice.due_date || null
  };
}

function toListJob(job: JobRow, invoices: InvoiceRow[]): ClientPortalJobRow {
  const charges = clientJobCharges({
    invoices,
    revenueAmount: job.revenue_amount
  });
  const facing = toClientFacingCharges(charges);
  return {
    id: job.id,
    title: String(job.title || ''),
    status: job.status || null,
    customerName: job.customer_name || null,
    address: job.address || null,
    scheduledStart: job.scheduled_start || null,
    scheduledEnd: job.scheduled_end || null,
    startDate: job.start_date || null,
    dueDate: job.due_date || null,
    completedAt: job.completed_at || null,
    createdAt: job.created_at || null,
    jobTotal: facing.jobTotal,
    paid: facing.paid,
    balanceDue: facing.balanceDue
  };
}

export async function loadClientPortalJobs(input: {
  admin: SupabaseClient;
  userId: string;
  email?: string | null;
}): Promise<
  | { ok: true; jobs: ClientPortalJobRow[] }
  | { ok: false; error: string; status: number }
> {
  await repairClientPortalAccessForUser(input.admin, input.userId, input.email);

  const { data: access, error: accessError } = await input.admin
    .from('job_client_access')
    .select('job_id')
    .eq('client_user_id', input.userId);

  if (accessError) {
    return { ok: false, error: accessError.message, status: 500 };
  }

  const jobIds = Array.from(
    new Set((access || []).map((row) => String(row.job_id || '')).filter(Boolean))
  );
  if (!jobIds.length) {
    return { ok: true, jobs: [] };
  }

  let jobs: JobRow[] = [];
  let invoices: InvoiceRow[] = [];
  try {
    jobs = await selectInChunks(async (ids) => {
      const { data, error } = await input.admin.from('jobs').select(CLIENT_SAFE_JOB_COLUMNS).in('id', ids);
      if (error) throw new Error(error.message);
      return (data || []) as JobRow[];
    }, jobIds);

    invoices = await selectInChunks(async (ids) => {
      const { data, error } = await input.admin
        .from('invoices')
        .select('id, job_id, amount, amount_paid, status, due_date, created_at')
        .in('job_id', ids)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as InvoiceRow[];
    }, jobIds);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to load shared jobs.',
      status: 500
    };
  }

  const invoicesByJob = new Map<string, InvoiceRow[]>();
  for (const invoice of invoices) {
    const jobId = String(invoice.job_id || '');
    if (!jobId) continue;
    const list = invoicesByJob.get(jobId) || [];
    list.push(invoice);
    invoicesByJob.set(jobId, list);
  }

  const allowed = new Set(jobIds);
  return {
    ok: true,
    jobs: jobs.filter((job) => allowed.has(job.id)).map((job) => toListJob(job, invoicesByJob.get(job.id) || []))
  };
}

export async function loadClientPortalJob(input: {
  admin: SupabaseClient;
  userId: string;
  email?: string | null;
  jobId: string;
}): Promise<
  | {
      ok: true;
      job: {
        id: string;
        title: string;
        status: string | null;
        customer_name: string | null;
        customer_notes: string | null;
        address: string | null;
        scheduled_start: string | null;
        scheduled_end: string | null;
        start_date: string | null;
        due_date: string | null;
        timezone: string | null;
      };
      reports: Array<{
        id: string;
        title: string | null;
        job_id: string;
        share_token: string | null;
        share_revoked_at: string | null;
      }>;
      invoices: ClientPortalInvoiceRow[];
      charges: ReturnType<typeof toClientFacingCharges>;
      canViewPhotos: boolean;
    }
  | { ok: false; error: string; status: number }
> {
  await repairClientPortalAccessForUser(input.admin, input.userId, input.email);

  const { data: access, error: accessError } = await input.admin
    .from('job_client_access')
    .select('job_id, can_view_photos')
    .eq('client_user_id', input.userId)
    .eq('job_id', input.jobId)
    .maybeSingle();

  if (accessError) {
    return { ok: false, error: accessError.message, status: 500 };
  }
  if (!access) {
    return { ok: false, error: 'This job is not shared with your account.', status: 403 };
  }

  const [{ data: job, error: jobError }, { data: reports, error: reportError }, { data: invoices, error: invoiceError }] =
    await Promise.all([
      input.admin.from('jobs').select(CLIENT_SAFE_JOB_COLUMNS).eq('id', input.jobId).maybeSingle(),
      input.admin
        .from('job_reports')
        .select('id, title, job_id, share_token, share_revoked_at')
        .eq('job_id', input.jobId),
      input.admin
        .from('invoices')
        .select('id, job_id, amount, amount_paid, status, due_date, created_at')
        .eq('job_id', input.jobId)
        .order('created_at', { ascending: false })
    ]);

  if (jobError) {
    return { ok: false, error: jobError.message, status: 500 };
  }
  if (!job) {
    return { ok: false, error: 'This shared job could not be found.', status: 404 };
  }

  const invoiceRows = ((invoiceError ? [] : invoices) || []) as InvoiceRow[];
  const charges = toClientFacingCharges(
    clientJobCharges({
      invoices: invoiceRows,
      revenueAmount: (job as JobRow).revenue_amount
    })
  );

  const safeJob = job as JobRow;
  return {
    ok: true,
    job: {
      id: safeJob.id,
      title: String(safeJob.title || ''),
      status: safeJob.status || null,
      customer_name: safeJob.customer_name || null,
      customer_notes: safeJob.customer_notes || null,
      address: safeJob.address || null,
      scheduled_start: safeJob.scheduled_start || null,
      scheduled_end: safeJob.scheduled_end || null,
      start_date: safeJob.start_date || null,
      due_date: safeJob.due_date || null,
      timezone: safeJob.timezone || null
    },
    reports: reportError ? [] : reports || [],
    invoices: invoiceRows.map(toInvoiceRow),
    charges,
    canViewPhotos: access.can_view_photos !== false
  };
}
