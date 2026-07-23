'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { LEAD_PIPELINE_STAGES } from '@/lib/lead-pipeline';
import { LEAD_SOURCE_OPTIONS } from '@/lib/lead-sources';
import { useTeamOptions } from '@/lib/team-options-client';

type LeadDetailFormProps = {
  leadId: string;
  initial: {
    displayName: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
    leadSource: string;
    pipelineStage: string;
    assignedTo: string;
  };
  canManage: boolean;
  onSaved?: () => void;
};

const EDITABLE_LEAD_STAGES = LEAD_PIPELINE_STAGES;

const SIMPLE_STATUS_LABELS: Record<string, string> = {
  open: 'New',
  contacted: 'Contacted',
  qualified: 'Interested',
  proposal_sent: 'Quote sent',
  negotiation: 'Following up',
  reopened: 'Reopened',
  closed_lost: 'Not booked',
  cancelled: 'Archived'
};

export function LeadDetailForm({ leadId, initial, canManage, onSaved }: LeadDetailFormProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const { teamOptions, teamOptionsLoading } = useTeamOptions();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [address, setAddress] = useState(initial.address);
  const [notes, setNotes] = useState(initial.notes);
  const [leadSource, setLeadSource] = useState(initial.leadSource);
  const [pipelineStage, setPipelineStage] = useState(
    initial.pipelineStage === 'won' ? 'open' : initial.pipelineStage
  );
  const [assignedTo, setAssignedTo] = useState(initial.assignedTo);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [converting, setConverting] = useState(false);

  async function patchLead(body: Record<string, unknown>, fallback = 'Unable to save request.') {
    const res = await fetch(`/api/customers/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!res.ok) {
      appFeedback.error(json.error || fallback);
      return false;
    }
    return true;
  }

  function editableFields() {
    return {
      displayName: displayName.trim(),
      phone,
      email,
      address,
      notes,
      assigned_to: assignedTo || null,
      lead_source: leadSource
    };
  }

  async function saveLead() {
    if (!canManage || saving || converting) return;
    if (!displayName.trim()) {
      appFeedback.error('Name is required.');
      return;
    }

    setSaving(true);
    const ok = await patchLead({
      ...editableFields(),
      pipeline_stage: pipelineStage,
      record_type: 'lead'
    });
    setSaving(false);

    if (!ok) return;
    appFeedback.saved();
    onSaved?.();
  }

  async function convertToCustomer() {
    if (!canManage || converting || saving) return;
    if (!displayName.trim()) {
      appFeedback.error('Name is required.');
      return;
    }
    if (!window.confirm(`Add ${displayName.trim()} as a customer?`)) return;

    setConverting(true);
    const ok = await patchLead(
      {
        ...editableFields(),
        record_type: 'customer',
        pipeline_stage: 'active'
      },
      'Unable to add customer.'
    );
    setConverting(false);
    if (!ok) return;

    appFeedback.success('Customer added.');
    router.push(`/customers/${leadId}`);
    router.refresh();
  }

  async function setLeadStage(nextStage: string) {
    if (!canManage || converting || saving) return;

    setConverting(true);
    const ok = await patchLead({ record_type: 'lead', pipeline_stage: nextStage }, 'Unable to update request.');
    setConverting(false);
    if (!ok) return;

    setPipelineStage(nextStage);
    appFeedback.saved();
    onSaved?.();
  }

  async function removeLead() {
    if (!canManage || removing) return;
    if (!window.confirm(`Archive ${displayName || 'this request'}?`)) return;

    setRemoving(true);
    const res = await fetch(`/api/customers/${leadId}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setRemoving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to archive request.');
      return;
    }

    appFeedback.success('Request archived.');
    router.push('/leads');
    router.refresh();
  }

  const sourceLabel = LEAD_SOURCE_OPTIONS.find((option) => option.value === leadSource)?.label || leadSource;
  const statusLabel = SIMPLE_STATUS_LABELS[pipelineStage] || pipelineStage;
  const busy = saving || converting || removing;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="card">
        <div className="button-row" style={{ flexWrap: 'wrap' }}>
          {phone ? <a className="btn btn-primary" href={`tel:${phone}`}>Call</a> : null}
          {phone ? <a className="btn" href={`sms:${phone}`}>Text</a> : null}
          {email ? <a className="btn" href={`mailto:${email}`}>Email</a> : null}
          {address ? (
            <a className="btn" href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
              Maps
            </a>
          ) : null}
          {canManage ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void convertToCustomer()}>
              {converting ? FEEDBACK.loading : 'Add as customer'}
            </button>
          ) : null}
        </div>

        <div style={{ marginTop: 16 }}>
          {phone ? <p style={{ marginBottom: 6 }}>{phone}</p> : null}
          {email ? <p style={{ marginBottom: 6 }}>{email}</p> : null}
          {address ? <p style={{ marginBottom: 6 }}>{address}</p> : null}
          <p className="muted" style={{ marginBottom: 0 }}>{sourceLabel} · {statusLabel}</p>
        </div>
      </section>

      {notes ? (
        <section className="card">
          <h3 className="card-title-sm">Notes</h3>
          <p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{notes}</p>
        </section>
      ) : null}

      <details className="card" open={!phone && !email}>
        <summary><strong>{canManage ? 'Edit request' : 'Request details'}</strong></summary>
        <div className="form" style={{ marginTop: 16 }}>
          <label>Name</label>
          <input className="input" value={displayName} disabled={!canManage || busy} onChange={(e) => setDisplayName(e.target.value)} />
          <label>Phone</label>
          <input className="input" type="tel" inputMode="tel" autoComplete="tel" value={phone} disabled={!canManage || busy} onChange={(e) => setPhone(e.target.value)} />
          <label>Email</label>
          <input className="input" type="email" inputMode="email" autoComplete="email" value={email} disabled={!canManage || busy} onChange={(e) => setEmail(e.target.value)} />
          <label>Address</label>
          <input className="input" autoComplete="street-address" value={address} disabled={!canManage || busy} onChange={(e) => setAddress(e.target.value)} />
          <label>Assign to</label>
          <select className="input" value={assignedTo} disabled={!canManage || teamOptionsLoading || busy} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Unassigned</option>
            {teamOptions.map((member) => (
              <option key={member.userId} value={member.userId}>{member.label} - {member.role}</option>
            ))}
          </select>
          <label>How they found you</label>
          <select className="input" value={leadSource} disabled={!canManage || busy} onChange={(e) => setLeadSource(e.target.value)}>
            {LEAD_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <label>Status</label>
          <select className="input" value={pipelineStage} disabled={!canManage || busy} onChange={(e) => setPipelineStage(e.target.value)}>
            {EDITABLE_LEAD_STAGES.map((option) => (
              <option key={option.value} value={option.value}>{SIMPLE_STATUS_LABELS[option.value] || option.label}</option>
            ))}
          </select>
          <label>Notes</label>
          <textarea className="input" rows={3} value={notes} disabled={!canManage || busy} onChange={(e) => setNotes(e.target.value)} />
          {canManage ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveLead()}>
              {saving ? FEEDBACK.loading : 'Save'}
            </button>
          ) : null}
        </div>
      </details>

      {canManage ? (
        <details className="card">
          <summary><strong>More actions</strong></summary>
          <div className="button-row" style={{ marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" className="btn" disabled={busy} onClick={() => void setLeadStage('reopened')}>Reopen</button>
            <button type="button" className="btn" disabled={busy} onClick={() => void setLeadStage('closed_lost')}>Not booked</button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void removeLead()}>
              {removing ? FEEDBACK.loading : 'Archive request'}
            </button>
          </div>
        </details>
      ) : null}

      <Link className="btn" href="/leads">Back to requests</Link>
    </div>
  );
}
