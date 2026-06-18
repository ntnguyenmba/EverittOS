'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/deletion-policy';
import { performClientLogout } from '@/lib/client-logout';

type AccountDeleteSectionProps = {
  hasActiveSubscription: boolean;
  busy?: boolean;
};

export function AccountDeleteSection({ hasActiveSubscription, busy = false }: AccountDeleteSectionProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [localBusy, setLocalBusy] = useState(false);

  const confirmationOk = confirmation.trim() === ACCOUNT_DELETION_CONFIRMATION;
  const deleteDisabled = localBusy || busy || hasActiveSubscription || !confirmationOk;

  function openDialog() {
    if (hasActiveSubscription) return;
    setConfirmation('');
    setMessage('');
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  async function deleteAccount() {
    if (deleteDisabled) return;

    setLocalBusy(true);
    setMessage('');

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: confirmation.trim() })
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(json.error || 'Unable to delete account.');
        setLocalBusy(false);
        return;
      }

      closeDialog();
      await performClientLogout();
      window.location.href = '/login?deleted=1';
    } catch {
      setMessage('Unable to delete account. Please try again.');
      setLocalBusy(false);
    }
  }

  return (
    <section className="settings-card settings-danger-zone">
      <h3>Danger Zone</h3>

      <div className="settings-danger-block">
        <h4>Delete Account</h4>
        <p className="muted">
          Permanently delete your account and associated profile information. This action cannot be undone.
        </p>

        {hasActiveSubscription ? (
          <div className="settings-warning" role="alert">
            <p>Active subscriptions must be cancelled before account deletion.</p>
            <Link href="/settings/billing" className="btn">
              Go to Billing
            </Link>
          </div>
        ) : (
          <div className="settings-actions">
            <button type="button" className="btn btn-danger" disabled={localBusy || busy} onClick={openDialog}>
              Delete My Account
            </button>
          </div>
        )}
      </div>

      {message && !dialogRef.current?.open ? <p className="auth-message auth-message-error">{message}</p> : null}

      <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="delete-account-title">
        <form method="dialog" className="confirm-dialog-body" onSubmit={(event) => event.preventDefault()}>
          <h3 id="delete-account-title">Delete Account</h3>
          <p className="muted">
            Are you sure you want to permanently delete your account? This action cannot be undone and you will lose
            access to your account, profile, saved items, documents, and membership history.
          </p>
          <label className="settings-field">
            <span>
              Type <strong>{ACCOUNT_DELETION_CONFIRMATION}</strong> to confirm
            </span>
            <input
              className="input"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              aria-invalid={confirmation.length > 0 && !confirmationOk}
            />
          </label>
          {message ? <p className="auth-message auth-message-error">{message}</p> : null}
          <div className="confirm-dialog-actions">
            <button type="button" className="btn" onClick={closeDialog}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={deleteDisabled}
              onClick={() => void deleteAccount()}
            >
              {localBusy ? 'Deleting…' : 'Permanently Delete Account'}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
