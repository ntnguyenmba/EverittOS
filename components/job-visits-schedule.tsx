'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FriendlyDateInput } from '@/components/friendly-date-input';

export type JobVisitRow = {
  id?: string;
  visit_date: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
};

type JobVisitsScheduleProps = {
  jobId: string;
  organizationId: string | null;
  canManage: boolean;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  onSaved?: () => void;
};

function toDate(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function toTime(value?: string | null, fallback = '08:00') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toTimeString().slice(0, 5);
}

function addHours(time: string, hours: number) {
  const [h, m] = time.split(':').map(Number);
  const date = new Date(2000, 0, 1, h || 8, m || 0);
  date.setHours(date.getHours() + hours);
  return date.toTimeString().slice(0, 5);
}

function visitHours(visit: JobVisitRow) {
  if (!visit.visit_date || !visit.start_time || !visit.end_time) return 0;
  const start = new Date(`${visit.visit_date}T${visit.start_time}`);
  const end = new Date(`${visit.visit_date}T${visit.end_time}`);
  const diff = (end.getTime() - start.getTime()) / 36e5;
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

function formatHours(value: number) {
  if (!value) return '0 hrs';
  return `${Number.isInteger(value) ? value : value.toFixed(1)} hrs`;
}

function fallbackVisit(props: JobVisitsScheduleProps): JobVisitRow {
  const visitDate = toDate(props.scheduledStart) || props.startDate || props.dueDate || new Date().toISOString().slice(0, 10);
  const startTime = toTime(props.scheduledStart, '08:00');
  const endTime = toTime(props.scheduledEnd, addHours(startTime, 8));
  return { visit_date: visitDate, start_time: startTime, end_time: endTime, notes: '' };
}

export function JobVisitsSchedule(props: JobVisitsScheduleProps) {
  const [visits, setVisits] = useState<JobVisitRow[]>([fallbackVisit(props)]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const feedback = useAppFeedback();

  useEffect(() => {
    let active = true;

    async function loadVisits() {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_visits')
        .select('id, visit_date, start_time, end_time, notes')
        .eq('job_id', props.jobId)
        .order('visit_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (!active) return;
      if (error) {
        setVisits([fallbackVisit(props)]);
      } else if (data && data.length > 0) {
        setVisits(data as JobVisitRow[]);
      } else {
        setVisits([fallbackVisit(props)]);
      }
      setLoading(false);
    }

    void loadVisits();
    return () => {
      active = false;
    };
  }, [props.jobId, props.scheduledStart, props.scheduledEnd, props.startDate, props.dueDate]);

  const totalHours = useMemo(() => visits.reduce((sum, visit) => sum + visitHours(visit), 0), [visits]);

  function updateVisit(index: number, field: keyof JobVisitRow, value: string) {
    setVisits((current) => current.map((visit, i) => (i === index ? { ...visit, [field]: value } : visit)));
  }

  function addVisit() {
    const last = visits[visits.length - 1] || fallbackVisit(props);
    const nextDate = new Date(`${last.visit_date || new Date().toISOString().slice(0, 10)}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    setVisits((current) => [
      ...current,
      {
        visit_date: nextDate.toISOString().slice(0, 10),
        start_time: last.start_time || '08:00',
        end_time: last.end_time || '16:00',
        notes: ''
      }
    ]);
  }

  function removeVisit(index: number) {
    setVisits((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  }

  async function saveVisits() {
    if (!props.canManage || saving) return;
    const cleanVisits = visits.map((visit) => ({
      id: visit.id,
      visit_date: visit.visit_date,
      start_time: visit.start_time,
      end_time: visit.end_time,
      notes: visit.notes || null
    }));

    if (cleanVisits.some((visit) => !visit.visit_date || !visit.start_time || !visit.end_time)) {
      feedback.error('Each visit needs a date, start time, and end time.');
      return;
    }

    setSaving(true);
    const res = await fetch('/api/schedule/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: props.jobId, visits: cleanVisits })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setSaving(false);

    if (!res.ok) {
      feedback.error(json.error || 'Unable to save visits.');
      return;
    }

    feedback.success(json.message || 'Visits saved.');
    props.onSaved?.();
  }

  if (loading) return <p className="loading-state">Loading visits...</p>;

  return (
    <div className="job-visits form">
      <div className="job-visits-head">
        <div className="job-visits-title">
          <h3>Visits</h3>
          <p className="muted">Choose month, day, and year directly. No long calendar scrolling.</p>
        </div>
        {props.canManage ? (
          <button className="btn job-visits-add" type="button" onClick={addVisit}>+ Add visit</button>
        ) : null}
      </div>

      <div className="job-visits-list">
        {visits.map((visit, index) => (
          <div className="job-visit-row" key={visit.id || index}>
            <div className="job-visit-field">
              <label>Date</label>
              <FriendlyDateInput
                value={visit.visit_date}
                disabled={!props.canManage}
                ariaLabel={`Visit ${index + 1} date`}
                onChange={(value) => updateVisit(index, 'visit_date', value)}
              />
            </div>
            <div className="job-visit-field">
              <label>Start</label>
              <input className="input" type="time" value={visit.start_time} disabled={!props.canManage} onChange={(e) => updateVisit(index, 'start_time', e.target.value)} />
            </div>
            <div className="job-visit-field">
              <label>End</label>
              <input className="input" type="time" value={visit.end_time} disabled={!props.canManage} onChange={(e) => updateVisit(index, 'end_time', e.target.value)} />
            </div>
            {props.canManage ? (
              <button className="btn job-visit-remove" type="button" disabled={visits.length === 1} onClick={() => removeVisit(index)}>Remove</button>
            ) : (
              <span className="muted job-visit-hours">{formatHours(visitHours(visit))}</span>
            )}
          </div>
        ))}
      </div>

      <p className="muted job-visits-total">
        Total scheduled: {formatHours(totalHours)} across {visits.length} {visits.length === 1 ? 'visit' : 'visits'}.
      </p>

      {props.canManage ? (
        <button className="btn btn-primary job-visits-save" type="button" onClick={saveVisits} disabled={saving}>
          {saving ? 'Saving...' : 'Save visits'}
        </button>
      ) : null}
    </div>
  );
}
