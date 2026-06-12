'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  browserSupportsPasskeys,
  deletePasskey,
  listPasskeys,
  passkeyApiEnabled,
  registerPasskey,
  type PasskeyRecord
} from '@/lib/passkey-auth';

export function PasskeyManager() {
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
      setError(result.error || 'Unable to add passkey.');
      return;
    }
    setMessage('Passkey added.');
    await refresh();
  }

  async function removePasskey(passkeyId: string) {
    if (!window.confirm('Remove this passkey? You can add a new one later.')) return;
    setBusy(true);
    setMessage('');
    setError('');
    const result = await deletePasskey(passkeyId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || 'Unable to remove passkey.');
      return;
    }
    setMessage('Passkey removed.');
    await refresh();
  }

  if (!supported) {
    return (
      <p className="muted">
        Passkeys are not available in this browser or project. Enable passkeys in Supabase Authentication settings,
        then reload this page.
      </p>
    );
  }

  return (
    <div className="passkey-manager">
      <p className="muted">
        Passkeys let you sign in with Face ID, Touch ID, Windows Hello, or a security key. They stay on your device.
      </p>
      <div className="settings-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void addPasskey()}>
          {busy ? 'Working…' : 'Add passkey'}
        </button>
      </div>
      {loading ? <p className="muted">Loading passkeys…</p> : null}
      {!loading && passkeys.length === 0 ? <p className="muted">No passkeys on this account yet.</p> : null}
      {!loading
        ? passkeys.map((row) => (
            <div key={row.id} className="list-row compact passkey-row">
              <div>
                <strong>{row.friendly_name || 'Passkey'}</strong>
                {row.created_at ? (
                  <p className="muted">Added {new Date(row.created_at).toLocaleDateString()}</p>
                ) : null}
              </div>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void removePasskey(row.id)}>
                Remove
              </button>
            </div>
          ))
        : null}
      {message ? <p className="auth-message auth-message-success">{message}</p> : null}
      {error ? <p className="auth-message auth-message-error">{error}</p> : null}
    </div>
  );
}
