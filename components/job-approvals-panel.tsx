'use client';

import { useCallback, useEffect, useState } from 'react';

type Approval = {
  id: string;
  approval_type: string;
  status: string;
  response_note: string | null;
  created_at: string | null;
};

type JobApprovalsPanelProps = {
  jobId: string;
  canManage?: boolean;
  isClient?: boolean;
};

export function JobApprovalsPanel({ jobId, canManage = false, isClient = false }: JobApprovalsPanelProps) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/job-approvals?jobId=${encodeURIComponent(jobId)}`);
    const json = await res.json();
    setLoading(false);
    if (res.ok) setApprovals(json.approvals || []);
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestApproval(approvalType: 'quote' | 'completion') {
    if (busy) return;
    setBusy(true);
    await fetch('/api/job-approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, approvalType })
    });
    setBusy(false);
    void load();
  }

  async function respond(id: string, status: 'approved' | 'rejected') {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/job-approvals/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note })
    });
    setBusy(false);
    setNote('');
    void load();
  }

  return (
    <div className="card settings-card" style={{ marginTop: 16 }}>
      <h3>Approvals</h3>
      {loading ? <p className="loading-state">Loading approvals…</p> : null}
      {approvals.map((approval) => (
        <div key={approval.id} className="list-row">
          <strong>
            {approval.approval_type} · {approval.status}
          </strong>
          {approval.response_note ? <p className="muted">{approval.response_note}</p> : null}
          {isClient && approval.status === 'pending' ? (
            <div className="inline-actions">
              <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
              <button type="button" className="btn btn-primary" onClick={() => void respond(approval.id, 'approved')} disabled={busy}>
                Approve
              </button>
              <button type="button" className="btn" onClick={() => void respond(approval.id, 'rejected')} disabled={busy}>
                Reject
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {canManage ? (
        <div className="inline-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => void requestApproval('quote')} disabled={busy}>
            Request quote approval
          </button>
          <button type="button" className="btn" onClick={() => void requestApproval('completion')} disabled={busy}>
            Request completion approval
          </button>
        </div>
      ) : null}
    </div>
  );
}
