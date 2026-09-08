'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { ExportMenu } from '@/components/export-menu';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { PageHeader } from '@/components/page-header';
import { canAccessFinancials, FINANCIAL_TRACKING_MIN_PLAN } from '@/lib/finance-access';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_OPTIONS, type ExpenseCategory, type ExpenseRecord } from '@/lib/finance-types';
import { formatCurrency } from '@/lib/finance-format';
import { fetchWithTimeout, requestFailureMessage } from '@/lib/fetch-with-timeout';
import { formatExpensesCopy, getExpensesPageCopy } from '@/lib/i18n/expenses-copy';
import { getExportCopy } from '@/lib/i18n/export-copy';
import { billingUpgradeHref } from '@/lib/nav-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type JobOption = { id: string; title: string; customer_id: string | null };
type CustomerOption = { id: string; company_name: string };
type WorkerOption = { id: string; name: string };

type ExpenseView = ExpenseRecord & { receipt_signed_url?: string | null };

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  category: 'Other' as ExpenseCategory,
  vendor: '',
  description: '',
  amount: '',
  payment_method: '',
  notes: '',
  job_id: '',
  customer_id: '',
  worker_id: ''
};

function ExpensesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appFeedback = useAppFeedback();
  const { locale } = useTranslation();
  const copy = getExpensesPageCopy(locale);
  const exportCopy = getExportCopy(locale);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [expenses, setExpenses] = useState<ExpenseView[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleDenied, setRoleDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterJobId, setFilterJobId] = useState(searchParams.get('jobId') || '');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterWorkerId, setFilterWorkerId] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const requestedExpenseId = searchParams.get('edit') || searchParams.get('expense') || '';
  const shouldEditRequestedExpense = Boolean(searchParams.get('edit'));

  const hasAccess = canAccessFinancials(role, plan);
  const canManage = hasAccess;

  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j.title])), [jobs]);
  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c.company_name])), [customers]);
  const workerMap = useMemo(() => new Map(workers.map((w) => [w.id, w.name])), [workers]);

  const loadExpenses = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo) params.set('to', filterTo);
    if (filterCategory) params.set('category', filterCategory);
    if (filterJobId) params.set('jobId', filterJobId);
    if (filterCustomerId) params.set('customerId', filterCustomerId);
    if (filterWorkerId) params.set('workerId', filterWorkerId);
    if (filterSearch.trim()) params.set('q', filterSearch.trim());

    const res = await fetch(`/api/expenses?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to load expenses.');
      return;
    }
    setExpenses(json.expenses || []);
  }, [appFeedback, filterCategory, filterCustomerId, filterFrom, filterJobId, filterSearch, filterTo, filterWorkerId]);

  useEffect(() => {
    async function init() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/expenses');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const org = await fetchOrganizationContext(user.id);
      const userPlan = normalizePlan(profile?.plan);
      const userRole = normalizeRole(org?.role || profile?.role);
      setPlan(userPlan);
      setRole(userRole);
      setRoleDenied(false);

      if (!canAccessFinancials(userRole, userPlan)) {
        setLoading(false);
        if (userRole !== 'owner' && userRole !== 'admin') {
          setRoleDenied(true);
          appFeedback.error('Your role cannot access expenses.');
        }
        return;
      }

      if (org?.organizationId) {
        const [jobsRes, customersRes, workersRes] = await Promise.all([
          supabase.from('jobs').select('id, title, customer_id').eq('organization_id', org.organizationId).order('title'),
          supabase.from('customers').select('id, company_name').eq('organization_id', org.organizationId).order('company_name'),
          supabase.from('workers').select('id, name').eq('organization_id', org.organizationId).order('name')
        ]);
        setJobs((jobsRes.data || []) as JobOption[]);
        setCustomers((customersRes.data || []) as CustomerOption[]);
        setWorkers((workersRes.data || []) as WorkerOption[]);
      }

      setLoading(false);
      await loadExpenses();
    }
    void init();
  }, [loadExpenses, router]);

  useEffect(() => {
    if (hasAccess) void loadExpenses();
  }, [hasAccess, loadExpenses]);

  function resetForm() {
    setForm({ ...EMPTY_FORM, job_id: filterJobId });
    setReceiptFile(null);
    setEditingId(null);
    setShowForm(false);
    if (requestedExpenseId) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('edit');
      params.delete('expense');
      const query = params.toString();
      router.replace(query ? `/expenses?${query}` : '/expenses');
    }
  }

  function startEdit(expense: ExpenseView) {
    if (expense.source === 'quickbooks') {
      appFeedback.error('This expense is managed in QuickBooks and cannot be edited here.');
      return;
    }
    setEditingId(expense.id);
    setShowForm(true);
    setForm({
      date: expense.date,
      category: expense.category,
      vendor: expense.vendor || '',
      description: expense.description || '',
      amount: String(expense.amount),
      payment_method: expense.payment_method || '',
      notes: expense.notes || '',
      job_id: expense.job_id || '',
      customer_id: expense.customer_id || '',
      worker_id: expense.worker_id || ''
    });
    setReceiptFile(null);
  }

  useEffect(() => {
    if (!requestedExpenseId || loading) return;
    const expense = expenses.find((item) => item.id === requestedExpenseId);
    if (!expense) return;

    window.requestAnimationFrame(() => {
      document.getElementById(`expense-${requestedExpenseId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    if (!shouldEditRequestedExpense || expense.source === 'quickbooks' || editingId === expense.id) return;
    setEditingId(expense.id);
    setShowForm(true);
    setForm({
      date: expense.date,
      category: expense.category,
      vendor: expense.vendor || '',
      description: expense.description || '',
      amount: String(expense.amount),
      payment_method: expense.payment_method || '',
      notes: expense.notes || '',
      job_id: expense.job_id || '',
      customer_id: expense.customer_id || '',
      worker_id: expense.worker_id || ''
    });
    setReceiptFile(null);
  }, [editingId, expenses, loading, requestedExpenseId, shouldEditRequestedExpense]);

  async function saveExpense() {
    if (saving) return;
    const amount = Number.parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      appFeedback.error('Enter an amount other than zero. Use a negative amount for a refund or credit.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: form.date,
        category: form.category,
        vendor: form.vendor,
        description: form.description,
        amount,
        payment_method: form.payment_method,
        notes: form.notes,
        job_id: form.job_id || null,
        customer_id: form.customer_id || null,
        worker_id: form.worker_id || null
      };

      const res = editingId
        ? await fetchWithTimeout(`/api/expenses/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await fetchWithTimeout('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

      const json = (await res.json().catch(() => ({}))) as { expense?: { id?: string }; error?: string };
      if (!res.ok) {
        appFeedback.error(json.error || 'Unable to save expense.');
        return;
      }

      const expenseId = editingId || json.expense?.id;
      if (receiptFile && expenseId) {
        const fd = new FormData();
        fd.append('file', receiptFile);
        const receiptRes = await fetchWithTimeout(`/api/expenses/${expenseId}/receipt`, { method: 'POST', body: fd }, 30_000);
        if (!receiptRes.ok) {
          const receiptJson = (await receiptRes.json().catch(() => ({}))) as { error?: string };
          appFeedback.error(receiptJson.error || 'Expense saved but receipt upload failed.');
          resetForm();
          await loadExpenses();
          return;
        }
      }

      if (editingId) appFeedback.updated();
      else appFeedback.created();
      resetForm();
      await loadExpenses();
    } catch (error) {
      appFeedback.error(requestFailureMessage(error, 'Unable to save expense.'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(id: string) {
    if (deletingId) return;
    if (!window.confirm(copy.deleteConfirm)) return;
    setDeletingId(id);
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    const json = await res.json();
    setDeletingId(null);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to delete expense.');
      return;
    }
    appFeedback.deleted();
    await loadExpenses();
  }

  const totalFiltered = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  if (roleDenied) {
    return (
      <AppShell plan={plan} role={role}>
        <PageHeader title="Expenses" subtitle="Track business spending without full bookkeeping." />
        <div className="card plan-gate-card">
          <h3>Expenses are limited to owners, admins, and managers</h3>
          <p className="muted">Your workspace role cannot access business expenses, revenue, or profit tracking.</p>
        </div>
      </AppShell>
    );
  }

  if (!hasAccess) {
    const minPlanName = planDisplayName(FINANCIAL_TRACKING_MIN_PLAN);
    return (
      <AppShell plan={plan} role={role}>
        <PageHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="card plan-gate-card">
          <h3>{copy.gateTitle}</h3>
          <p className="muted">{formatExpensesCopy(copy.gateBody, { plan: minPlanName })}</p>
          <Link className="btn btn-primary" href={billingUpgradeHref(FINANCIAL_TRACKING_MIN_PLAN, copy.title)}>
            {formatExpensesCopy(copy.upgrade, { plan: minPlanName })}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <ExportMenu
              endpoint="/api/exports/expenses"
              query={{
                from: filterFrom,
                to: filterTo,
                category: filterCategory,
                jobId: filterJobId,
                customerId: filterCustomerId,
                workerId: filterWorkerId,
                q: filterSearch
              }}
              locale={locale}
              disabled={loading}
              onError={(message) => appFeedback.error(message || exportCopy.exportFailed)}
              onSuccess={(format) => {
                if (format === 'share') appFeedback.success(exportCopy.shareSent);
              }}
            />
            {canManage ? (
              <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
                {showForm ? copy.close : copy.addExpense}
              </button>
            ) : null}
          </div>
        }
      />

      <div className="finance-filter-bar">
        <button type="button" className="btn" onClick={() => setShowFilters((v) => !v)}>
          {showFilters ? copy.hideFilters : copy.filters}
        </button>
        <strong>
          {copy.total}: {formatCurrency(totalFiltered)}
        </strong>
      </div>

      {showFilters ? (
        <div className="card finance-filter-panel">
          <label>Search</label>
          <input
            className="input"
            placeholder="Vendor, description, or notes"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
          <label>From date</label>
          <input className="input" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          <label>To date</label>
          <input className="input" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          <label>Category</label>
          <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <label>Job</label>
          <select className="input" value={filterJobId} onChange={(e) => setFilterJobId(e.target.value)}>
            <option value="">All jobs</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
          <label>Customer</label>
          <select className="input" value={filterCustomerId} onChange={(e) => setFilterCustomerId(e.target.value)}>
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
          <label>Team member</label>
          <select className="input" value={filterWorkerId} onChange={(e) => setFilterWorkerId(e.target.value)}>
            <option value="">All team members</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" onClick={() => void loadExpenses()}>
            Apply filters
          </button>
        </div>
      ) : null}

      {showForm && canManage ? (
        <div className="card form finance-form-block">
          <h3>{editingId ? 'Edit expense' : 'Add expense'}</h3>
          <label>Date</label>
          <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <label>Category</label>
          <select
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
          >
            {EXPENSE_CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            {editingId && !EXPENSE_CATEGORY_OPTIONS.includes(form.category) ? (
              <option value={form.category}>{form.category} (legacy)</option>
            ) : null}
          </select>
          <label>Vendor</label>
          <input className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          <label>Description</label>
          <input
            className="input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <label>Amount</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <small className="muted">Enter a negative amount for a refund or credit, for example -12.47.</small>
          <label>Related job (optional)</label>
          <select className="input" value={form.job_id} onChange={(e) => setForm({ ...form, job_id: e.target.value })}>
            <option value="">None</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
          <label>Related customer (optional)</label>
          <select
            className="input"
            value={form.customer_id}
            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
          >
            <option value="">None</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
          <label>Team member (optional)</label>
          <select
            className="input"
            value={form.worker_id}
            onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
          >
            <option value="">None</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <label>Payment method (optional)</label>
          <input
            className="input"
            placeholder="Cash, card, check..."
            value={form.payment_method}
            onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
          />
          <label>Receipt photo (optional)</label>
          <input className="input" type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
          <label>Notes (optional)</label>
          <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="finance-actions">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveExpense()}>
              {saving ? FEEDBACK.loading : editingId ? copy.saveChanges : copy.addExpense}
            </button>
            <button type="button" className="btn" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        {loading ? <p className="loading-state">Loading expenses...</p> : null}
        {!loading && expenses.length === 0 ? (
          <div className="empty-state">
            <h3>No business expenses recorded yet</h3>
            <p className="muted">
              Add supplies, software, fuel, advertising, and other operating costs to improve profit reporting.
            </p>
            {canManage ? (
              <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                {copy.addExpense}
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && expenses.length > 0 ? (
          <div className="finance-expense-list">
            {expenses.map((expense) => (
              <article id={`expense-${expense.id}`} key={expense.id} className="finance-list-card open-in-new-tab-card">
                <Link
                  href={expense.source === 'quickbooks' ? `/expenses?expense=${encodeURIComponent(expense.id)}` : `/expenses?edit=${encodeURIComponent(expense.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="record-card-overlay-link"
                  aria-label={`Open ${expense.description || expense.category} in a new tab`}
                >
                  <span className="record-card-overlay-label">Open {expense.description || expense.category} in a new tab</span>
                </Link>
                <div className="finance-list-card-main">
                  <div className="finance-list-card-head">
                    <strong>{expense.amount < 0 ? `${expense.category} · Credit` : expense.category}</strong>
                    <span>{formatCurrency(expense.amount)}</span>
                  </div>
                  <p className="muted">
                    {expense.date}
                    {expense.vendor ? ` · ${expense.vendor}` : ''}
                    {` · ${expense.source === 'quickbooks' ? 'QuickBooks' : 'Manual'}`}
                  </p>
                  {expense.description ? <p>{expense.description}</p> : null}
                  {expense.source === 'quickbooks' ? (
                    <p className="muted">Managed in QuickBooks. Edit or delete it there to avoid duplicate totals.</p>
                  ) : null}
                  <p className="muted finance-tags">
                    {expense.job_id ? <span>Job: <Link href={`/jobs/${expense.job_id}`} target="_blank" rel="noopener noreferrer">{jobMap.get(expense.job_id) || 'Linked job'}</Link></span> : null}
                    {expense.customer_id ? <span>Customer: <Link href={`/customers/${expense.customer_id}`} target="_blank" rel="noopener noreferrer">{customerMap.get(expense.customer_id)}</Link></span> : null}
                    {expense.worker_id ? <span>Team member: <Link href={`/jobs?assigned_to=${encodeURIComponent(expense.worker_id)}`} target="_blank" rel="noopener noreferrer">{workerMap.get(expense.worker_id)}</Link></span> : null}
                    {expense.created_at ? <span>Added {expense.created_at.slice(0, 10)}</span> : null}
                  </p>
                  {expense.receipt_signed_url ? (
                    <a className="btn" href={expense.receipt_signed_url} target="_blank" rel="noreferrer">
                      View receipt
                    </a>
                  ) : null}
                </div>
                {canManage && expense.source !== 'quickbooks' ? (
                  <div className="finance-list-card-actions">
                    <button type="button" className="btn" onClick={() => startEdit(expense)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={deletingId === expense.id}
                      onClick={() => void deleteExpense(expense.id)}
                    >
                      {deletingId === expense.id ? FEEDBACK.loading : copy.delete}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<p className="loading-state">Loading expenses...</p>}>
      <ExpensesContent />
    </Suspense>
  );
}
