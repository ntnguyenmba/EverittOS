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
  const [pipelineStage, setPipelineStage] = useState(initial.pipelineStage);
  const [assignedTo, setAssignedTo] = useState(initial.assignedTo);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [converting, setConverting] = useState(false);

  async function patchLead(body: Record<string, unknown>, fallback = 'Unable to save lead.') {
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

  async function saveLead() {
    if (!canManage || saving) return;
    if (!displayName.trim()) {
      appFeedback.error('Name is required.');
      return;
    }

    setSaving(true);
    const ok = await patchLead({
      displayName,
      phone,
      email,
      address,
      notes,
      assigned_to: assignedTo || null,
      lead_source: leadSource,
      pipeline_stage: pipelineStage,
      record_type: 'lead'
    });
    setSaving(false);

    if (!ok) return;
    appFeedback.saved();
    onSaved?.();
  }

  async function convertToCustomer() {
    if (!canManage || converting) return;
    if (!window.confirm('Convert this lead to a customer?')) return;
    setConverting(true);
    const ok = await patchLead({ record_type: 'customer', pipeline_stage: 'active' }, 'Unable to convert lead.');
    setConverting(false);
    if (!ok) return;
    appFeedback.saved();
    router.push(`/customers/${leadId}`);
  }

  async function setLeadStage(nextStage: string) {
    if (!canManage || converting) return;
    setConverting(true);
    const ok = await patchLead({ record_type: 'lead', pipeline_stage: nextStage }, 'Unable to update lead status.');
    setConverting(false);
    if (!ok) return;
    setPipelineStage(nextStage);
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
        <p><strong>Phone:</strong> {phone || 'Not set'}</p>
        <p><strong>Email:</strong> {email || 'Not set'}</p>
        <p><strong>Address:</strong> {address || 'Not set'}</p>
        <p><strong>Source:</strong> {LEAD_SOURCE_OPTIONS.find((o) => o.value === leadSource)?.label || leadSource}</p>
        <p><strong>Status:</strong> {LEAD_PIPELINE_STAGES.find((s) => s.value === pipelineStage)?.label || pipelineStage}</p>
        {notes ? <p><strong>Notes:</strong> {notes}</p> : null}
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
      <label>Address</label>
      <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
      <label>Assign to</label>
      <select className="input" value={assignedTo} disabled={teamOptionsLoading} onChange={(e) => setAssignedTo(e.target.value)}>
        <option value="">Unassigned</option>
        {teamOptions.map((member) => (
          <option key={member.userId} value={member.userId}>{member.label} - {member.role}</option>
        ))}
      </select>
      <label>Lead source</label>
      <select className="input" value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
        {LEAD_SOURCE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <label>Status</label>
      <select className="input" value={pipelineStage} onChange={(e) => setPipelineStage(e.target.value)}>
        {LEAD_PIPELINE_STAGES.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <label>Notes</label>
      <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="inline-actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveLead()}>{saving ? FEEDBACK.loading : 'Save lead'}</button>
        <button type="button" className="btn" disabled={converting} onClick={() => void convertToCustomer()}>{converting ? FEEDBACK.loading : 'Convert to customer'}</button>
        <button type="button" className="btn" disabled={converting} onClick={() => void setLeadStage('reopened')}>Reopen</button>
        <button type="button" className="btn" disabled={converting} onClick={() => void setLeadStage('closed_lost')}>Close lost</button>
        <button type="button" className="btn" disabled={converting} onClick={() => void setLeadStage('cancelled')}>Cancel</button>
        <button type="button" className="btn btn-danger" disabled={removing} onClick={() => void removeLead()}>{removing ? FEEDBACK.loading : 'Remove lead'}</button>
        <Link className="btn" href="/leads">Back to leads</Link>
      </div>
    </div>
  );
}
