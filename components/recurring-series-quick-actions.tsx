'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { supabase } from '@/lib/supabase';

type Props = { jobId: string };
type Series = { id: string; status?: string | null };

type JobSeriesMeta = {
  recurring_series_id?: string | null;
  occurrence_date?: string | null;
  start_date?: string | null;
};

export function RecurringSeriesQuickActions({ jobId }: Props) {
  const feedback = useAppFeedback();
  const [target, setTarget] = useState<Element | null>(null);
  const [job, setJob] = useState<JobSeriesMeta | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const findTarget = () => {
      if (cancelled) return;
      const nextTarget = document.querySelector('.job-visits');
      if (nextTarget) {
        setTarget(nextTarget);
        return;
      }
      attempts += 1;
      if (attempts < 30) window.setTimeout(findTarget, 100);
    };

    findTarget();
    return () => { cancelled = true; };
  }, [jobId]);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from('jobs')
        .select('recurring_series_id, occurrence_date, start_date')
        .eq('id', jobId)
        .maybeSingle();

      if (!active) return;
      const nextJob = (data || null) as JobSeriesMeta | null;
      setJob(nextJob);

      const seriesId = String(nextJob?.recurring_series_id || '');
      if (!seriesId) {
        setSeries(null);
        return;
      }

      const response = await fetch(`/api/recurring-jobs/${seriesId}`, { cache: 'no-store' });
      const json = (await response.json().catch(() => ({}))) as { series?: Series };
      if (!active) return;
      setSeries(response.ok && json.series ? json.series : { id: seriesId, status: null });
    }

    void load();
    return () => { active = false; };
  }, [jobId]);

  function openRecurringEditor() {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.job-visits-head button'));
    const editButton = buttons.find((button) => button.classList.contains('btn-primary'));
    editButton?.click();
    document.querySelector('.job-visits')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function runAction(action: 'pause' | 'resume' | 'end') {
    if (!series || !job || busy) return;

    if (action === 'end') {
      const confirmed = window.confirm('End this recurring series? Future unfinished visits will stop. Past completed visits will stay.');
      if (!confirmed) return;
    }

    setBusy(action);
    const response = await fetch(`/api/recurring-jobs/${series.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        fromDate: job.occurrence_date || job.start_date || undefined,
        cancelFutureJobs: action === 'pause' ? true : undefined
      })
    });
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy('');

    if (!response.ok) {
      feedback.error(json.error || 'Could not update the recurring series.');
      return;
    }

    feedback.success(action === 'pause' ? 'Recurring series paused.' : action === 'resume' ? 'Recurring series resumed.' : 'Recurring series ended.');
    if (action === 'end') {
      window.location.reload();
      return;
    }
    setSeries((current) => current ? { ...current, status: action === 'pause' ? 'paused' : 'active' } : current);
  }

  if (!target || !job?.recurring_series_id || !series) return null;

  const paused = String(series.status || '').toLowerCase() === 'paused';

  return createPortal(
    <div className="card" style={{ marginTop: 14, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <strong>Recurring schedule</strong>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Change the whole schedule here. Past completed visits are not changed.
          </p>
        </div>
        <div className="button-row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={openRecurringEditor}>
            Edit schedule
          </button>
          {paused ? (
            <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => void runAction('resume')}>
              {busy === 'resume' ? 'Working...' : 'Resume series'}
            </button>
          ) : (
            <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => void runAction('pause')}>
              {busy === 'pause' ? 'Working...' : 'Pause series'}
            </button>
          )}
          <button type="button" className="btn btn-danger" disabled={Boolean(busy)} onClick={() => void runAction('end')}>
            {busy === 'end' ? 'Working...' : 'End series'}
          </button>
        </div>
      </div>
    </div>,
    target
  );
}
