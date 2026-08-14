/**
 * Server-side loaders for expenses, customers, invoices, payments, and contractor pay.
 * Identity always comes from the workspace session — never from client user/org ids.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CONTRACTOR_PAY_EXPORT_COLUMNS,
  CUSTOMERS_EXPORT_COLUMNS,
  EXPENSES_EXPORT_COLUMNS,
  INVOICES_EXPORT_COLUMNS,
  PAYMENTS_EXPORT_COLUMNS
} from '@/lib/exports/columns';
import { EXPORT_MAX_ROWS } from '@/lib/exports/job-export-data';
import { formatExportDate, formatExportMoney, displayPersonName } from '@/lib/exports/format';
import { preparedFromColumns, type PreparedExport } from '@/lib/exports/prepared';
import {
  CUSTOMER_LIST_SELECT,
  customerDisplayAddress,
  customerDisplayName,
  type CustomerRecord
} from '@/lib/customer-record';
import { monthStartIso } from '@/lib/date-filters';
import { filterDemoSeedCustomers } from '@/lib/demo-seed-filter';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/finance-types';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import type { ExportCopy } from '@/lib/i18n/export-copy';

export type InvoicePaymentFilter = 'all' | 'unpaid' | 'overdue' | 'paid' | 'history';

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

function companyNameFrom(name: string | null | undefined): string {
  return String(name || '').trim() || 'EverittOS';
}

async function mapById<T extends { id: string }>(
  supabase: SupabaseClient,
  table: string,
  ids: string[],
  select: string,
  organizationId: string
): Promise<Map<string, T>> {
  const unique = Array.from(new Set(ids.filter(Boolean))).slice(0, EXPORT_MAX_ROWS);
  const map = new Map<string, T>();
  if (!unique.length) return map;
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const { data } = await supabase
      .from(table)
      .select(select)
      .eq('organization_id', organizationId)
      .in('id', chunk);
    for (const row of ((data || []) as unknown as T[])) map.set(row.id, row);
  }
  return map;
}

export function matchesInvoicePaymentFilter(
  doc: {
    amount?: unknown;
    amount_paid?: unknown;
    payment_status?: unknown;
    status?: unknown;
    due_date?: unknown;
  },
  filter: InvoicePaymentFilter
): boolean {
  if (!filter || filter === 'all') return true;
  const status = String(doc.payment_status || doc.status || '').toLowerCase();
  const stillOwed = Math.max(0, num(doc.amount) - num(doc.amount_paid));
  if (filter === 'unpaid') return stillOwed > 0 && status !== 'cancelled' && status !== 'canceled';
  if (filter === 'overdue') {
    return (
      status === 'overdue' ||
      (stillOwed > 0 && Boolean(doc.due_date) && String(doc.due_date).slice(0, 10) < new Date().toISOString().slice(0, 10))
    );
  }
  if (filter === 'paid') return status === 'paid' || (stillOwed <= 0 && num(doc.amount_paid) > 0);
  if (filter === 'history') return num(doc.amount_paid) > 0;
  return true;
}

export function parseInvoicePaymentFilter(value: string | null | undefined): InvoicePaymentFilter {
  const raw = String(value || '').toLowerCase();
  if (raw === 'unpaid' || raw === 'overdue' || raw === 'paid' || raw === 'history') return raw;
  return 'all';
}

export async function loadExpensesExport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  companyName: string;
  searchParams: URLSearchParams;
  copy: ExportCopy;
}): Promise<{ ok: true; data: PreparedExport } | { ok: false; error: string; status: number }> {
  const from = String(input.searchParams.get('from') || '').trim();
  const to = String(input.searchParams.get('to') || '').trim();
  const category = String(input.searchParams.get('category') || '').trim();
  const jobId = String(input.searchParams.get('jobId') || '').trim();
  const customerId = String(input.searchParams.get('customerId') || '').trim();
  const workerId = String(input.searchParams.get('workerId') || '').trim();
  const search = String(input.searchParams.get('q') || '').trim();

  let query = input.supabase
    .from('expenses')
    .select(
      'id, date, category, vendor, description, amount, payment_method, notes, job_id, customer_id, worker_id'
    )
    .eq('organization_id', input.organizationId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(EXPORT_MAX_ROWS);

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (category && isCategory(category)) query = query.eq('category', category);
  if (jobId) query = query.eq('job_id', jobId);
  if (customerId) query = query.eq('customer_id', customerId);
  if (workerId) query = query.eq('worker_id', workerId);
  if (search) {
    const escaped = search.replace(/[%_,]/g, '');
    if (escaped) {
      query = query.or(`vendor.ilike.%${escaped}%,description.ilike.%${escaped}%,notes.ilike.%${escaped}%`);
    }
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: 'Unable to load expenses for export.', status: 500 };

  const rows = (data || []) as Array<{
    id: string;
    date: string | null;
    category: string | null;
    vendor: string | null;
    description: string | null;
    amount: number | null;
    payment_method: string | null;
    notes: string | null;
    job_id: string | null;
    customer_id: string | null;
    worker_id: string | null;
  }>;

  const jobs = await mapById<{ id: string; title: string | null }>(
    input.supabase,
    'jobs',
    rows.map((row) => row.job_id || ''),
    'id, title',
    input.organizationId
  );
  const customers = await mapById<{ id: string; company_name: string | null; contact_name: string | null }>(
    input.supabase,
    'customers',
    rows.map((row) => row.customer_id || ''),
    'id, company_name, contact_name',
    input.organizationId
  );
  const workers = await mapById<{ id: string; name: string | null; email: string | null }>(
    input.supabase,
    'workers',
    rows.map((row) => row.worker_id || ''),
    'id, name, email',
    input.organizationId
  );

  const exportRows = rows.map((row) => ({
    date: formatExportDate(row.date),
    category: String(row.category || ''),
    vendor: String(row.vendor || ''),
    description: String(row.description || ''),
    amount: formatExportMoney(num(row.amount)),
    paymentMethod: String(row.payment_method || ''),
    jobTitle: String(jobs.get(row.job_id || '')?.title || ''),
    customerName: customerDisplayName(customers.get(row.customer_id || '') || null, ''),
    workerName: displayPersonName(workers.get(row.worker_id || '')?.name, workers.get(row.worker_id || '')?.email),
    notes: String(row.notes || '')
  }));

  const total = rows.reduce((sum, row) => sum + num(row.amount), 0);
  const filters = [
    from ? `from=${from}` : '',
    to ? `to=${to}` : '',
    category ? `category=${category}` : '',
    jobId ? `jobId=${jobId}` : '',
    customerId ? `customerId=${customerId}` : '',
    workerId ? `workerId=${workerId}` : '',
    search ? `q=${search}` : ''
  ].filter(Boolean);

  return {
    ok: true,
    data: preparedFromColumns(EXPENSES_EXPORT_COLUMNS, exportRows, {
      filenamePrefix: 'expenses',
      title: input.copy.expensesTitle,
      companyName: companyNameFrom(input.companyName),
      appliedFilters: filters,
      privateLabel: input.copy.privateCompanyRecord,
      summary: [
        { label: input.copy.recordsLabel, value: String(exportRows.length) },
        { label: input.copy.totalLabel, value: formatExportMoney(total) }
      ]
    })
  };
}

export async function loadCustomersExport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  companyName: string;
  searchParams: URLSearchParams;
  copy: ExportCopy;
}): Promise<{ ok: true; data: PreparedExport } | { ok: false; error: string; status: number }> {
  const period = String(input.searchParams.get('period') || '').trim();
  const stageFilter = String(input.searchParams.get('stage') || input.searchParams.get('status') || '').trim();

  let query = input.supabase
    .from('customers')
    .select(CUSTOMER_LIST_SELECT)
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: false })
    .limit(EXPORT_MAX_ROWS);

  if (period === 'month') query = query.gte('created_at', monthStartIso());
  if (stageFilter === 'lead' || stageFilter === 'leads') {
    query = query.or('record_type.eq.lead,pipeline_stage.in.(lead,qualified,open,contacted,quoted)');
  } else if (stageFilter === 'archived') {
    query = query.eq('pipeline_stage', 'archived');
  } else if (stageFilter === 'active') {
    query = query.eq('record_type', 'customer').eq('pipeline_stage', 'active');
  } else if (stageFilter === 'past' || stageFilter === 'inactive' || stageFilter === 'former') {
    query = query.eq('record_type', 'customer').in('pipeline_stage', ['past', 'inactive', 'former']);
  } else {
    query = query.eq('record_type', 'customer').neq('pipeline_stage', 'archived');
  }

  const [{ data, error }, orgIsDemo] = await Promise.all([
    query,
    fetchOrganizationIsDemo(input.supabase, input.organizationId)
  ]);
  if (error) return { ok: false, error: 'Unable to load customers for export.', status: 500 };

  const customers = filterDemoSeedCustomers((data || []) as CustomerRecord[], orgIsDemo);
  const exportRows = customers.map((customer) => ({
    name: customerDisplayName(customer),
    phone: String(customer.phone || ''),
    email: String(customer.email || ''),
    address: customerDisplayAddress(customer),
    stage: String(customer.pipeline_stage || 'lead'),
    source: String(customer.lead_source || ''),
    notes: String(customer.notes || ''),
    createdDate: formatExportDate(customer.created_at),
    updatedDate: formatExportDate(customer.updated_at)
  }));

  const filters = [period ? `period=${period}` : '', stageFilter ? `stage=${stageFilter}` : ''].filter(Boolean);

  return {
    ok: true,
    data: preparedFromColumns(CUSTOMERS_EXPORT_COLUMNS, exportRows, {
      filenamePrefix: 'customers',
      title: input.copy.customersTitle,
      companyName: companyNameFrom(input.companyName),
      appliedFilters: filters,
      privateLabel: input.copy.privateCompanyRecord,
      summary: [{ label: input.copy.recordsLabel, value: String(exportRows.length) }]
    })
  };
}

export async function loadInvoicesExport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  companyName: string;
  searchParams: URLSearchParams;
  copy: ExportCopy;
}): Promise<{ ok: true; data: PreparedExport } | { ok: false; error: string; status: number }> {
  const jobId = String(input.searchParams.get('jobId') || '').trim();
  const customerId = String(input.searchParams.get('customerId') || '').trim();
  const payment = parseInvoicePaymentFilter(input.searchParams.get('payment'));

  let query = input.supabase
    .from('invoices')
    .select(
      'id, invoice_date, due_date, customer_id, job_id, amount, amount_paid, status, payment_status, description'
    )
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: false })
    .limit(EXPORT_MAX_ROWS);

  if (jobId) query = query.eq('job_id', jobId);
  if (customerId) query = query.eq('customer_id', customerId);

  const { data, error } = await query;
  if (error) return { ok: false, error: 'Unable to load invoices for export.', status: 500 };

  const invoices = ((data || []) as Array<{
    id: string;
    invoice_date: string | null;
    due_date: string | null;
    customer_id: string | null;
    job_id: string | null;
    amount: number | null;
    amount_paid: number | null;
    status: string | null;
    payment_status: string | null;
    description: string | null;
  }>).filter((row) => matchesInvoicePaymentFilter(row, payment));

  const jobs = await mapById<{ id: string; title: string | null }>(
    input.supabase,
    'jobs',
    invoices.map((row) => row.job_id || ''),
    'id, title',
    input.organizationId
  );
  const customers = await mapById<{ id: string; company_name: string | null; contact_name: string | null }>(
    input.supabase,
    'customers',
    invoices.map((row) => row.customer_id || ''),
    'id, company_name, contact_name',
    input.organizationId
  );

  const exportRows = invoices.map((row) => {
    const amount = num(row.amount);
    const paid = num(row.amount_paid);
    return {
      invoiceDate: formatExportDate(row.invoice_date),
      dueDate: formatExportDate(row.due_date),
      customerName: customerDisplayName(customers.get(row.customer_id || '') || null, ''),
      jobTitle: String(jobs.get(row.job_id || '')?.title || ''),
      amount: formatExportMoney(amount),
      amountPaid: formatExportMoney(paid),
      balanceDue: formatExportMoney(Math.max(0, amount - paid)),
      status: String(row.status || ''),
      paymentStatus: String(row.payment_status || row.status || ''),
      description: String(row.description || '')
    };
  });

  const total = invoices.reduce((sum, row) => sum + num(row.amount), 0);
  const filters = [
    jobId ? `jobId=${jobId}` : '',
    customerId ? `customerId=${customerId}` : '',
    payment !== 'all' ? `payment=${payment}` : ''
  ].filter(Boolean);

  return {
    ok: true,
    data: preparedFromColumns(INVOICES_EXPORT_COLUMNS, exportRows, {
      filenamePrefix: 'invoices',
      title: input.copy.invoicesTitle,
      companyName: companyNameFrom(input.companyName),
      appliedFilters: filters,
      privateLabel: input.copy.privateCompanyRecord,
      summary: [
        { label: input.copy.recordsLabel, value: String(exportRows.length) },
        { label: input.copy.totalLabel, value: formatExportMoney(total) }
      ]
    })
  };
}

export async function loadPaymentsExport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  companyName: string;
  searchParams: URLSearchParams;
  copy: ExportCopy;
}): Promise<{ ok: true; data: PreparedExport } | { ok: false; error: string; status: number }> {
  const jobId = String(input.searchParams.get('jobId') || '').trim();
  const customerId = String(input.searchParams.get('customerId') || '').trim();
  const invoiceId = String(input.searchParams.get('invoiceId') || '').trim();

  let invoiceQuery = input.supabase
    .from('invoice_payments')
    .select('id, amount, paid_at, invoice_id, payment_method, payment_reference, notes')
    .eq('organization_id', input.organizationId)
    .order('paid_at', { ascending: false })
    .limit(EXPORT_MAX_ROWS);
  if (invoiceId) invoiceQuery = invoiceQuery.eq('invoice_id', invoiceId);

  let jobQuery = input.supabase
    .from('job_payments')
    .select('id, amount, paid_at, job_id, customer_id, invoice_id, payment_method, payment_reference, notes')
    .eq('organization_id', input.organizationId)
    .order('paid_at', { ascending: false })
    .limit(EXPORT_MAX_ROWS);
  if (jobId) jobQuery = jobQuery.eq('job_id', jobId);
  if (customerId) jobQuery = jobQuery.eq('customer_id', customerId);
  if (invoiceId) jobQuery = jobQuery.eq('invoice_id', invoiceId);

  const [invoiceRes, jobRes] = await Promise.all([invoiceQuery, jobQuery]);
  if (invoiceRes.error && !/invoice_payments/i.test(invoiceRes.error.message || '')) {
    return { ok: false, error: 'Unable to load payments for export.', status: 500 };
  }
  if (jobRes.error && !/job_payments/i.test(jobRes.error.message || '')) {
    return { ok: false, error: 'Unable to load payments for export.', status: 500 };
  }

  type InvoicePay = {
    id: string;
    amount: number | null;
    paid_at: string | null;
    invoice_id: string | null;
    payment_method: string | null;
    payment_reference: string | null;
    notes: string | null;
  };
  type JobPay = InvoicePay & { job_id: string | null; customer_id: string | null };

  const invoicePays = (invoiceRes.data || []) as InvoicePay[];
  const jobPays = (jobRes.data || []) as JobPay[];

  const invoiceIds = Array.from(
    new Set([...invoicePays.map((row) => row.invoice_id || ''), ...jobPays.map((row) => row.invoice_id || '')].filter(Boolean))
  );
  const invoices = await mapById<{
    id: string;
    job_id: string | null;
    customer_id: string | null;
  }>(input.supabase, 'invoices', invoiceIds, 'id, job_id, customer_id', input.organizationId);

  const scopedInvoicePays = invoicePays.filter((row) => {
    const invoice = invoices.get(row.invoice_id || '');
    if (jobId && invoice?.job_id !== jobId) return false;
    if (customerId && invoice?.customer_id !== customerId) return false;
    return true;
  });

  const jobIds = Array.from(
    new Set(
      [
        ...jobPays.map((row) => row.job_id || ''),
        ...scopedInvoicePays.map((row) => invoices.get(row.invoice_id || '')?.job_id || '')
      ].filter(Boolean)
    )
  );
  const customerIds = Array.from(
    new Set(
      [
        ...jobPays.map((row) => row.customer_id || ''),
        ...scopedInvoicePays.map((row) => invoices.get(row.invoice_id || '')?.customer_id || '')
      ].filter(Boolean)
    )
  );

  const jobs = await mapById<{ id: string; title: string | null; customer_name: string | null }>(
    input.supabase,
    'jobs',
    jobIds,
    'id, title, customer_name',
    input.organizationId
  );
  const customers = await mapById<{ id: string; company_name: string | null; contact_name: string | null }>(
    input.supabase,
    'customers',
    customerIds,
    'id, company_name, contact_name',
    input.organizationId
  );

  const exportRows = [
    ...scopedInvoicePays.map((row) => {
      const invoice = invoices.get(row.invoice_id || '');
      const job = jobs.get(invoice?.job_id || '');
      const customer = customers.get(invoice?.customer_id || '');
      return {
        paidAt: formatExportDate(row.paid_at),
        source: 'invoice',
        amount: formatExportMoney(num(row.amount)),
        paymentMethod: String(row.payment_method || ''),
        paymentReference: String(row.payment_reference || ''),
        customerName: customerDisplayName(customer || null, job?.customer_name || ''),
        jobTitle: String(job?.title || ''),
        notes: String(row.notes || ''),
        sortAt: String(row.paid_at || '')
      };
    }),
    ...jobPays.map((row) => {
      const job = jobs.get(row.job_id || '');
      const customer = customers.get(row.customer_id || '');
      return {
        paidAt: formatExportDate(row.paid_at),
        source: 'job',
        amount: formatExportMoney(num(row.amount)),
        paymentMethod: String(row.payment_method || ''),
        paymentReference: String(row.payment_reference || ''),
        customerName: customerDisplayName(customer || null, job?.customer_name || ''),
        jobTitle: String(job?.title || ''),
        notes: String(row.notes || ''),
        sortAt: String(row.paid_at || '')
      };
    })
  ]
    .sort((a, b) => String(b.sortAt).localeCompare(String(a.sortAt)))
    .slice(0, EXPORT_MAX_ROWS);

  const total = [...scopedInvoicePays, ...jobPays].reduce((sum, row) => sum + num(row.amount), 0);
  const filters = [
    jobId ? `jobId=${jobId}` : '',
    customerId ? `customerId=${customerId}` : '',
    invoiceId ? `invoiceId=${invoiceId}` : ''
  ].filter(Boolean);

  return {
    ok: true,
    data: preparedFromColumns(PAYMENTS_EXPORT_COLUMNS, exportRows, {
      filenamePrefix: 'payments',
      title: input.copy.paymentsTitle,
      companyName: companyNameFrom(input.companyName),
      appliedFilters: filters,
      privateLabel: input.copy.privateCompanyRecord,
      summary: [
        { label: input.copy.recordsLabel, value: String(exportRows.length) },
        { label: input.copy.totalLabel, value: formatExportMoney(total) }
      ]
    })
  };
}

export async function loadContractorPayExport(input: {
  supabase: SupabaseClient;
  organizationId: string;
  companyName: string;
  searchParams: URLSearchParams;
  copy: ExportCopy;
}): Promise<{ ok: true; data: PreparedExport } | { ok: false; error: string; status: number }> {
  const status = String(input.searchParams.get('status') || 'unpaid').toLowerCase();
  const jobId = String(input.searchParams.get('jobId') || '').trim();
  const filter = status === 'pending' || status === 'paid' || status === 'all' || status === 'unpaid' ? status : 'unpaid';

  let query = input.supabase
    .from('job_labor')
    .select(
      'id, job_id, worker_name, hours, hourly_cost, total_cost, payment_status, paid_at, payment_method, payment_reference'
    )
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: false })
    .limit(EXPORT_MAX_ROWS);

  if (jobId) query = query.eq('job_id', jobId);

  const { data, error } = await query;
  if (error) return { ok: false, error: 'Unable to load contractor pay for export.', status: 500 };

  const labor = ((data || []) as Array<{
    id: string;
    job_id: string;
    worker_name: string | null;
    hours: number | null;
    hourly_cost: number | null;
    total_cost: number | null;
    payment_status: string | null;
    paid_at: string | null;
    payment_method: string | null;
    payment_reference: string | null;
  }>).filter((row) => {
    if (filter === 'all') return true;
    return String(row.payment_status || 'unpaid').toLowerCase() === filter;
  });

  const jobs = await mapById<{ id: string; title: string | null; customer_name: string | null }>(
    input.supabase,
    'jobs',
    labor.map((row) => row.job_id),
    'id, title, customer_name',
    input.organizationId
  );

  const exportRows = labor.map((row) => {
    const job = jobs.get(row.job_id);
    return {
      workerName: String(row.worker_name || ''),
      jobTitle: String(job?.title || ''),
      customerName: String(job?.customer_name || ''),
      hours: row.hours == null ? '' : String(num(row.hours)),
      hourlyCost: formatExportMoney(row.hourly_cost == null ? null : num(row.hourly_cost)),
      totalCost: formatExportMoney(num(row.total_cost)),
      paymentStatus: String(row.payment_status || 'unpaid'),
      paidAt: formatExportDate(row.paid_at),
      paymentMethod: String(row.payment_method || ''),
      paymentReference: String(row.payment_reference || '')
    };
  });

  const total = labor.reduce((sum, row) => sum + num(row.total_cost), 0);
  const filters = [filter !== 'all' ? `status=${filter}` : '', jobId ? `jobId=${jobId}` : ''].filter(Boolean);

  return {
    ok: true,
    data: preparedFromColumns(CONTRACTOR_PAY_EXPORT_COLUMNS, exportRows, {
      filenamePrefix: 'contractor-pay',
      title: input.copy.contractorPayTitle,
      companyName: companyNameFrom(input.companyName),
      appliedFilters: filters,
      privateLabel: input.copy.privateCompanyRecord,
      summary: [
        { label: input.copy.recordsLabel, value: String(exportRows.length) },
        { label: input.copy.totalLabel, value: formatExportMoney(total) }
      ]
    })
  };
}
