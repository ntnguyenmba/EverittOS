'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { ActionFeedbackBanner } from '@/components/action-feedback';
import { PageHeader } from '@/components/page-header';
import { canAccessFinancialTracking, FINANCIAL_TRACKING_MIN_PLAN } from '@/lib/finance-access';
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseRecord } from '@/lib/finance-types';
import { formatCurrency } from '@/lib/finance-format';
import { billingUpgradeHref } from '@/lib/nav-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, planDisplayName, type EverittosPlan } from '@/lib/everittos-plans';
import { canSeeOrgWideData } from '@/lib/permissions';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { errorFeedback, successFeedback, type ActionFeedback } from '@/lib/action-messages';
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
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [expenses, setExpenses] = useState<ExpenseView[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterJobId, setFilterJobId] = useState(searchParams.get('jobId') || '');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterWorkerId, setFilterWorkerId] = useState('');

  const canManage = isManagerRole(role);
  const hasAccess = canAccessFinancialTracking(plan);

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

    const res = await fetch(`/api/expenses?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Unable to load expenses.'));
      return;
    }
    setExpenses(json.expenses || []);
  }, [filterCategory, filterCustomerId, filterFrom, filterJobId, filterTo, filterWorkerId]);

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
      const userPlan = normalizePlan(profile?.plan);
      const userRole = normalizeRole(profile?.role);
      setPlan(userPlan);
      setRole(userRole);

      if (!canSeeOrgWideData(userRole)) {
        setLoading(false);
        setFeedback(errorFeedback('Your role cannot access expenses.'));
        return;
      }

      const org = await fetchOrganizationContext(user.id);
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
      if (canAccessFinancialTracking(userPlan)) {
        await loadExpenses();
      }
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
  }

  function startEdit(expense: ExpenseView) {
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

  async function saveExpense() {
    if (saving) return;
    const amount = Number.parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFeedback(errorFeedback('Enter a valid amount.'));
      return;
    }

    setSaving(true);
    setFeedback(null);

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
      ? await fetch(`/api/expenses/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      : await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

    const json = await res.json();
    if (!res.ok) {
      setSaving(false);
      setFeedback(errorFeedback(json.error || 'Unable to save expense.'));
      return;
    }

    const expenseId = editingId || json.expense?.id;
    if (receiptFile && expenseId) {
      const fd = new FormData();
      fd.append('file', receiptFile);
      const receiptRes = await fetch(`/api/expenses/${expenseId}/receipt`, { method: 'POST', body: fd });
      if (!receiptRes.ok) {
        const receiptJson = await receiptRes.json();
        setSaving(false);
        setFeedback(errorFeedback(receiptJson.error || 'Expense saved but receipt upload failed.'));
        resetForm();
        await loadExpenses();
        return;
      }
    }

    setSaving(false);
    setFeedback(successFeedback(editingId ? 'Expense updated.' : 'Expense added.'));
    resetForm();
    await loadExpenses();
  }

  async function deleteExpense(id: string) {
    if (!window.confirm('Delete this expense?')) return;
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Unable to delete expense.'));
      return;
    }
    setFeedback(successFeedback('Expense deleted.'));
    await loadExpenses();
  }

  const totalFiltered = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  if (!hasAccess) {
    return (
      <AppShell plan={plan} role={role}>
        <PageHeader title="Expenses" subtitle="Track business spending without full bookkeeping." />
        <div className="card plan-gate-card">
          <h3>Expenses and job profit</h3>
          <p className="muted">
            {planDisplayName(FINANCIAL_TRACKING_MIN_PLAN)} and above unlock expense tracking, job profitability, and
            business performance reports.
          </p>
          <Link className="btn btn-primary" href={billingUpgradeHref(FINANCIAL_TRACKING_MIN_PLAN, 'Expenses')}>
            Upgrade to {planDisplayName(FINANCIAL_TRACKING_MIN_PLAN)}
          </Link>
        </div>
        <div className="card finance-demo-card">
          <p className="muted">Preview on Free plan (read-only sample)</p>
          <div className="finance-list-card">
            <strong>Supplies</strong>
            <p className="muted">Home Depot · $84.50</p>
          </div>
          <div className="finance-list-card">
            <strong>Fuel</strong>
            <p className="muted">Shell · $62.00</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader
        title="Expenses"
        subtitle="Track fuel, supplies, materials, and other costs. Link expenses to jobs for profit estimates."
        action={
          canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Close' : 'Add expense'}
            </button>
          ) : undefined
        }
      />

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="finance-filter-bar">
        <button type="button" className="btn" onClick={() => setShowFilters((v) => !v)}>
          {showFilters ? 'Hide filters' : 'Filters'}
        </button>
        <strong>Total: {formatCurrency(totalFiltered)}</strong>
      </div>

      {showFilters ? (
        <div className="card finance-filter-panel">
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
          <label>Worker</label>
          <select className="input" value={filterWorkerId} onChange={(e) => setFilterWorkerId(e.target.value)}>
            <option value="">All workers</option>
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
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
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
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
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
          <label>Worker (optional)</label>
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
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add expense'}
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
          <div className="finance-empty-block">
            <p>No expenses yet.</p>
            {canManage ? (
              <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                Add your first expense to see estimated profit.
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && expenses.length > 0 ? (
          <div className="finance-expense-list">
            {expenses.map((expense) => (
              <article key={expense.id} className="finance-list-card">
                <div className="finance-list-card-main">
                  <div className="finance-list-card-head">
                    <strong>{expense.category}</strong>
                    <span>{formatCurrency(expense.amount)}</span>
                  </div>
                  <p className="muted">
                    {expense.date}
                    {expense.vendor ? ` · ${expense.vendor}` : ''}
                  </p>
                  {expense.description ? <p>{expense.description}</p> : null}
                  <p className="muted finance-tags">
                    {expense.job_id ? <span>Job: {jobMap.get(expense.job_id) || 'Linked job'}</span> : null}
                    {expense.customer_id ? <span>Customer: {customerMap.get(expense.customer_id)}</span> : null}
                    {expense.worker_id ? <span>Worker: {workerMap.get(expense.worker_id)}</span> : null}
                  </p>
                  {expense.receipt_signed_url ? (
                    <a className="btn" href={expense.receipt_signed_url} target="_blank" rel="noreferrer">
                      View receipt
                    </a>
                  ) : null}
                </div>
                {canManage ? (
                  <div className="finance-list-card-actions">
                    <button type="button" className="btn" onClick={() => startEdit(expense)}>
                      Edit
                    </button>
                    <button type="button" className="btn" onClick={() => void deleteExpense(expense.id)}>
                      Delete
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
