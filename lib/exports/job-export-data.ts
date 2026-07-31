/**
 * Server-side owner/manager jobs export loader.
 * Never trusts client-supplied role or organization ids.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseAddressParts } from '@/lib/exports/address';
import {
  applyJobsExportPostFilters,
  describeAppliedFilters,
  listWorkspaceStatusParam,
  parseJobsExportFilters,
  type JobsExportFilters
} from '@/lib/exports/job-filters';
import {
  displayPersonName,
  formatExportDate,
  formatExportDateTime,
  formatExportMoney,
  formatExportTime
} from '@/lib/exports/format';
import { canAccessFinancials } from '@/lib/finance-access';
import { effectiveContractorCost } from '@/lib/finance/contractor-cost';
import { fetchJobBillingStatuses } from '@/lib/jobs/billing-status';
import { listWorkspaceJobs } from '@/lib/jobs-org-query';
import { resolveOrganizationPlan } from '@/lib/organization-plan';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { getEffectiveJobSchedule } from '@/lib/worker-assignment';
import type { CurrentWorkspace } from '@/lib/workspace-server';

export const EXPORT_MAX_ROWS = 5000;

const JOB_EXPORT_SELECT =
  'id, title, customer_name, customer_email, phone, customer_id, address, status, completed_at, assigned_to, assigned_email, created_at, start_date, due_date, scheduled_start, scheduled_end, timezone, revenue_amount, expected_contractor_cost, expected_additional_expense, notes, customer_notes, organization_id';

type JobDetailRow = {
  id: string;
  title: string | null;
  customer_name: string | null;
  customer_email: string | null;
  phone: string | null;
  customer_id: string | null;
  address: string | null;
  status: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  assigned_email: string | null;
  created_at: string | null;
  start_date: string | null;
  due_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  timezone: string | null;
  revenue_amount: number | null;
  expected_contractor_cost: number | null;
  expected_additional_expense: number | null;
  notes: string | null;
  customer_notes: string | null;
  organization_id: string | null;
};

export type OwnerJobExportRow = Record<string, string | number>;

export type JobExportResult = {
  rows: OwnerJobExportRow[];
  summary: {
    jobCount: number;
    expectedRevenueTotal: string;
    actualCollectedTotal: string;
    expectedProfitTotal: string;
    actualProfitTotal: string;
  };
  appliedFilters: string[];
  includeFinance: boolean;
  companyName: string;
  truncated: boolean;
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
    const chunk = unique.slice(i, i + chunkSize);
    out.push(...(await load(chunk)));
  }
  return out;
}

export async function loadOwnerJobsExportData(input: {
  supabase: SupabaseClient;
  userId: string;
  workspace: CurrentWorkspace;
  searchParams: URLSearchParams | { get(name: string): string | null };
}): Promise<{ ok: true; data: JobExportResult } | { ok: false; error: string; status: number }> {
  const role = normalizeRole(input.workspace.role);
  if (!isManagerRole(role)) {
    return { ok: false, error: 'You do not have permission to export jobs.', status: 403 };
  }

  const organizationId = input.workspace.organizationId;
  if (!organizationId) {
    return { ok: false, error: 'Workspace not found.', status: 404 };
  }

  const filters: JobsExportFilters = parseJobsExportFilters(input.searchParams);
  const { plan } = await resolveOrganizationPlan(input.supabase, input.userId);
  const includeFinance = canAccessFinancials(role, plan);

  const completedSince =
    filters.period === 'week' && filters.status === 'completed'
      ? new Date(Date.now() - 7 * 86400000).toISOString()
      : undefined;

  const { jobs, error } = await listWorkspaceJobs(
    input.supabase,
    input.userId,
    organizationId,
    role,
    {
      customerId: filters.customerId,
      status: listWorkspaceStatusParam(filters.status),
      completedSince,
      unassignedOnly: filters.unassignedOnly,
      assignedTo: filters.assignedTo,
      createdFrom: filters.createdFrom
    }
  );

  if (error) {
    return { ok: false, error: 'Unable to load jobs for export.', status: 500 };
  }

  const filtered = applyJobsExportPostFilters(jobs, filters);
  const truncated = filtered.length > EXPORT_MAX_ROWS;
  const scoped = filtered.slice(0, EXPORT_MAX_ROWS);
  const jobIds = scoped.map((j) => j.id);

  if (!jobIds.length) {
    return {
      ok: true,
      data: {
        rows: [],
        summary: {
          jobCount: 0,
          expectedRevenueTotal: '',
          actualCollectedTotal: '',
          expectedProfitTotal: '',
          actualProfitTotal: ''
        },
        appliedFilters: describeAppliedFilters(filters),
        includeFinance,
        companyName: input.workspace.organizationName || 'EverittOS',
        truncated: false
      }
    };
  }

  const details = await selectInChunks(async (ids) => {
    const { data } = await input.supabase
      .from('jobs')
      .select(JOB_EXPORT_SELECT)
      .eq('organization_id', organizationId)
      .in('id', ids);
    return (data || []) as JobDetailRow[];
  }, jobIds);

  const detailById = new Map(details.map((row) => [row.id, row]));

  const customerIds = Array.from(
    new Set(details.map((j) => j.customer_id).filter((id): id is string => Boolean(id)))
  );
  const customers = await selectInChunks(async (ids) => {
    const { data } = await input.supabase
      .from('customers')
      .select('id, company_name, email, phone')
      .eq('organization_id', organizationId)
      .in('id', ids);
    return (data || []) as Array<{
      id: string;
      company_name: string | null;
      email: string | null;
      phone: string | null;
    }>;
  }, customerIds);
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const { data: workers } = await input.supabase
    .from('workers')
    .select('id, name, auth_user_id, email')
    .eq('organization_id', organizationId);
  const workerNameById = new Map<string, string>();
  for (const worker of workers || []) {
    const name = displayPersonName(worker.name, worker.email);
    if (worker.id) workerNameById.set(worker.id as string, name);
    if (worker.auth_user_id) workerNameById.set(worker.auth_user_id as string, name);
  }

  const photoRows = await selectInChunks(async (ids) => {
    const { data } = await input.supabase.from('job_photos').select('job_id').in('job_id', ids);
    return (data || []) as Array<{ job_id: string }>;
  }, jobIds);
  const photoCounts = new Map<string, number>();
  for (const row of photoRows) {
    photoCounts.set(row.job_id, (photoCounts.get(row.job_id) || 0) + 1);
  }

  let billingByJob: Record<string, string> = {};
  const laborByJob = new Map<string, number>();
  const expensesByJob = new Map<string, number>();
  const collectedByJob = new Map<string, number>();

  if (includeFinance) {
    billingByJob = await fetchJobBillingStatuses(input.supabase, organizationId, jobIds);

    const laborRows = await selectInChunks(async (ids) => {
      const { data } = await input.supabase
        .from('job_labor')
        .select('job_id, total_cost')
        .eq('organization_id', organizationId)
        .in('job_id', ids);
      return (data || []) as Array<{ job_id: string; total_cost: number | null }>;
    }, jobIds);
    for (const row of laborRows) {
      laborByJob.set(row.job_id, Number(((laborByJob.get(row.job_id) || 0) + num(row.total_cost)).toFixed(2)));
    }

    const expenseRows = await selectInChunks(async (ids) => {
      const { data } = await input.supabase
        .from('expenses')
        .select('job_id, amount')
        .eq('organization_id', organizationId)
        .in('job_id', ids);
      return (data || []) as Array<{ job_id: string; amount: number | null }>;
    }, jobIds);
    for (const row of expenseRows) {
      expensesByJob.set(row.job_id, Number(((expensesByJob.get(row.job_id) || 0) + num(row.amount)).toFixed(2)));
    }

    const invoiceRows = await selectInChunks(async (ids) => {
      const { data } = await input.supabase
        .from('invoices')
        .select('job_id, amount_paid')
        .eq('organization_id', organizationId)
        .in('job_id', ids);
      return (data || []) as Array<{ job_id: string | null; amount_paid: number | null }>;
    }, jobIds);
    for (const row of invoiceRows) {
      if (!row.job_id) continue;
      collectedByJob.set(
        row.job_id,
        Number(((collectedByJob.get(row.job_id) || 0) + num(row.amount_paid)).toFixed(2))
      );
    }
  }

  let expectedRevenueTotal = 0;
  let actualCollectedTotal = 0;
  let expectedProfitTotal = 0;
  let actualProfitTotal = 0;

  const rows: OwnerJobExportRow[] = [];
  for (const listJob of scoped) {
    const job = detailById.get(listJob.id) || (listJob as unknown as JobDetailRow);
    const customer = job.customer_id ? customerById.get(job.customer_id) : undefined;
    const addressParts = parseAddressParts(job.address);
    const tz = job.timezone;
    const scheduledDate =
      formatExportDate(getEffectiveJobSchedule(job), tz) ||
      formatExportDate(job.start_date || job.due_date || job.scheduled_start, tz);

    const customerName =
      displayPersonName(customer?.company_name || job.customer_name, customer?.email || job.customer_email) ||
      '';
    const customerEmail = String(customer?.email || job.customer_email || '').trim();
    const customerPhone = String(customer?.phone || job.phone || '').trim();
    const assignedWorker =
      (job.assigned_to && workerNameById.get(job.assigned_to)) ||
      displayPersonName(null, job.assigned_email) ||
      '';

    const expectedRevenue = num(job.revenue_amount);
    const expectedContractor = num(job.expected_contractor_cost);
    const additionalExpected = num(job.expected_additional_expense);
    const recordedLabor = laborByJob.get(job.id) || 0;
    // Never add expected_contractor_cost and job_labor for the same job.
    const contractorCost = effectiveContractorCost(expectedContractor, recordedLabor);
    const actualLabor = recordedLabor;
    const actualExpenses = expensesByJob.get(job.id) || 0;
    const actualCollected = collectedByJob.get(job.id) || 0;
    const expectedProfit = Number((expectedRevenue - contractorCost - additionalExpected).toFixed(2));
    // Actual profit uses recorded labor/expenses only (not planned expected cost).
    const actualProfit = Number((actualCollected - actualLabor - actualExpenses).toFixed(2));

    if (includeFinance) {
      expectedRevenueTotal += expectedRevenue;
      actualCollectedTotal += actualCollected;
      expectedProfitTotal += expectedProfit;
      actualProfitTotal += actualProfit;
    }

    const base: OwnerJobExportRow = {
      jobId: job.id,
      jobTitle: String(job.title || ''),
      customerName,
      customerEmail,
      customerPhone,
      serviceAddress: addressParts.street || String(job.address || ''),
      city: addressParts.city,
      state: addressParts.state,
      postalCode: addressParts.postalCode,
      scheduledDate,
      startTime: formatExportTime(job.scheduled_start, tz),
      endTime: formatExportTime(job.scheduled_end, tz),
      timezone: String(job.timezone || ''),
      assignedWorker,
      jobStatus: String(job.status || ''),
      photoCount: photoCounts.get(job.id) || 0,
      createdDate: formatExportDateTime(job.created_at, tz),
      completedDate: formatExportDateTime(job.completed_at, tz)
    };

    if (includeFinance) {
      rows.push({
        ...base,
        billingStatus: billingByJob[job.id] || 'not_invoiced',
        expectedRevenue: formatExportMoney(expectedRevenue),
        expectedContractorCost: formatExportMoney(expectedContractor),
        additionalExpectedExpenses: formatExportMoney(additionalExpected),
        expectedProfit: formatExportMoney(expectedProfit),
        actualCollected: formatExportMoney(actualCollected),
        actualLaborCost: formatExportMoney(actualLabor),
        actualExpenses: formatExportMoney(actualExpenses),
        actualProfit: formatExportMoney(actualProfit)
      });
    } else {
      rows.push(base);
    }
  }

  return {
    ok: true,
    data: {
      rows,
      summary: {
        jobCount: rows.length,
        expectedRevenueTotal: includeFinance ? formatExportMoney(expectedRevenueTotal) : '',
        actualCollectedTotal: includeFinance ? formatExportMoney(actualCollectedTotal) : '',
        expectedProfitTotal: includeFinance ? formatExportMoney(expectedProfitTotal) : '',
        actualProfitTotal: includeFinance ? formatExportMoney(actualProfitTotal) : ''
      },
      appliedFilters: describeAppliedFilters(filters),
      includeFinance,
      companyName: input.workspace.organizationName || 'EverittOS',
      truncated
    }
  };
}
