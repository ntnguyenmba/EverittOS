'use client';

import { useEffect, useRef, useState } from 'react';
import { WORKSPACE_DELETION_RECOVERY_DAYS } from '@/lib/deletion-policy';

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
      setMessage(json.error || 'Unable to load company deletion details.');
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
      setMessage(json.error || 'Unable to delete company.');
      return;
    }

    dialogRef.current?.close();
    setPreview({ ...preview, scheduledForDeletion: true, deletionScheduledAt: json.deletionScheduledAt || null });
    setMessage('This company is scheduled for deletion.');
  }

  async function restoreWorkspace() {
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/workspace/restore', { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setMessage(json.error || 'Unable to restore company.');
      return;
    }

    setPreview((current) =>
      current
        ? { ...current, scheduledForDeletion: false, deletionScheduledAt: null }
        : current
    );
    setMessage('Company deletion canceled. Your company has been restored.');
  }

  if (!canManage) return null;

  return (
    <section className="settings-card settings-danger-zone">
      <h3>Delete company</h3>
      {preview?.scheduledForDeletion ? (
        <>
          <p className="settings-warning">This company is scheduled for deletion.</p>
          <p className="muted">
            You can restore it during the {WORKSPACE_DELETION_RECOVERY_DAYS}-day recovery window
            {preview.deletionScheduledAt
              ? ` before ${new Date(preview.deletionScheduledAt).toLocaleDateString()}`
              : ''}
            .
          </p>
          <div className="settings-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void restoreWorkspace()}>
              Restore company
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            Permanently remove this company and its customers, jobs, bookings, files, templates, and team access
            after a {WORKSPACE_DELETION_RECOVERY_DAYS}-day recovery window.
          </p>
          {preview?.hasActivePaidSubscription ? (
            <p className="settings-warning">
              An active subscription will be canceled through Stripe before deletion is scheduled.
            </p>
          ) : null}
          <div className="settings-actions">
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void loadPreview()}>
              Delete company
            </button>
          </div>
        </>
      )}

      {message ? <p className="auth-message">{message}</p> : null}

      <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby="delete-workspace-title">
        <form method="dialog" className="confirm-dialog-body" onSubmit={(event) => event.preventDefault()}>
          <h3 id="delete-workspace-title">Delete company?</h3>
          {preview ? (
            <>
              <p className="muted">
                This will schedule <strong>{preview.organizationName}</strong> for deletion. Review what will be
                removed:
              </p>
              <ul className="settings-danger-list muted">
                <li>{preview.customers} customers</li>
                <li>{preview.jobs} jobs</li>
                <li>{preview.leads} leads</li>
                <li>{preview.invoices} invoices</li>
                <li>{preview.bookings} bookings</li>
                <li>{preview.files} uploaded files</li>
                <li>{preview.teamMembers} team members</li>
              </ul>
              <label className="settings-field">
                <span>Type the company name to continue</span>
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
              Cancel
            </button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void deleteWorkspace()}>
              Schedule deletion
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
