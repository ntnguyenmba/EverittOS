'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/deletion-policy';
import { performClientLogout } from '@/lib/client-logout';
import { canManageBilling, isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';

type AccountDeleteSectionProps = {
  hasActiveSubscription: boolean;
  busy?: boolean;
  role?: UserRole | string | null;
  retentionNote?: string;
};

export function AccountDeleteSection({
  hasActiveSubscription,
  busy = false,
  role: roleInput,
  retentionNote
}: AccountDeleteSectionProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [localBusy, setLocalBusy] = useState(false);
  const role = normalizeRole(roleInput || 'employee');
  const showBillingLink = canManageBilling(role) && hasActiveSubscription;

  const confirmationOk = confirmation.trim() === ACCOUNT_DELETION_CONFIRMATION;
  const deleteDisabled = localBusy || busy || hasActiveSubscription || !confirmationOk;

  const defaultRetention =
    isContractorRole(role) || isClientRole(role)
      ? t('portal.account.delete.defaultPortalRetention')
      : t('portal.account.delete.defaultOwnerRetention');

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
        setMessage(json.error || t('portal.account.delete.unableToDelete'));
        setLocalBusy(false);
        return;
      }

      closeDialog();
      await performClientLogout();
      window.location.href = '/login?deleted=1';
    } catch {
      setMessage(t('portal.account.delete.unableToDeleteRetry'));
      setLocalBusy(false);
    }
  }

  return (
    <section className="settings-card settings-danger-zone">
      <h3>{t('portal.account.delete.dangerZone')}</h3>

      <div className="settings-danger-block">
        <h4>{t('portal.account.delete.deleteAccount')}</h4>
        <p className="muted">{retentionNote || defaultRetention}</p>
        <p className="muted">{t('portal.account.delete.subscriptionWarning')}</p>

        {hasActiveSubscription ? (
          <div className="settings-warning" role="alert">
            <p>{t('portal.account.delete.activeSubscription')}</p>
            {showBillingLink ? (
              <Link href="/settings/billing" className="btn">
                {t('portal.account.delete.goToBilling')}
              </Link>
            ) : (
              <p className="muted">{t('portal.account.delete.askOwnerCancel')}</p>
            )}
          </div>
        ) : (
          <div className="settings-actions">
            <button type="button" className="btn btn-danger" disabled={localBusy || busy} onClick={openDialog}>
              {t('portal.account.delete.deleteMyAccount')}
            </button>
          </div>
        )}
      </div>

      {message && !dialogRef.current?.open ? <p className="auth-message auth-message-error">{message}</p> : null}

      <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="delete-account-title">
        <form method="dialog" className="confirm-dialog-body" onSubmit={(event) => event.preventDefault()}>
          <h3 id="delete-account-title">{t('portal.account.delete.confirmTitle')}</h3>
          <p className="muted">{t('portal.account.delete.confirmBody')}</p>
          <label className="settings-field">
            <span>{t('portal.account.delete.typeToConfirm')}</span>
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
              {t('portal.account.delete.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={deleteDisabled}
              onClick={() => void deleteAccount()}
            >
              {localBusy ? t('portal.account.delete.deleting') : t('portal.account.delete.permanentlyDelete')}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
