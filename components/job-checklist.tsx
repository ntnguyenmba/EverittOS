'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
import { FEEDBACK } from '@/lib/feedback-labels';
import { formatSupabaseError } from '@/lib/action-messages';
import { supabase } from '@/lib/supabase';

type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
  sort_order: number;
};

type InstructionStep = {
  id: string;
  templateId: string;
  templateName: string;
  position: number;
  required: boolean;
  photoRequired: boolean;
  label: string;
  completed: boolean;
};

type JobChecklistProps = {
  jobId: string;
  organizationId: string;
  userId: string;
  items: ChecklistItem[];
  canEdit: boolean;
  canAddItems?: boolean;
  onChange: () => void;
};

const COPY = {
  en: {
    instructions: 'Job instructions', checklist: 'Checklist', required: 'Required', photoRequired: 'Photo required',
    addPlaceholder: 'Add checklist item', addItem: 'Add item', added: 'Checklist item added.', loadError: 'Job instructions could not be loaded.'
  },
  es: {
    instructions: 'Instrucciones de trabajo', checklist: 'Lista', required: 'Obligatorio', photoRequired: 'Foto obligatoria',
    addPlaceholder: 'Agregar elemento', addItem: 'Agregar', added: 'Elemento agregado.', loadError: 'No se pudieron cargar las instrucciones.'
  },
  vi: {
    instructions: 'Hướng dẫn công việc', checklist: 'Danh sách', required: 'Bắt buộc', photoRequired: 'Bắt buộc chụp ảnh',
    addPlaceholder: 'Thêm mục công việc', addItem: 'Thêm mục', added: 'Đã thêm mục.', loadError: 'Không tải được hướng dẫn công việc.'
  }
} as const;

export function JobChecklist({ jobId, organizationId, userId, items, canEdit, canAddItems = canEdit, onChange }: JobChecklistProps) {
  const appFeedback = useAppFeedback();
  const { locale } = useTranslation();
  const copy = COPY[locale];
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [instructions, setInstructions] = useState<InstructionStep[]>([]);
  const [instructionsLoading, setInstructionsLoading] = useState(true);

  const loadInstructions = useCallback(async () => {
    if (!jobId) return;
    setInstructionsLoading(true);

    const { data: links, error: linkError } = await supabase
      .from('job_instruction_job_links')
      .select('template_id')
      .eq('job_id', jobId);

    if (linkError) {
      setInstructionsLoading(false);
      if (!/does not exist|schema cache/i.test(linkError.message || '')) appFeedback.error(copy.loadError);
      return;
    }

    const templateIds = Array.from(new Set((links || []).map((row: { template_id?: string | null }) => String(row.template_id)).filter(Boolean)));
    if (!templateIds.length) {
      setInstructions([]);
      setInstructionsLoading(false);
      return;
    }

    const [{ data: templates }, { data: steps, error: stepError }] = await Promise.all([
      supabase.from('job_instruction_templates').select('id, name').in('id', templateIds),
      supabase.from('job_instruction_steps').select('id, template_id, position, required, photo_required').in('template_id', templateIds).order('position', { ascending: true })
    ]);

    if (stepError) {
      setInstructionsLoading(false);
      appFeedback.error(copy.loadError);
      return;
    }

    type StepRow = {
      id?: string | null;
      template_id?: string | null;
      position?: number | null;
      required?: boolean | null;
      photo_required?: boolean | null;
    };
    type TemplateRow = { id?: string | null; name?: string | null };
    type CompletionRow = { step_id?: string | null; completed?: boolean | null };

    const stepIds = ((steps || []) as StepRow[]).map((step) => String(step.id));
    const [{ data: translations }, { data: completions }] = await Promise.all([
      stepIds.length
        ? supabase.from('job_instruction_step_translations').select('step_id, locale, instruction').in('step_id', stepIds)
        : Promise.resolve({ data: [] as Array<{ step_id: string; locale: string; instruction: string }> }),
      stepIds.length
        ? supabase.from('job_instruction_completions').select('step_id, completed').eq('job_id', jobId).in('step_id', stepIds)
        : Promise.resolve({ data: [] as Array<{ step_id: string; completed: boolean }> })
    ]);

    const templateNames = new Map(((templates || []) as TemplateRow[]).map((template) => [String(template.id), String(template.name)]));
    const completionMap = new Map(((completions || []) as CompletionRow[]).map((completion) => [String(completion.step_id), Boolean(completion.completed)]));
    const translationsByStep = new Map<string, Map<string, string>>();

    for (const translation of translations || []) {
      const stepId = String(translation.step_id);
      const languageMap = translationsByStep.get(stepId) || new Map<string, string>();
      languageMap.set(String(translation.locale), String(translation.instruction));
      translationsByStep.set(stepId, languageMap);
    }

    const next = ((steps || []) as StepRow[]).map((step) => {
      const stepId = String(step.id);
      const languageMap = translationsByStep.get(stepId) || new Map<string, string>();
      const text = languageMap.get(locale) || languageMap.get('en') || Array.from(languageMap.values())[0] || '';
      return {
        id: stepId,
        templateId: String(step.template_id),
        templateName: templateNames.get(String(step.template_id)) || copy.instructions,
        position: Number(step.position || 0),
        required: Boolean(step.required),
        photoRequired: Boolean(step.photo_required),
        label: text,
        completed: completionMap.get(stepId) || false
      };
    }).filter((step) => step.label.trim());

    setInstructions(next);
    setInstructionsLoading(false);
  }, [appFeedback, copy.instructions, copy.loadError, jobId, locale]);

  useEffect(() => {
    void loadInstructions();
  }, [loadInstructions]);

  async function addItem() {
    if (!label.trim() || !canAddItems || busy) return;
    setBusy(true);
    const { error } = await supabase.from('job_checklist_items').insert({
      job_id: jobId,
      organization_id: organizationId,
      user_id: userId,
      label: label.trim(),
      sort_order: items.length
    });
    setBusy(false);
    if (error) {
      appFeedback.error(formatSupabaseError(error));
      return;
    }
    setLabel('');
    appFeedback.success(copy.added);
    onChange();
  }

  async function toggleItem(item: ChecklistItem) {
    if (!canEdit) return;
    const { error } = await supabase.from('job_checklist_items').update({ completed: !item.completed }).eq('id', item.id);
    if (error) {
      appFeedback.error(formatSupabaseError(error));
      return;
    }
    onChange();
  }

  async function toggleInstruction(step: InstructionStep) {
    if (!canEdit) return;
    const nextCompleted = !step.completed;
    const { error } = await supabase.from('job_instruction_completions').upsert({
      job_id: jobId,
      step_id: step.id,
      completed: nextCompleted,
      completed_by: nextCompleted ? userId : null,
      completed_at: nextCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'job_id,step_id' });
    if (error) {
      appFeedback.error(formatSupabaseError(error));
      return;
    }
    setInstructions((current) => current.map((item) => item.id === step.id ? { ...item, completed: nextCompleted } : item));
  }

  const done = items.filter((item) => item.completed).length;
  const instructionDone = instructions.filter((item) => item.completed).length;
  const groupedInstructions = useMemo(() => {
    const groups = new Map<string, InstructionStep[]>();
    for (const step of instructions) {
      const current = groups.get(step.templateId) || [];
      current.push(step);
      groups.set(step.templateId, current);
    }
    return Array.from(groups.values());
  }, [instructions]);

  return (
    <div className="form">
      {instructionsLoading ? <p className="loading-state">{FEEDBACK.loading}</p> : null}
      {instructions.length > 0 ? (
        <div>
          <h4>{copy.instructions} ({instructionDone}/{instructions.length})</h4>
          {groupedInstructions.map((group) => (
            <div key={group[0].templateId} style={{ marginBottom: 14 }}>
              <strong>{group[0].templateName}</strong>
              {group.map((step) => (
                <label key={step.id} className="checklist-row">
                  <input type="checkbox" checked={step.completed} disabled={!canEdit} onChange={() => void toggleInstruction(step)} />
                  <span>
                    {step.label}
                    {(step.required || step.photoRequired) ? (
                      <small className="muted" style={{ display: 'block' }}>
                        {[step.required ? copy.required : '', step.photoRequired ? copy.photoRequired : ''].filter(Boolean).join(' · ')}
                      </small>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <h4>{copy.checklist} ({done}/{items.length})</h4>
      {items.map((item) => (
        <label key={item.id} className="checklist-row">
          <input type="checkbox" checked={item.completed} disabled={!canEdit} onChange={() => void toggleItem(item)} />
          <span>{item.label}</span>
        </label>
      ))}
      {canAddItems ? (
        <>
          <input className="input" placeholder={copy.addPlaceholder} value={label} onChange={(event) => setLabel(event.target.value)} />
          <button type="button" className="btn" disabled={busy} onClick={() => void addItem()}>{busy ? FEEDBACK.loading : copy.addItem}</button>
        </>
      ) : null}
    </div>
  );
}
