'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { WORKSPACE_DELETION_RECOVERY_DAYS } from '@/lib/deletion-policy';
import { formatSettingsCopy, getWorkspaceDeleteCopy } from '@/lib/i18n/settings-copy';

type WorkspaceDeletionPreview = {
  organizationName: string;
  customers: number;
  jobs: number;
  leads: number;
  invoices: number;
  bookings: number;
  files: number;
  teamMembers: number;
  hasActivePaidSubscription: boolean;
  scheduledForDeletion: boolean;
  deletionScheduledAt: string | null;
};

type WorkspaceDeleteSectionProps = {
  canManage: boolean;
};

export function WorkspaceDeleteSection({ canManage }: WorkspaceDeleteSectionProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { locale } = useTranslation();
  const c = getWorkspaceDeleteCopy(locale);
  const [preview, setPreview] = useState<WorkspaceDeletionPreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    void (async () => {
      const res = await fetch('/api/workspace/deletion-preview', { cache: 'no-store' });
      const json = (await res.json().catch(() => ({}))) as WorkspaceDeletionPreview & { error?: string };
      if (res.ok) setPreview(json);
    })();
  }, [canManage]);

  async function loadPreview() {
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/workspace/deletion-preview', { cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as WorkspaceDeletionPreview & { error?: string };
    setBusy(false);

    if (!res.ok) {
      setMessage(json.error || c.loadError);
      return;
    }

    setPreview(json);
    setConfirmation('');
    dialogRef.current?.showModal();
  }

  async function deleteWorkspace() {
    if (!preview || busy) return;
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/workspace/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceName: confirmation,
        cancelSubscription: preview.hasActivePaidSubscription
      })
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setMessage(json.error || c.deleteError);
      return;
    }

    dialogRef.current?.close();
    setPreview({ ...preview, scheduledForDeletion: true, deletionScheduledAt: json.deletionScheduledAt || null });
    setMessage(c.scheduledSuccess);
  }

  async function restoreWorkspace() {
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/workspace/restore', { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setMessage(json.error || c.restoreError);
      return;
    }

    setPreview((current) =>
      current
        ? { ...current, scheduledForDeletion: false, deletionScheduledAt: null }
        : current
    );
    setMessage(c.restoredSuccess);
  }

  if (!canManage) return null;

  const reviewParts = c.reviewRemoved.split('{name}');

  return (
    <details className="settings-card settings-danger-zone">
      <summary><strong>{c.title}</strong></summary>
      <div style={{ marginTop: 14 }}>
        {preview?.scheduledForDeletion ? (
          <>
            <p className="settings-warning">{c.scheduled}</p>
            <p className="muted">
              {formatSettingsCopy(c.restoreWithin, { days: WORKSPACE_DELETION_RECOVERY_DAYS })}
              {preview.deletionScheduledAt
                ? formatSettingsCopy(c.beforeDate, {
                    date: new Date(preview.deletionScheduledAt).toLocaleDateString()
                  })
                : ''}
              .
            </p>
            <div className="settings-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void restoreWorkspace()}>
                {c.restoreCompany}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              {formatSettingsCopy(c.deletesAfter, { days: WORKSPACE_DELETION_RECOVERY_DAYS })}
            </p>
            {preview?.hasActivePaidSubscription ? (
              <p className="settings-warning">{c.cancelSubscriptionFirst}</p>
            ) : null}
            <div className="settings-actions">
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void loadPreview()}>
                {c.deleteCompany}
              </button>
            </div>
          </>
        )}

        {message ? <p className="auth-message">{message}</p> : null}
      </div>

      <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="delete-workspace-title">
        <form method="dialog" className="confirm-dialog-body" onSubmit={(event) => event.preventDefault()}>
          <h3 id="delete-workspace-title">{c.confirmTitle}</h3>
          {preview ? (
            <>
              <p className="muted">
                {reviewParts[0]}
                <strong>{preview.organizationName}</strong>
                {reviewParts[1] ?? ''}
              </p>
              <ul className="settings-danger-list muted">
                <li>{preview.customers} {c.customers}</li>
                <li>{preview.jobs} {c.jobs}</li>
                <li>{preview.leads} {c.leads}</li>
                <li>{preview.invoices} {c.invoices}</li>
                <li>{preview.bookings} {c.bookings}</li>
                <li>{preview.files} {c.files}</li>
                <li>{preview.teamMembers} {c.teamMembers}</li>
              </ul>
              <label className="settings-field">
                <span>{c.typeName}</span>
                <input
                  className="input"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder={preview.organizationName}
                  autoComplete="off"
                />
              </label>
            </>
          ) : null}
          {message ? <p className="auth-message auth-message-error">{message}</p> : null}
          <div className="confirm-dialog-actions">
            <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
              {c.cancel}
            </button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void deleteWorkspace()}>
              {c.scheduleDeletion}
            </button>
          </div>
        </form>
      </dialog>
    </details>
  );
}
