'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SettingsShell } from '@/components/settings/settings-shell';

type ReferralPayout = {
  payout_status: 'unpaid' | 'pending' | 'paid';
  payout_amount: number | null;
  payout_date: string | null;
  payout_notes: string | null;
};

type ReferralRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  business_name: string | null;
  referral_source: string | null;
  referral_detail: string | null;
  referred_by: string | null;
  created_at: string | null;
  payout: ReferralPayout | null;
};

type PayoutStatus = 'Unpaid' | 'Pending' | 'Paid';

type PayoutDraft = {
  status: PayoutStatus;
  amount: string;
  paidAt: string;
  notes: string;
  referralSource: string;
  referralDetail: string;
  referredBy: string;
};

function formatDate(value: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

function statusLabel(value: string | null | undefined): PayoutStatus {
  if (value === 'paid') return 'Paid';
  if (value === 'pending') return 'Pending';
  return 'Unpaid';
}

function payoutDraft(row: ReferralRow): PayoutDraft {
  return {
    status: statusLabel(row.payout?.payout_status),
    amount: row.payout?.payout_amount === null || row.payout?.payout_amount === undefined ? '' : String(row.payout.payout_amount),
    paidAt: row.payout?.payout_date || '',
    notes: row.payout?.payout_notes || '',
    referralSource: row.referral_source || '',
    referralDetail: row.referral_detail || '',
    referredBy: row.referred_by || ''
  };
}

function downloadCsv(rows: ReferralRow[], payouts: Record<string, PayoutDraft>, from: string, to: string) {
  const headers = ['signup_date', 'customer_email', 'customer_name', 'business_name', 'source', 'referral_detail', 'referred_by', 'payout_status', 'payout_amount', 'payout_date', 'payout_notes'];
  const csvRows = rows.map((row) => {
    const payout = payouts[row.id] || payoutDraft(row);
    const values = [
      row.created_at || '',
      row.email || '',
      row.full_name || '',
      row.business_name || '',
      payout.referralSource,
      payout.referralDetail,
      payout.referredBy,
      payout.status,
      payout.amount,
      payout.paidAt,
      payout.notes
    ];
    return values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',');
  });
  const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const range = from || to ? `-${from || 'start'}-to-${to || 'today'}` : '';
  link.href = url;
  link.download = `everitt-referrals${range}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReferralReportPage() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [savingId, setSavingId] = useState('');
  const [payouts, setPayouts] = useState<Record<string, PayoutDraft>>({});

  async function load(from = '', to = '') {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/settings/referrals${params.size ? `?${params.toString()}` : ''}`);
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error || 'Unable to load referral report.');
      return;
    }
    const nextRows = (json.referrals || []) as ReferralRow[];
    setRows(nextRows);
    setPayouts(Object.fromEntries(nextRows.map((row) => [row.id, payoutDraft(row)])));
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  useEffect(() => {
    void load();
  }, []);

  const sources = useMemo(() => Array.from(new Set(rows.map((row) => row.referral_source).filter(Boolean) as string[])).sort(), [rows]);
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const payout = payouts[row.id] || payoutDraft(row);
      if (sourceFilter && payout.referralSource !== sourceFilter) return false;
      if (statusFilter && payout.status !== statusFilter) return false;
      if (!q) return true;
      return [row.email, row.full_name, row.business_name, payout.referralSource, payout.referralDetail, payout.referredBy]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [rows, payouts, search, sourceFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ReferralRow[]>();
    for (const row of filteredRows) {
      const draft = payouts[row.id] || payoutDraft(row);
      const key = draft.referralDetail || draft.referredBy || draft.referralSource || 'Unknown';
      const current = map.get(key) || [];
      current.push(row);
      map.set(key, current);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [filteredRows, payouts]);

  const totals = useMemo(() => {
    let unpaid = 0;
    let pending = 0;
    let paid = 0;
    for (const row of filteredRows) {
      const payout = payouts[row.id] || payoutDraft(row);
      const amount = Number.parseFloat(payout.amount) || 0;
      if (payout.status === 'Paid') paid += amount;
      else if (payout.status === 'Pending') pending += amount;
      else unpaid += amount;
    }
    return { unpaid, pending, paid };
  }, [filteredRows, payouts]);

  const leaderboard = useMemo(() => {
    const map = new Map<string, { signups: number; paid: number; pending: number; unpaid: number }>();
    for (const row of filteredRows) {
      const payout = payouts[row.id] || payoutDraft(row);
      const key = payout.referralDetail || payout.referredBy || payout.referralSource || 'Unknown';
      const current = map.get(key) || { signups: 0, paid: 0, pending: 0, unpaid: 0 };
      const amount = Number.parseFloat(payout.amount) || 0;
      current.signups += 1;
      if (payout.status === 'Paid') current.paid += amount;
      else if (payout.status === 'Pending') current.pending += amount;
      else current.unpaid += amount;
      map.set(key, current);
    }
    return Array.from(map.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.signups - a.signups || b.paid - a.paid || a.name.localeCompare(b.name));
  }, [filteredRows, payouts]);

  const monthlyTotals = useMemo(() => {
    const map = new Map<string, { signups: number; paid: number; pending: number; unpaid: number }>();
    for (const row of filteredRows) {
      const payout = payouts[row.id] || payoutDraft(row);
      const date = payout.paidAt || row.created_at || '';
      const month = date.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) continue;
      const current = map.get(month) || { signups: 0, paid: 0, pending: 0, unpaid: 0 };
      const amount = Number.parseFloat(payout.amount) || 0;
      current.signups += 1;
      if (payout.status === 'Paid') current.paid += amount;
      else if (payout.status === 'Pending') current.pending += amount;
      else current.unpaid += amount;
      map.set(month, current);
    }
    return Array.from(map.entries())
      .map(([month, values]) => ({ month, ...values }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredRows, payouts]);

  function updatePayout(rowId: string, patch: Partial<PayoutDraft>) {
    setPayouts((current) => ({
      ...current,
      [rowId]: {
        ...(current[rowId] || {
          status: 'Unpaid',
          amount: '',
          paidAt: '',
          notes: '',
          referralSource: '',
          referralDetail: '',
          referredBy: ''
        }),
        ...patch
      }
    }));
  }

  async function savePayout(row: ReferralRow) {
    const payout = payouts[row.id] || payoutDraft(row);
    setSavingId(row.id);
    setError('');
    setSuccess('');
    const res = await fetch('/api/settings/referrals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: row.id,
        referralSource: payout.referralSource,
        referralDetail: payout.referralDetail,
        referredBy: payout.referredBy,
        payoutStatus: payout.status,
        payoutAmount: payout.amount,
        payoutDate: payout.paidAt || null,
        payoutNotes: payout.notes
      })
    });
    const json = await res.json().catch(() => ({}));
    setSavingId('');
    if (!res.ok) {
      setError(json.error || 'Unable to save referral payout.');
      return;
    }
    setSuccess(`Referral payout saved for ${row.email || row.business_name || 'signup'}.`);
    await load(appliedFrom, appliedTo);
  }

  async function applyDateRange() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError('The start date must be before or equal to the end date.');
      return;
    }
    await load(dateFrom, dateTo);
  }

  async function clearDateRange() {
    setDateFrom('');
    setDateTo('');
    await load('', '');
  }

  return (
    <SettingsShell title="Referral report" description="Track signup sources, referrers, and payout status for EverittOS referrals.">
      <div className="settings-card">
        <p className="muted">Referral details and payout status are saved to the EverittOS database and included in CSV export.</p>
        <p><Link href="/settings">Back to settings</Link></p>
      </div>

      <div className="settings-card form settings-form-grid">
        <h3>Signup date range</h3>
        <label htmlFor="referral-date-from">From</label>
        <input id="referral-date-from" className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <label htmlFor="referral-date-to">To</label>
        <input id="referral-date-to" className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <div className="inline-actions">
          <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void applyDateRange()}>
            {loading ? 'Loading...' : 'Apply date range'}
          </button>
          <button type="button" className="btn" disabled={loading || (!dateFrom && !dateTo && !appliedFrom && !appliedTo)} onClick={() => void clearDateRange()}>
            Clear dates
          </button>
        </div>
        <p className="muted">
          {appliedFrom || appliedTo
            ? `Showing signups from ${appliedFrom || 'the beginning'} through ${appliedTo || 'today'}.`
            : 'Showing referral signups from all dates.'}
        </p>
      </div>

      <div className="finance-metric-grid financials-summary-grid">
        <div className="finance-metric"><span className="finance-metric-label">Matching signups</span><strong>{filteredRows.length}</strong></div>
        <div className="finance-metric"><span className="finance-metric-label">Unpaid liability</span><strong>${totals.unpaid.toFixed(2)}</strong></div>
        <div className="finance-metric"><span className="finance-metric-label">Pending payouts</span><strong>${totals.pending.toFixed(2)}</strong></div>
        <div className="finance-metric"><span className="finance-metric-label">Paid referrals</span><strong>${totals.paid.toFixed(2)}</strong></div>
      </div>

      {leaderboard.length > 0 ? (
        <section className="settings-card">
          <h3>Referral leaderboard</h3>
          <div className="finance-list">
            {leaderboard.map((item, index) => (
              <div key={item.name} className="finance-list-card">
                <div>
                  <strong>#{index + 1} {item.name}</strong>
                  <p className="muted">{item.signups} signup{item.signups === 1 ? '' : 's'}</p>
                </div>
                <div className="finance-metric-grid financials-summary-grid">
                  <div className="finance-metric"><span className="finance-metric-label">Paid</span><strong>${item.paid.toFixed(2)}</strong></div>
                  <div className="finance-metric"><span className="finance-metric-label">Pending</span><strong>${item.pending.toFixed(2)}</strong></div>
                  <div className="finance-metric"><span className="finance-metric-label">Unpaid</span><strong>${item.unpaid.toFixed(2)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {monthlyTotals.length > 0 ? (
        <section className="settings-card">
          <h3>Monthly referral totals</h3>
          <div className="finance-list">
            {monthlyTotals.map((item) => (
              <div key={item.month} className="finance-list-card">
                <div>
                  <strong>{monthLabel(item.month)}</strong>
                  <p className="muted">{item.signups} signup{item.signups === 1 ? '' : 's'}</p>
                </div>
                <div className="finance-metric-grid financials-summary-grid">
                  <div className="finance-metric"><span className="finance-metric-label">Paid</span><strong>${item.paid.toFixed(2)}</strong></div>
                  <div className="finance-metric"><span className="finance-metric-label">Pending</span><strong>${item.pending.toFixed(2)}</strong></div>
                  <div className="finance-metric"><span className="finance-metric-label">Unpaid</span><strong>${item.unpaid.toFixed(2)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="settings-card form settings-form-grid">
        <label htmlFor="referral-search">Search referrals</label>
        <input id="referral-search" className="input" placeholder="Name, email, company, source, or referrer" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label htmlFor="referral-source-filter">Source filter</label>
        <select id="referral-source-filter" className="input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">All sources</option>
          {sources.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
        <label htmlFor="referral-status-filter">Payout status</label>
        <select id="referral-status-filter" className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
        </select>
        <button type="button" className="btn" onClick={() => downloadCsv(filteredRows, payouts, appliedFrom, appliedTo)} disabled={filteredRows.length === 0}>Export filtered CSV</button>
      </div>

      {success ? <div className="settings-card"><p className="auth-message">{success}</p></div> : null}
      {loading ? <p className="loading-state">Loading referrals...</p> : null}
      {error ? <div className="settings-card"><p className="auth-message auth-message-error">{error}</p></div> : null}
      {!loading && !error && filteredRows.length === 0 ? <div className="settings-card"><p className="muted">No referral signups found for the selected filters.</p></div> : null}

      {grouped.map(([referrer, signups]) => (
        <section key={referrer} className="settings-card">
          <div className="job-financials-head"><div><h3>{referrer}</h3><p className="muted">{signups.length} signup{signups.length === 1 ? '' : 's'}</p></div></div>
          <div className="finance-list">
            {signups.map((row) => {
              const payout = payouts[row.id] || payoutDraft(row);
              return (
                <div key={row.id} className="finance-list-card">
                  <div>
                    <strong>{row.business_name || row.full_name || row.email || 'Signup'}</strong>
                    <p className="muted">{row.email || 'No email'} · Signed up {formatDate(row.created_at)}</p>
                  </div>
                  <div className="finance-form-block compact-finance-form" style={{ minWidth: 280 }}>
                    <label>Referral source</label>
                    <input className="input" value={payout.referralSource} onChange={(e) => updatePayout(row.id, { referralSource: e.target.value })} />
                    <label>Referral details</label>
                    <input className="input" value={payout.referralDetail} onChange={(e) => updatePayout(row.id, { referralDetail: e.target.value })} />
                    <label>Referred by</label>
                    <input className="input" value={payout.referredBy} onChange={(e) => updatePayout(row.id, { referredBy: e.target.value })} />
                    <label>Payout status</label>
                    <select className="input" value={payout.status} onChange={(e) => updatePayout(row.id, { status: e.target.value as PayoutStatus })}>
                      <option value="Unpaid">Unpaid</option><option value="Pending">Pending</option><option value="Paid">Paid</option>
                    </select>
                    <label>Referral amount</label>
                    <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={payout.amount} onChange={(e) => updatePayout(row.id, { amount: e.target.value })} />
                    <label>Payout date</label>
                    <input className="input" type="date" value={payout.paidAt} onChange={(e) => updatePayout(row.id, { paidAt: e.target.value })} />
                    <label>Notes</label>
                    <input className="input" placeholder="Payment note or Zelle reference" value={payout.notes} onChange={(e) => updatePayout(row.id, { notes: e.target.value })} />
                    <button type="button" className="btn btn-primary" disabled={savingId === row.id} onClick={() => void savePayout(row)}>{savingId === row.id ? 'Saving...' : 'Save referral payout'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </SettingsShell>
  );
}
