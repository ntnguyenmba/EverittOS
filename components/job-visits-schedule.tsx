'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
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
  timezone?: string | null;
  onSaved?: () => void;
};

type RecurringSeries = {
  id: string;
  recurrence_frequency?: string | null;
  recurrence_interval?: number | null;
  recurrence_interval_unit?: string | null;
  recurrence_weekday?: number | null;
  recurrence_weekdays?: number[] | null;
  start_date?: string | null;
  end_date?: string | null;
  occurrence_limit?: number | null;
  preferred_start_time?: string | null;
  duration_minutes?: number | null;
  status?: string | null;
};

type UpcomingOccurrence = {
  id: string;
  occurrence_date?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  status?: string | null;
  is_skipped?: boolean | null;
};

type SeriesDraft = {
  interval: number;
  unit: 'day' | 'week' | 'month';
  weekdays: number[];
  startDate: string;
  startTime: string;
  durationMinutes: number;
  endMode: 'never' | 'date' | 'count';
  endDate: string;
  occurrenceLimit: number;
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const copy = {
  en: {
    schedule: 'Schedule',
    recurringSchedule: 'Recurring schedule',
    scheduleSaved: 'Schedule saved.',
    edit: 'Edit',
    editRecurringSchedule: 'Edit recurring schedule',
    rescheduleThisVisit: 'Reschedule this visit'
  },
  es: {
    schedule: 'Horario',
    recurringSchedule: 'Horario recurrente',
    scheduleSaved: 'Horario guardado.',
    edit: 'Editar',
    editRecurringSchedule: 'Editar horario recurrente',
    rescheduleThisVisit: 'Reprogramar esta visita'
  },
  vi: {
    schedule: 'Lịch',
    recurringSchedule: 'Lịch lặp lại',
    scheduleSaved: 'Đã lưu lịch.',
    edit: 'Sửa',
    editRecurringSchedule: 'Sửa lịch lặp lại',
    rescheduleThisVisit: 'Đổi lịch lượt ghé này'
  }
} as const;

function addHours(time: string, hours: number) {
  const [h, m] = time.split(':').map(Number);
  const date = new Date(2000, 0, 1, h || 8, m || 0);
  date.setMinutes(date.getMinutes() + hours * 60);
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

function formatVisitSummary(visit: JobVisitRow) {
  const dateLabel = visit.visit_date
    ? new Date(`${visit.visit_date}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      })
    : 'Date TBD';
  return `${dateLabel} · ${visit.start_time || '--:--'} – ${visit.end_time || '--:--'}`;
}

function fallbackVisit(props: JobVisitsScheduleProps): JobVisitRow {
  const startWall = wallClockFromTimestamp(props.scheduledStart, '08:00');
  const endWall = wallClockFromTimestamp(props.scheduledEnd, addHours(startWall?.time || '08:00', 8));
  const visitDate = startWall?.date || props.startDate || props.dueDate || localToday();
  const startTime = startWall?.time || '08:00';
  const endTime = endWall?.time || addHours(startTime, 8);
  return { visit_date: visitDate, start_time: startTime, end_time: endTime, notes: '' };
}

function formatTime(value?: string | null) {
  if (!value) return 'Not set';
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  const date = new Date(2000, 0, 1, hours || 0, minutes || 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function recurrenceSummary(series: RecurringSeries) {
  const interval = Math.max(1, Number(series.recurrence_interval || 1));
  const unit = String(series.recurrence_interval_unit || series.recurrence_frequency || 'week').toLowerCase();
  const normalizedUnit = unit.startsWith('day') ? 'day' : unit.startsWith('month') ? 'month' : 'week';
  const every = interval === 1 ? `Every ${normalizedUnit}` : `Every ${interval} ${normalizedUnit}s`;
  const weekdayValues = Array.isArray(series.recurrence_weekdays) && series.recurrence_weekdays.length
    ? series.recurrence_weekdays
    : series.recurrence_weekday != null ? [series.recurrence_weekday] : [];
  const days = weekdayValues.map((value) => WEEKDAYS[Number(value)]).filter(Boolean).join(', ');
  return days ? `${every} on ${days}` : every;
}

function draftFromSeries(series: RecurringSeries): SeriesDraft {
  const rawUnit = String(series.recurrence_interval_unit || series.recurrence_frequency || 'week').toLowerCase();
  const unit: SeriesDraft['unit'] = rawUnit.startsWith('day') ? 'day' : rawUnit.startsWith('month') ? 'month' : 'week';
  const weekdays = Array.isArray(series.recurrence_weekdays) && series.recurrence_weekdays.length
    ? series.recurrence_weekdays.map(Number)
    : series.recurrence_weekday != null ? [Number(series.recurrence_weekday)] : [];
  return {
    interval: Math.max(1, Number(series.recurrence_interval || 1)),
    unit,
    weekdays,
    startDate: String(series.start_date || localToday()).slice(0, 10),
    startTime: String(series.preferred_start_time || '08:00').slice(0, 5),
    durationMinutes: Math.max(15, Number(series.duration_minutes || 60)),
    endMode: series.end_date ? 'date' : series.occurrence_limit ? 'count' : 'never',
    endDate: String(series.end_date || '').slice(0, 10),
    occurrenceLimit: Math.max(1, Number(series.occurrence_limit || 12))
  };
}

export function JobVisitsSchedule(props: JobVisitsScheduleProps) {
  const { jobId, scheduledStart, scheduledEnd, startDate, dueDate, canManage, onSaved, timezone } = props;
  const { locale } = useTranslation();
  const c = copy[locale];
  const [visits, setVisits] = useState<JobVisitRow[]>([fallbackVisit(props)]);
  const [timeZone, setTimeZone] = useState(timezone || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showTimezone, setShowTimezone] = useState(false);
  const [fromDatabase, setFromDatabase] = useState(false);
  const [series, setSeries] = useState<RecurringSeries | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingOccurrence[]>([]);
  const [editingSeries, setEditingSeries] = useState(false);
  const [savingSeries, setSavingSeries] = useState(false);
  const [seriesDraft, setSeriesDraft] = useState<SeriesDraft | null>(null);
  const feedback = useAppFeedback();

  async function loadVisits() {
    setLoading(true);
    const [{ data, error }, { data: jobData }] = await Promise.all([
      supabase.from('job_visits').select('id, visit_date, start_time, end_time, notes').eq('job_id', jobId).order('visit_date').order('start_time'),
      supabase.from('jobs').select('timezone, recurring_series_id').eq('id', jobId).maybeSingle()
    ]);

    const recurringSeriesId = String(jobData?.recurring_series_id || '');
    const resolvedTz = (typeof jobData?.timezone === 'string' && jobData.timezone) || timezone || '';
    setTimeZone(resolvedTz);
    setShowTimezone(!resolvedTz);

    if (recurringSeriesId) {
      const response = await fetch(`/api/recurring-jobs/${recurringSeriesId}`, { cache: 'no-store' });
      const json = (await response.json().catch(() => ({}))) as { series?: RecurringSeries; jobs?: UpcomingOccurrence[] };
      if (response.ok && json.series) {
        setSeries(json.series);
        setSeriesDraft(draftFromSeries(json.series));
        const today = localToday();
        setUpcoming((json.jobs || []).filter((item) => {
          const date = String(item.occurrence_date || item.scheduled_start || '').slice(0, 10);
          const status = String(item.status || '').toLowerCase();
          return date >= today && !item.is_skipped && !['cancelled', 'canceled', 'completed', 'done', 'complete', 'closed'].includes(status);
        }).slice(0, 8));
      }
    } else {
      setSeries(null);
      setSeriesDraft(null);
      setUpcoming([]);
    }

    const fallbackProps = { ...props, timezone: resolvedTz };
    if (error) {
      setVisits([fallbackVisit(fallbackProps)]);
      setFromDatabase(false);
      setEditing(!scheduledStart && !startDate);
    } else if (data && data.length > 0) {
      setVisits((data as JobVisitRow[]).map((visit) => ({
        ...visit,
        visit_date: String(visit.visit_date || '').slice(0, 10),
        start_time: String(visit.start_time || '').slice(0, 5),
        end_time: String(visit.end_time || '').slice(0, 5)
      })));
      setFromDatabase(true);
      setEditing(false);
    } else if (scheduledStart || startDate) {
      setVisits([fallbackVisit(fallbackProps)]);
      setFromDatabase(false);
      setEditing(false);
    } else {
      setVisits([fallbackVisit(fallbackProps)]);
      setFromDatabase(false);
      setEditing(canManage);
    }
    setLoading(false);
  }

  useEffect(() => { void loadVisits(); }, [jobId, scheduledStart, scheduledEnd, startDate, dueDate, canManage, props.organizationId, timezone]);

  const totalHours = useMemo(() => visits.reduce((sum, visit) => sum + visitHours(visit), 0), [visits]);
  const hasSavedSchedule = Boolean(fromDatabase || scheduledStart || startDate);
  const isRecurring = Boolean(series);

  function updateVisit(index: number, field: keyof JobVisitRow, value: string) {
    setVisits((current) => current.map((visit, i) => i === index ? { ...visit, [field]: value } : visit));
  }

  function addVisit() {
    if (isRecurring) return;
    setEditing(true);
    const last = visits[visits.length - 1] || fallbackVisit(props);
    setVisits((current) => [...current, {
      visit_date: addLocalDays(last.visit_date || localToday(), 1),
      start_time: last.start_time || '08:00',
      end_time: last.end_time || '16:00', notes: ''
    }]);
  }

  function removeVisit(index: number) {
    if (isRecurring) return;
    setEditing(true);
    setVisits((current) => current.filter((_, i) => i !== index));
  }

  async function saveVisits() {
    if (!canManage || saving) return;
    const cleanVisits = visits.map((visit) => ({ id: visit.id, visit_date: visit.visit_date, start_time: visit.start_time, end_time: visit.end_time, notes: visit.notes || null }));
    if (cleanVisits.some((visit) => !visit.visit_date || !visit.start_time || !visit.end_time)) {
      feedback.error('Each visit needs a date, start time, and end time.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/schedule/update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, visits: cleanVisits, timezone: timeZone || null })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setSaving(false);
    if (!res.ok) {
      feedback.error(json.error || 'The schedule could not be saved. Please try again.');
      return;
    }
    feedback.success(json.message || (isRecurring ? 'This visit was rescheduled. Other visits were not changed.' : c.scheduleSaved));
    setEditing(false);
    setFromDatabase(cleanVisits.length > 0);
    onSaved?.();
  }

  async function saveRecurringSchedule() {
    if (!series || !seriesDraft || savingSeries) return;
    if (seriesDraft.unit === 'week' && seriesDraft.weekdays.length === 0) {
      feedback.error('Choose at least one weekday.');
      return;
    }
    setSavingSeries(true);
    const res = await fetch(`/api/recurring-jobs/${series.id}/schedule`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromDate: visits[0]?.visit_date || seriesDraft.startDate,
        interval: seriesDraft.interval,
        unit: seriesDraft.unit,
        weekdays: seriesDraft.weekdays,
        startDate: seriesDraft.startDate,
        startTime: seriesDraft.startTime,
        durationMinutes: seriesDraft.durationMinutes,
        endMode: seriesDraft.endMode,
        endDate: seriesDraft.endMode === 'date' ? seriesDraft.endDate : null,
        occurrenceLimit: seriesDraft.endMode === 'count' ? seriesDraft.occurrenceLimit : null,
        timezone: timeZone || null
      })
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setSavingSeries(false);
    if (!res.ok) {
      feedback.error(json.error || 'The recurring schedule could not be updated.');
      return;
    }
    feedback.success(json.message || 'Recurring schedule updated.');
    setEditingSeries(false);
    await loadVisits();
    onSaved?.();
  }

  if (loading) return <p className="loading-state">Loading schedule...</p>;

  return (
    <div className="job-visits form">
      <div className="job-visits-head">
        <div className="job-visits-title">
          <h3>{isRecurring ? c.recurringSchedule : c.schedule}</h3>
          <p className="muted">{isRecurring ? 'The recurring rule creates future visits. Rescheduling changes only this visit.' : 'Set each visit date and time, then save.'}</p>
        </div>
        {canManage ? (
          <div className="button-row" style={{ flexWrap: 'wrap' }}>
            {isRecurring && series ? <button className="btn btn-primary" type="button" onClick={() => setEditingSeries((value) => !value)}>{c.editRecurringSchedule}</button> : null}
            {hasSavedSchedule && !editing ? <button className="btn" type="button" onClick={() => setEditing(true)}>{isRecurring ? c.rescheduleThisVisit : c.edit}</button> : null}
            {!isRecurring ? <button className="btn job-visits-add" type="button" onClick={addVisit}>Add visit</button> : null}
          </div>
        ) : null}
      </div>

      {isRecurring && series && seriesDraft ? (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          {editingSeries ? (
            <div className="form">
              <div className="grid-2">
                <label>Every<input className="input" type="number" min="1" max="52" value={seriesDraft.interval} onChange={(e) => setSeriesDraft({ ...seriesDraft, interval: Math.max(1, Number(e.target.value)) })} /></label>
                <label>Period<select className="input" value={seriesDraft.unit} onChange={(e) => setSeriesDraft({ ...seriesDraft, unit: e.target.value as SeriesDraft['unit'] })}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
              </div>
              {seriesDraft.unit === 'week' ? (
                <div><label>Weekdays</label><div className="button-row" style={{ flexWrap: 'wrap' }}>{WEEKDAYS.map((day, index) => { const selected = seriesDraft.weekdays.includes(index); return <button key={day} type="button" className={selected ? 'btn btn-primary' : 'btn'} onClick={() => setSeriesDraft({ ...seriesDraft, weekdays: selected ? seriesDraft.weekdays.filter((value) => value !== index) : [...seriesDraft.weekdays, index].sort() })}>{day.slice(0, 3)}</button>; })}</div></div>
              ) : null}
              <div className="grid-2">
                <label>Starts<FriendlyDateInput value={seriesDraft.startDate} ariaLabel="Recurring schedule start date" onChange={(value) => setSeriesDraft({ ...seriesDraft, startDate: value })} /></label>
                <label>Start time<input className="input" type="time" value={seriesDraft.startTime} onChange={(e) => setSeriesDraft({ ...seriesDraft, startTime: e.target.value })} /></label>
                <label>Duration in minutes<input className="input" type="number" min="15" step="15" value={seriesDraft.durationMinutes} onChange={(e) => setSeriesDraft({ ...seriesDraft, durationMinutes: Math.max(15, Number(e.target.value)) })} /></label>
                <label>Ends<select className="input" value={seriesDraft.endMode} onChange={(e) => setSeriesDraft({ ...seriesDraft, endMode: e.target.value as SeriesDraft['endMode'] })}><option value="never">Never</option><option value="date">On date</option><option value="count">After visits</option></select></label>
                {seriesDraft.endMode === 'date' ? <label>End date<FriendlyDateInput value={seriesDraft.endDate} ariaLabel="Recurring schedule end date" onChange={(value) => setSeriesDraft({ ...seriesDraft, endDate: value })} /></label> : null}
                {seriesDraft.endMode === 'count' ? <label>Number of visits<input className="input" type="number" min="1" value={seriesDraft.occurrenceLimit} onChange={(e) => setSeriesDraft({ ...seriesDraft, occurrenceLimit: Math.max(1, Number(e.target.value)) })} /></label> : null}
              </div>
              <p className="muted">Saving replaces only this visit and future unfinished visits. Completed visits, payments, payroll, invoices, history, and past metrics stay unchanged.</p>
              <div className="button-row"><button type="button" className="btn btn-primary" disabled={savingSeries} onClick={() => void saveRecurringSchedule()}>{savingSeries ? 'Saving...' : 'Save recurring schedule'}</button><button type="button" className="btn" disabled={savingSeries} onClick={() => { setSeriesDraft(draftFromSeries(series)); setEditingSeries(false); }}>Cancel</button></div>
            </div>
          ) : (
            <><div className="grid-2"><div><span className="muted">Repeats</span><strong style={{ display: 'block' }}>{recurrenceSummary(series)}</strong></div><div><span className="muted">Time</span><strong style={{ display: 'block' }}>{formatTime(series.preferred_start_time)}{series.duration_minutes ? ` · ${formatHours(series.duration_minutes / 60)}` : ''}</strong></div><div><span className="muted">Starts</span><strong style={{ display: 'block' }}>{formatDate(series.start_date)}</strong></div><div><span className="muted">Ends</span><strong style={{ display: 'block' }}>{series.end_date ? formatDate(series.end_date) : series.occurrence_limit ? `After ${series.occurrence_limit} visits` : 'Never'}</strong></div></div><p className="muted" style={{ margin: '12px 0 0' }}>Past completed visits stay unchanged so payroll, invoices, history, and metrics remain accurate.</p></>
          )}
        </div>
      ) : null}

      {timeZone && !showTimezone ? <p className="muted" style={{ marginTop: 0 }}>Timezone: {TIME_ZONE_OPTIONS.find((option) => option.value === timeZone)?.label || timeZone}{canManage ? <>{' · '}<button type="button" className="btn" style={{ padding: '2px 8px', fontSize: '0.85em' }} onClick={() => setShowTimezone(true)}>Change timezone</button></> : null}</p> : <div className="job-visit-field"><label>Job timezone</label>{canManage ? <select className="input" value={timeZone} onChange={(event) => setTimeZone(event.target.value)}><option value="">Use company default</option>{TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <p>{TIME_ZONE_OPTIONS.find((option) => option.value === timeZone)?.label || 'Company default'}</p>}</div>}

      {!editing && hasSavedSchedule ? <div className="job-visits-list">{visits.map((visit, index) => <div className="list-row" key={visit.id || index} style={{ alignItems: 'center' }}><div><strong>{formatVisitSummary(visit)}</strong><p className="muted" style={{ margin: '4px 0 0' }}>{formatHours(visitHours(visit))}</p></div>{!isRecurring && canManage ? <button className="btn" type="button" onClick={() => removeVisit(index)}>Remove visit</button> : null}</div>)}</div> : <div className="job-visits-list">{visits.map((visit, index) => <div className="job-visit-row" key={visit.id || index}><div className="job-visit-field"><label>Date</label><FriendlyDateInput value={visit.visit_date} disabled={!canManage} ariaLabel={`Visit ${index + 1} date`} onChange={(value) => updateVisit(index, 'visit_date', value)} /></div><div className="job-visit-field"><label>Start</label><input className="input" type="time" value={visit.start_time} disabled={!canManage} onChange={(e) => updateVisit(index, 'start_time', e.target.value)} /></div><div className="job-visit-field"><label>End</label><input className="input" type="time" value={visit.end_time} disabled={!canManage} onChange={(e) => updateVisit(index, 'end_time', e.target.value)} /></div>{!isRecurring && canManage ? <button className="btn job-visit-remove" type="button" onClick={() => removeVisit(index)}>Remove visit</button> : <span className="muted job-visit-hours">{formatHours(visitHours(visit))}</span>}</div>)}</div>}

      <p className="muted job-visits-total">{isRecurring ? `This visit: ${formatHours(totalHours)}.` : `Total scheduled: ${formatHours(totalHours)} across ${visits.length} ${visits.length === 1 ? 'visit' : 'visits'}.`}</p>
      {canManage && editing ? <div className="button-row" style={{ flexWrap: 'wrap' }}><button className="btn btn-primary job-visits-save" type="button" onClick={() => void saveVisits()} disabled={saving}>{saving ? 'Saving...' : isRecurring ? 'Save this visit' : 'Save schedule'}</button>{hasSavedSchedule ? <button className="btn" type="button" disabled={saving} onClick={() => setEditing(false)}>Cancel</button> : null}</div> : null}

      {isRecurring && upcoming.length ? <div style={{ marginTop: 18 }}><h4 style={{ marginBottom: 8 }}>Upcoming visits</h4><div className="job-visits-list">{upcoming.map((item) => { const date = String(item.occurrence_date || item.scheduled_start || '').slice(0, 10); const start = wallClockFromTimestamp(item.scheduled_start, series?.preferred_start_time || '08:00'); const fallbackEnd = addHours(start?.time || series?.preferred_start_time || '08:00', Number(series?.duration_minutes || 60) / 60); const end = wallClockFromTimestamp(item.scheduled_end, fallbackEnd); const row = { visit_date: date, start_time: start?.time || series?.preferred_start_time || '', end_time: end?.time || fallbackEnd }; return <div className="list-row" key={item.id}><div><strong>{formatVisitSummary(row)}</strong><p className="muted" style={{ margin: '4px 0 0' }}>Scheduled</p></div></div>; })}</div></div> : null}
    </div>
  );
}
