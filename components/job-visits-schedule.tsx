'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FriendlyDateInput } from '@/components/friendly-date-input';
import { addLocalDays, localToday, wallClockFromTimestamp } from '@/lib/schedule-times';
import { TIME_ZONE_OPTIONS } from '@/lib/time-zones';

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

function addHours(time: string, hours: number) {
  const [h, m] = time.split(':').map(Number);
  const date = new Date(2000, 0, 1, h || 8, m || 0);
  date.setHours(date.getHours() + hours);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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
  const startWall = wallClockFromTimestamp(props.scheduledStart, '08:00');
  const endWall = wallClockFromTimestamp(props.scheduledEnd, addHours(startWall?.time || '08:00', 8));
  const visitDate = startWall?.date || props.startDate || props.dueDate || localToday();
  const startTime = startWall?.time || '08:00';
  const endTime = endWall?.time || addHours(startTime, 8);
  return { visit_date: visitDate, start_time: startTime, end_time: endTime, notes: '' };
}

export function JobVisitsSchedule(props: JobVisitsScheduleProps) {
  const { jobId, scheduledStart, scheduledEnd, startDate, dueDate, canManage, onSaved } = props;
  const [visits, setVisits] = useState<JobVisitRow[]>([fallbackVisit(props)]);
  const [timeZone, setTimeZone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const feedback = useAppFeedback();

  useEffect(() => {
    let active = true;
    const fallbackProps: JobVisitsScheduleProps = {
      jobId,
      organizationId: props.organizationId,
      canManage,
      scheduledStart,
      scheduledEnd,
      startDate,
      dueDate
    };

    async function loadVisits() {
      setLoading(true);
      const [{ data, error }, { data: jobData }] = await Promise.all([
        supabase
          .from('job_visits')
          .select('id, visit_date, start_time, end_time, notes')
          .eq('job_id', jobId)
          .order('visit_date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase.from('jobs').select('timezone').eq('id', jobId).maybeSingle()
      ]);

      if (!active) return;
      setTimeZone(typeof jobData?.timezone === 'string' ? jobData.timezone : '');
      if (error) {
        setVisits([fallbackVisit(fallbackProps)]);
      } else if (data && data.length > 0) {
        setVisits(
          (data as JobVisitRow[]).map((visit) => ({
            ...visit,
            visit_date: String(visit.visit_date || '').slice(0, 10),
            start_time: String(visit.start_time || '').slice(0, 5),
            end_time: String(visit.end_time || '').slice(0, 5)
          }))
        );
      } else {
        setVisits([fallbackVisit(fallbackProps)]);
      }
      setLoading(false);
    }

    void loadVisits();
    return () => {
      active = false;
    };
  }, [jobId, scheduledStart, scheduledEnd, startDate, dueDate, canManage, props.organizationId]);

  const totalHours = useMemo(() => visits.reduce((sum, visit) => sum + visitHours(visit), 0), [visits]);

  function updateVisit(index: number, field: keyof JobVisitRow, value: string) {
    setVisits((current) => current.map((visit, i) => (i === index ? { ...visit, [field]: value } : visit)));
  }

  function addVisit() {
    const last = visits[visits.length - 1] || fallbackVisit(props);
    setVisits((current) => [
      ...current,
      {
        visit_date: addLocalDays(last.visit_date || localToday(), 1),
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
    if (!canManage || saving) return;
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
      body: JSON.stringify({ jobId, visits: cleanVisits, timezone: timeZone || null })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);

    if (!res.ok) {
      feedback.error(json.error || 'The schedule could not be saved. Please try again.');
      return;
    }

    feedback.success('Schedule and timezone saved. Connected calendars will update automatically.');
    onSaved?.();
  }

  if (loading) return <p className="loading-state">Loading schedule...</p>;

  return (
    <div className="job-visits form">
      <div className="job-visits-head">
        <div className="job-visits-title">
          <h3>Schedule</h3>
          <p className="muted">Set each visit date and time. Connected calendars update automatically after saving.</p>
        </div>
        {canManage ? (
          <button className="btn job-visits-add" type="button" onClick={addVisit}>+ Add visit</button>
        ) : null}
      </div>

      <div className="job-visit-field">
        <label>Job timezone</label>
        {canManage ? (
          <select className="input" value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>
            <option value="">Use workspace default</option>
            {TIME_ZONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <p>{TIME_ZONE_OPTIONS.find((option) => option.value === timeZone)?.label || 'Workspace default'}</p>
        )}
        <p className="muted">Visit times and connected calendar events use the selected location timezone.</p>
      </div>

      <div className="job-visits-list">
        {visits.map((visit, index) => (
          <div className="job-visit-row" key={visit.id || index}>
            <div className="job-visit-field">
              <label>Date</label>
              <FriendlyDateInput
                value={visit.visit_date}
                disabled={!canManage}
                ariaLabel={`Visit ${index + 1} date`}
                onChange={(value) => updateVisit(index, 'visit_date', value)}
              />
            </div>
            <div className="job-visit-field">
              <label>Start</label>
              <input className="input" type="time" value={visit.start_time} disabled={!canManage} onChange={(e) => updateVisit(index, 'start_time', e.target.value)} />
            </div>
            <div className="job-visit-field">
              <label>End</label>
              <input className="input" type="time" value={visit.end_time} disabled={!canManage} onChange={(e) => updateVisit(index, 'end_time', e.target.value)} />
            </div>
            {canManage ? (
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

      {canManage ? (
        <button className="btn btn-primary job-visits-save" type="button" onClick={() => void saveVisits()} disabled={saving}>
          {saving ? 'Saving...' : 'Save schedule'}
        </button>
      ) : null}
    </div>
  );
}
