'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
  sort_order: number;
};

type JobChecklistProps = {
  jobId: string;
  organizationId: string;
  userId: string;
  items: ChecklistItem[];
  canEdit: boolean;
  onChange: () => void;
};

export function JobChecklist({ jobId, organizationId, userId, items, canEdit, onChange }: JobChecklistProps) {
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  async function addItem() {
    if (!label.trim() || !canEdit) return;
    setBusy(true);
    await supabase.from('job_checklist_items').insert({
      job_id: jobId,
      organization_id: organizationId,
      user_id: userId,
      label: label.trim(),
      sort_order: items.length
    });
    setLabel('');
    setBusy(false);
    onChange();
  }

  async function toggleItem(item: ChecklistItem) {
    if (!canEdit) return;
    await supabase.from('job_checklist_items').update({ completed: !item.completed }).eq('id', item.id);
    onChange();
  }

  const done = items.filter((i) => i.completed).length;

  return (
    <div className="form">
      <h4>Checklist ({done}/{items.length})</h4>
      {items.map((item) => (
        <label key={item.id} className="checklist-row">
          <input type="checkbox" checked={item.completed} disabled={!canEdit} onChange={() => toggleItem(item)} />
          <span>{item.label}</span>
        </label>
      ))}
      {canEdit && (
        <>
          <input className="input" placeholder="Add checklist item" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button type="button" className="btn" disabled={busy} onClick={addItem}>
            Add item
          </button>
        </>
      )}
    </div>
  );
}
