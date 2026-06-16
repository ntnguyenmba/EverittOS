'use client';

import { useRef, useState } from 'react';
import { ACCOUNT_DELETION_CONFIRMATION, ACCOUNT_DELETION_RECOVERY_DAYS } from '@/lib/deletion-policy';

type AccountDeleteSectionProps = {
  busy: boolean;
  onDeleted: () => void;
  onRestored: () => void;
  scheduledForDeletion: boolean;
  deletionScheduledAt: string | null;
};

export function AccountDeleteSection({
  busy,
  onDeleted,
  onRestored,
  scheduledForDeletion,
  deletionScheduledAt
}: AccountDeleteSectionProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [localBusy, setLocalBusy] = useState(false);

  function openDialog() {
    setPassword('');
    setConfirmation('');
    setMessage('');
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  async function deleteAccount() {
    if (localBusy || busy) return;
    setLocalBusy(true);
    setMessage('');
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, confirmation })
    });
    const json = await res.json().catch(() => ({}));
    setLocalBusy(false);

    if (!res.ok) {
      setMessage(json.error || 'Unable to delete account.');
      return;
    }

    closeDialog();
    onDeleted();
    window.location.href = `/login?reason=deleted&detail=${encodeURIComponent('Your account is scheduled for deletion.')}`;
  }

  async function restoreAccount() {
    if (localBusy || busy) return;
    setLocalBusy(true);
    setMessage('');
    const res = await fetch('/api/account/restore', { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    setLocalBusy(false);

    if (!res.ok) {
      setMessage(json.error || 'Unable to restore account.');
      return;
    }

    onRestored();
    setMessage('Your account has been restored.');
  }

  return (
    <section className="settings-card settings-danger-zone">
      <h3>Delete account</h3>
      {scheduledForDeletion ? (
        <>
          <p className="settings-warning">
            This account is scheduled for deletion
            {deletionScheduledAt ? ` on ${new Date(deletionScheduledAt).toLocaleDateString()}` : ''}.
          </p>
          <p className="muted">
            You can restore your account during the {ACCOUNT_DELETION_RECOVERY_DAYS}-day recovery window.
          </p>
          <div className="settings-actions">
            <button type="button" className="btn btn-primary" disabled={localBusy || busy} onClick={() => void restoreAccount()}>
              Restore account
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            Permanently remove your personal account, profile, notification history, and personal settings. Workspace
            data is kept unless you delete the workspace separately.
          </p>
          <ul className="settings-danger-list muted">
            <li>Your sign-in and profile</li>
            <li>Personal notification preferences and inbox</li>
            <li>Personal settings and sessions</li>
          </ul>
          <p className="muted">
            After confirmation, your account enters a {ACCOUNT_DELETION_RECOVERY_DAYS}-day recovery window before
            permanent removal.
          </p>
          <div className="settings-actions">
            <button type="button" className="btn btn-danger" disabled={localBusy || busy} onClick={openDialog}>
              Delete account
            </button>
          </div>
        </>
      )}

      {message ? <p className="auth-message">{message}</p> : null}

      <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="delete-account-title">
        <form method="dialog" className="confirm-dialog-body" onSubmit={(event) => event.preventDefault()}>
          <h3 id="delete-account-title">Delete your account?</h3>
          <p className="muted">
            This signs you out immediately and schedules your account for deletion. Type{' '}
            <strong>{ACCOUNT_DELETION_CONFIRMATION}</strong> and enter your password to continue.
          </p>
          <label className="settings-field">
            <span>Type {ACCOUNT_DELETION_CONFIRMATION}</span>
            <input
              className="input"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="settings-field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {message ? <p className="auth-message auth-message-error">{message}</p> : null}
          <div className="confirm-dialog-actions">
            <button type="button" className="btn" onClick={closeDialog}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" disabled={localBusy} onClick={() => void deleteAccount()}>
              Delete account
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
