'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import {
  browserSupportsPasskeys,
  deletePasskey,
  listPasskeys,
  passkeyApiEnabled,
  registerPasskey,
  type PasskeyRecord
} from '@/lib/passkey-auth';
import { formatUiChromeCopy, getPasskeyManagerCopy } from '@/lib/i18n/ui-chrome-copy';

export function PasskeyManager() {
  const { locale } = useTranslation();
  const c = getPasskeyManagerCopy(locale);
  const [supported, setSupported] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    const { passkeys: rows, error: listError } = await listPasskeys();
    setPasskeys(rows);
    setError(listError || '');
    setLoading(false);
  }, []);

  useEffect(() => {
    const ok = browserSupportsPasskeys() && passkeyApiEnabled();
    setSupported(ok);
    if (ok) void refresh();
    else setLoading(false);
  }, [refresh]);

  async function addPasskey() {
    setBusy(true);
    setMessage('');
    setError('');
    const result = await registerPasskey();
    setBusy(false);
    if (!result.ok) {
      setError(result.error || c.addError);
      return;
    }
    setMessage(c.added);
    await refresh();
  }

  async function removePasskey(passkeyId: string) {
    if (!window.confirm(c.removeConfirm)) return;
    setBusy(true);
    setMessage('');
    setError('');
    const result = await deletePasskey(passkeyId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || c.removeError);
      return;
    }
    setMessage(c.removed);
    await refresh();
  }

  if (!supported) {
    return <p className="muted">{c.unavailable}</p>;
  }

  return (
    <div className="passkey-manager">
      <p className="muted">{c.description}</p>
      <div className="settings-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void addPasskey()}>
          {busy ? c.working : c.add}
        </button>
      </div>
      {loading ? <p className="muted">{c.loading}</p> : null}
      {!loading && passkeys.length === 0 ? <p className="muted">{c.empty}</p> : null}
      {!loading
        ? passkeys.map((row) => (
            <div key={row.id} className="list-row compact passkey-row">
              <div>
                <strong>{row.friendly_name || c.defaultName}</strong>
                {row.created_at ? (
                  <p className="muted">
                    {formatUiChromeCopy(c.addedOn, { date: new Date(row.created_at).toLocaleDateString() })}
                  </p>
                ) : null}
              </div>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void removePasskey(row.id)}>
                {c.remove}
              </button>
            </div>
          ))
        : null}
      {message ? <p className="auth-message auth-message-success">{message}</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}
    </div>
  );
}
