'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { CustomerImportRow, DuplicateDecision } from '@/lib/customer-import';

type PreviewSummary = {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
};

export default function CustomerImportPage() {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [csv, setCsv] = useState('');
  const [rows, setRows] = useState<CustomerImportRow[]>([]);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [decisions, setDecisions] = useState<Record<string, DuplicateDecision>>({});
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/customers/import');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));
      if (!isManagerRole(normalizeRole(profile?.role))) {
        appFeedback.error('Only managers can import customers.');
        router.push('/customers');
      }
    }
    void load();
  }, [appFeedback, router]);

  async function previewImport() {
    setLoading(true);
    setImportResult(null);
    const res = await fetch('/api/customers/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv, preview: true })
    });
    const json = (await res.json().catch(() => ({}))) as {
      rows?: CustomerImportRow[];
      summary?: PreviewSummary;
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to preview import.');
      return;
    }
    setRows(json.rows || []);
    setSummary(json.summary || null);
    const nextDecisions: Record<string, DuplicateDecision> = {};
    for (const row of json.rows || []) {
      if (row.duplicateOfCustomerId) nextDecisions[String(row.rowNumber)] = 'skip';
    }
    setDecisions(nextDecisions);
  }

  async function commitImport() {
    setLoading(true);
    setImportResult(null);
    const res = await fetch('/api/customers/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv, preview: false, decisions })
    });
    const json = (await res.json().catch(() => ({}))) as {
      summary?: {
        createdCustomers: number;
        mergedCustomers: number;
        createdProperties: number;
        skipped: number;
        failed: number;
      };
      failed?: Array<{ rowNumber: number; error: string }>;
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Import failed.');
      return;
    }
    const result = json.summary
      ? `Created ${json.summary.createdCustomers} customers, merged ${json.summary.mergedCustomers}, created ${json.summary.createdProperties} properties, skipped ${json.summary.skipped}, failed ${json.summary.failed}.`
      : 'Import finished.';
    setImportResult(result);
    appFeedback.success(result);
  }

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader
        title="Import customers"
        subtitle="Upload a CSV of customers and properties. Preview first, then choose how to handle duplicates."
        action={
          <Link className="btn" href="/customers">
            Back to customers
          </Link>
        }
      />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="button-row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              window.location.href = '/api/customers/import';
            }}
          >
            Download CSV template
          </button>
        </div>
        <label htmlFor="customer-import-csv">Paste CSV or upload</label>
        <input
          className="input"
          type="file"
          accept=".csv,text/csv"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 2_000_000) {
              appFeedback.error('CSV must be under 2MB.');
              return;
            }
            setCsv(await file.text());
          }}
        />
        <textarea
          id="customer-import-csv"
          className="input"
          rows={10}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="customer_name,company,email,phone,property_name,property_type,address,city,state,zip,country,notes"
          style={{ marginTop: 10 }}
        />
        <div className="button-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary" disabled={loading || !csv.trim()} onClick={() => void previewImport()}>
            {loading ? 'Working…' : 'Preview import'}
          </button>
          {rows.length > 0 ? (
            <button type="button" className="btn" disabled={loading} onClick={() => void commitImport()}>
              Confirm import
            </button>
          ) : null}
        </div>
        {summary ? (
          <p className="muted" style={{ marginTop: 12 }}>
            {summary.total} rows · {summary.valid} valid · {summary.invalid} with errors · {summary.duplicates} likely duplicates
          </p>
        ) : null}
        {importResult ? <p style={{ marginTop: 12 }}>{importResult}</p> : null}
      </div>

      {rows.length > 0 ? (
        <div className="card">
          <h3>Preview</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Customer</th>
                  <th>Property</th>
                  <th>Issues</th>
                  <th>Duplicate action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>
                      <strong>{row.customerName}</strong>
                      <div className="muted">{[row.email, row.phone].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td>
                      {row.propertyName || '—'}
                      <div className="muted">{[row.address, row.city, row.state, row.zip].filter(Boolean).join(', ')}</div>
                    </td>
                    <td>
                      {row.errors.length ? row.errors.join(' ') : 'OK'}
                      {row.duplicateReason ? <div className="muted">{row.duplicateReason}</div> : null}
                    </td>
                    <td>
                      {row.duplicateOfCustomerId ? (
                        <select
                          className="input"
                          value={decisions[String(row.rowNumber)] || 'skip'}
                          onChange={(e) =>
                            setDecisions((current) => ({
                              ...current,
                              [String(row.rowNumber)]: e.target.value as DuplicateDecision
                            }))
                          }
                        >
                          <option value="skip">Skip</option>
                          <option value="merge">Merge</option>
                          <option value="create">Create anyway</option>
                        </select>
                      ) : (
                        'Create'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
