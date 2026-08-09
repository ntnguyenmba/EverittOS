'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { getCreateCompanyCopy } from '@/lib/i18n/ui-chrome-copy';

type CreateCompanyCardProps = {
  variant: 'client' | 'contractor';
};

type Membership = {
  isOwner?: boolean;
};

export function CreateCompanyCard({ variant: _variant }: CreateCompanyCardProps) {
  const { locale, t } = useTranslation();
  const c = getCreateCompanyCopy(locale);
  const [companyName, setCompanyName] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkingCompany, setCheckingCompany] = useState(true);
  const [hasOwnedCompany, setHasOwnedCompany] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkOwnedCompany() {
      try {
        const response = await fetch('/api/org/memberships', { cache: 'no-store' });
        if (!response.ok) return;
        const result = (await response.json().catch(() => ({}))) as { memberships?: Membership[] };
        if (!cancelled) {
          setHasOwnedCompany(Boolean(result.memberships?.some((membership) => membership.isOwner)));
        }
      } finally {
        if (!cancelled) setCheckingCompany(false);
      }
    }

    void checkOwnedCompany();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createCompany() {
    if (busy) return;
    const name = companyName.trim();
    if (name.length < 2) {
      setError(c.nameRequired);
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
      setError(result.error || c.createError);
      setBusy(false);
      return;
    }

    window.location.assign('/dashboard');
  }

  if (checkingCompany || hasOwnedCompany) return null;

  return (
    <div className="settings-card">
      <p className="muted" style={{ marginBottom: 4 }}>{t('ux.appName')}</p>
      <h3>{c.title}</h3>
      <p className="muted">{c.body}</p>

      {!open ? (
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          {c.create}
        </button>
      ) : (
        <div className="form" style={{ marginTop: 12 }}>
          <label className="settings-field">
            <span>{c.nameLabel}</span>
            <input
              className="input"
              value={companyName}
              maxLength={120}
              autoComplete="organization"
              placeholder={c.namePlaceholder}
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
              {busy ? c.creating : c.create}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </button>
          </div>
          {error ? <p className="auth-message auth-message-error">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
