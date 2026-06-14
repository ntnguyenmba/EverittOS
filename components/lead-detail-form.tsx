'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { LEAD_PIPELINE_STAGES } from '@/lib/lead-pipeline';
import { LEAD_SOURCE_OPTIONS } from '@/lib/lead-sources';

type LeadDetailFormProps = {
  leadId: string;
  initial: {
    displayName: string;
    phone: string;
    email: string;
    notes: string;
    leadSource: string;
    pipelineStage: string;
  };
  canManage: boolean;
  onSaved?: () => void;
};

export function LeadDetailForm({ leadId, initial, canManage, onSaved }: LeadDetailFormProps) {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [notes, setNotes] = useState(initial.notes);
  const [leadSource, setLeadSource] = useState(initial.leadSource);
  const [pipelineStage, setPipelineStage] = useState(initial.pipelineStage);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function saveLead() {
    if (!canManage || saving) return;
    if (!displayName.trim()) {
      appFeedback.error('Name is required.');
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/customers/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        phone,
        email,
        notes,
        lead_source: leadSource,
        pipeline_stage: pipelineStage,
        record_type: 'lead'
      })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to save lead.');
      return;
    }

    appFeedback.saved();
    onSaved?.();
  }

  async function removeLead() {
    if (!canManage || removing) return;
    if (!window.confirm(`Remove lead ${displayName || 'this contact'}?`)) return;

    setRemoving(true);
    const res = await fetch(`/api/customers/${leadId}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setRemoving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to remove lead.');
      return;
    }

    appFeedback.label('removed');
    router.push('/leads');
  }

  if (!canManage) {
    return (
      <div className="card">
        <h3>{displayName || 'Lead'}</h3>
        <p>
          <strong>Phone:</strong> {phone || 'Not set'}
        </p>
        <p>
          <strong>Email:</strong> {email || 'Not set'}
        </p>
        <p>
          <strong>Source:</strong> {LEAD_SOURCE_OPTIONS.find((o) => o.value === leadSource)?.label || leadSource}
        </p>
        <p>
          <strong>Status:</strong> {LEAD_PIPELINE_STAGES.find((s) => s.value === pipelineStage)?.label || pipelineStage}
        </p>
        {notes ? (
          <p>
            <strong>Notes:</strong> {notes}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card form">
      <h3 className="card-title-sm">Lead details</h3>
      <label>Name</label>
      <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <label>Phone</label>
      <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <label>Email</label>
      <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label>Lead source</label>
      <select className="input" value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
        {LEAD_SOURCE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <label>Status</label>
      <select className="input" value={pipelineStage} onChange={(e) => setPipelineStage(e.target.value)}>
        {LEAD_PIPELINE_STAGES.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <label>Notes</label>
      <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="inline-actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveLead()}>
          {saving ? FEEDBACK.loading : 'Save lead'}
        </button>
        <button type="button" className="btn btn-danger" disabled={removing} onClick={() => void removeLead()}>
          {removing ? FEEDBACK.loading : 'Remove lead'}
        </button>
        <Link className="btn" href="/leads">
          Back to leads
        </Link>
      </div>
    </div>
  );
}
