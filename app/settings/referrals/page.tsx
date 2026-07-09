'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SettingsShell } from '@/components/settings/settings-shell';

type ReferralRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  business_name: string | null;
  referral_source: string | null;
  referral_detail: string | null;
  referred_by: string | null;
  created_at: string | null;
};

type PayoutStatus = 'Unpaid' | 'Pending' | 'Paid';

type PayoutDraft = {
  status: PayoutStatus;
  amount: string;
  paidAt: string;
  notes: string;
};

function formatDate(value: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function referralKey(row: ReferralRow) {
  return row.referral_detail || row.referred_by || row.referral_source || 'Unknown';
}

function downloadCsv(rows: ReferralRow[], payouts: Record<string, PayoutDraft>) {
  const headers = ['signup_date', 'customer_email', 'customer_name', 'business_name', 'source', 'referral_detail', 'referred_by', 'payout_status', 'payout_amount', 'payout_date', 'payout_notes'];
  const csvRows = rows.map((row) => {
    const payout = payouts[row.id] || { status: 'Unpaid', amount: '', paidAt: '', notes: '' };
    const values = [
      row.created_at || '',
      row.email || '',
      row.full_name || '',
      row.business_name || '',
      row.referral_source || '',
      row.referral_detail || '',
      row.referred_by || '',
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
  link.href = url;
  link.download = `everitt-referrals-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReferralReportPage() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [payouts, setPayouts] = useState<Record<string, PayoutDraft>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('everittos.referral-payouts.v1');
      if (saved) setPayouts(JSON.parse(saved));
    } catch {
      // Ignore local payout draft read errors.
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      const res = await fetch('/api/settings/referrals');
      const json = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(json.error || 'Unable to load referral report.');
        return;
      }
      setRows(json.referrals || []);
    }

    void load();
  }, []);

  const sources = useMemo(() => Array.from(new Set(rows.map((row) => row.referral_source).filter(Boolean) as string[])).sort(), [rows]);
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (sourceFilter && row.referral_source !== sourceFilter) return false;
      if (!q) return true;
      return [row.email, row.full_name, row.business_name, row.referral_source, row.referral_detail, row.referred_by]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [rows, search, sourceFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ReferralRow[]>();
    for (const row of filteredRows) {
      const key = referralKey(row);
      const current = map.get(key) || [];
      current.push(row);
      map.set(key, current);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [filteredRows]);

  function updatePayout(rowId: string, patch: Partial<PayoutDraft>) {
    setPayouts((current) => {
      const next = {
        ...current,
        [rowId]: {
          status: 'Unpaid',
          amount: '',
          paidAt: '',
          notes: '',
          ...(current[rowId] || {}),
          ...patch
        }
      };
      try {
        localStorage.setItem('everittos.referral-payouts.v1', JSON.stringify(next));
      } catch {
        // Keep UI usable even if localStorage is unavailable.
      }
      return next;
    });
  }

  return (
    <SettingsShell title="Referral report" description="Track signup sources, referrers, and payout status for EverittOS referrals.">
      <div className="settings-card">
        <p className="muted">
          This report shows referral information captured during signup. Payout status is saved in this browser for now, and CSV export includes the payout notes.
        </p>
        <p>
          <Link href="/settings">Back to settings</Link>
        </p>
      </div>

      <div className="settings-card form settings-form-grid">
        <label htmlFor="referral-search">Search referrals</label>
        <input id="referral-search" className="input" placeholder="Name, email, company, source, or referrer" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label htmlFor="referral-source-filter">Source filter</label>
        <select id="referral-source-filter" className="input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">All sources</option>
          {sources.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
        <button type="button" className="btn" onClick={() => downloadCsv(filteredRows, payouts)} disabled={filteredRows.length === 0}>
          Export CSV
        </button>
      </div>

      {loading ? <p className="loading-state">Loading referrals...</p> : null}
      {error ? <div className="settings-card"><p className="auth-message auth-message-error">{error}</p></div> : null}
      {!loading && !error && filteredRows.length === 0 ? <div className="settings-card"><p className="muted">No referral signups found yet.</p></div> : null}

      {grouped.map(([referrer, signups]) => (
        <section key={referrer} className="settings-card">
          <div className="job-financials-head">
            <div>
              <h3>{referrer}</h3>
              <p className="muted">{signups.length} signup{signups.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="finance-list">
            {signups.map((row) => {
              const payout = payouts[row.id] || { status: 'Unpaid', amount: '', paidAt: '', notes: '' };
              return (
                <div key={row.id} className="finance-list-card">
                  <div>
                    <strong>{row.business_name || row.full_name || row.email || 'Signup'}</strong>
                    <p className="muted">{row.email || 'No email'} · Signed up {formatDate(row.created_at)}</p>
                    <p className="muted">Source: {row.referral_source || 'Unknown'} · Detail: {row.referral_detail || row.referred_by || 'None'}</p>
                  </div>
                  <div className="finance-form-block compact-finance-form" style={{ minWidth: 260 }}>
                    <label>Payout status</label>
                    <select className="input" value={payout.status} onChange={(e) => updatePayout(row.id, { status: e.target.value as PayoutStatus })}>
                      <option value="Unpaid">Unpaid</option>
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                    </select>
                    <label>Referral amount</label>
                    <input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={payout.amount} onChange={(e) => updatePayout(row.id, { amount: e.target.value })} />
                    <label>Payout date</label>
                    <input className="input" type="date" value={payout.paidAt} onChange={(e) => updatePayout(row.id, { paidAt: e.target.value })} />
                    <label>Notes</label>
                    <input className="input" placeholder="Payment note or Zelle reference" value={payout.notes} onChange={(e) => updatePayout(row.id, { notes: e.target.value })} />
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
