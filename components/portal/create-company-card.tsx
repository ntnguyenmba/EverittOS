'use client';

import { useState } from 'react';

type CreateCompanyCardProps = {
  variant: 'client' | 'contractor';
};

export function CreateCompanyCard({ variant }: CreateCompanyCardProps) {
  const [companyName, setCompanyName] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function createCompany() {
    if (busy) return;
    const name = companyName.trim();
    if (name.length < 2) {
      setError('Enter your company name.');
      return;
    }

    setBusy(true);
    setError('');
    const response = await fetch('/api/org/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: name })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || 'Could not create your company.');
      setBusy(false);
      return;
    }

    window.location.assign('/dashboard');
  }

  return (
    <div className="settings-card">
      <p className="muted" style={{ marginBottom: 4 }}>EverittOS for your business</p>
      <h3>Run your own company</h3>
      <p className="muted">
        {variant === 'contractor'
          ? 'Ready to take your own customers? Create a company with this same login and keep receiving assigned work.'
          : 'Manage your own customers, jobs, team, invoices, and reports with this same login.'}
      </p>

      {!open ? (
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          Create my company
        </button>
      ) : (
        <div className="form" style={{ marginTop: 12 }}>
          <label className="settings-field">
            <span>Company name</span>
            <input
              className="input"
              value={companyName}
              maxLength={120}
              autoComplete="organization"
              placeholder="Your company name"
              onChange={(event) => setCompanyName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void createCompany();
                }
              }}
            />
          </label>
          <div className="button-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createCompany()}>
              {busy ? 'Creating company...' : 'Create company'}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          {error ? <p className="auth-message auth-message-error">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
