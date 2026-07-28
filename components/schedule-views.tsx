'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StatusPill } from '@/components/status-pill';
import { formatLocalDate, formatScheduleTimeRange, localDateFromIso } from '@/lib/schedule-times';

export type ScheduleJob = {
  id: string;
  title: string;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  assigned_to: string | null;
  customer_name: string | null;
  address?: string | null;
  phone?: string | null;
};

type ScheduleViewsProps = {
  jobs: ScheduleJob[];
  workerNames: Record<string, string>;
  canAssign: boolean;
  onAssign?: (jobId: string, workerId: string | null) => void;
  onReschedule?: (jobId: string, dateKey: string) => void;
};

type ViewMode = 'today' | 'tomorrow' | 'week' | 'calendar';

function dateKey(date: Date) {
  return formatLocalDate(date);
}

function jobDateKey(job: ScheduleJob): string | null {
  if (job.start_date) return String(job.start_date).slice(0, 10);
  if (job.due_date) return String(job.due_date).slice(0, 10);
  if (job.scheduled_start) return localDateFromIso(job.scheduled_start);
  return null;
}

function actionLabel(status: string | null) {
  const value = String(status || 'new').toLowerCase();
  if (value === 'in_progress' || value === 'in progress' || value === 'started') return 'Continue';
  if (value === 'completed' || value === 'complete') return 'View';
  return 'Start';
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function ScheduleViews({ jobs, workerNames, canAssign, onAssign, onReschedule }: ScheduleViewsProps) {
  const [view, setView] = useState<ViewMode>('today');
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const [dragJobId, setDragJobId] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);
  const tomorrowKey = dateKey(addDays(today, 1));
  const weekEndKey = dateKey(addDays(today, 6));

  const scheduled = useMemo(
    () => jobs.filter((job) => jobDateKey(job)).sort((a, b) => (jobDateKey(a) || '').localeCompare(jobDateKey(b) || '')),
    [jobs]
  );
  const unscheduled = useMemo(() => jobs.filter((job) => !jobDateKey(job)), [jobs]);

  const visibleJobs = useMemo(() => {
    if (view === 'today') return scheduled.filter((job) => jobDateKey(job) === todayKey);
    if (view === 'tomorrow') return scheduled.filter((job) => jobDateKey(job) === tomorrowKey);
    if (view === 'week') {
      return scheduled.filter((job) => {
        const key = jobDateKey(job);
        return Boolean(key && key >= todayKey && key <= weekEndKey);
      });
    }
    return [];
  }, [scheduled, todayKey, tomorrowKey, view, weekEndKey]);

  const calendarDays = useMemo(() => {
    const start = new Date(calendarAnchor);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [calendarAnchor]);

  function handleDrop(targetKey: string) {
    if (!dragJobId || !onReschedule) return;
    onReschedule(dragJobId, targetKey);
    setDragJobId(null);
  }

  function titleForView() {
    if (view === 'today') return 'Today';
    if (view === 'tomorrow') return 'Tomorrow';
    if (view === 'week') return 'This week';
    return 'Calendar';
  }

  return (
    <div className="schedule-views">
      <div className="button-row" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        <button type="button" className={`btn ${view === 'today' ? 'btn-primary' : ''}`} onClick={() => setView('today')}>Today</button>
        <button type="button" className={`btn ${view === 'tomorrow' ? 'btn-primary' : ''}`} onClick={() => setView('tomorrow')}>Tomorrow</button>
        <button type="button" className={`btn ${view === 'week' ? 'btn-primary' : ''}`} onClick={() => setView('week')}>This week</button>
        <button type="button" className={`btn ${view === 'calendar' ? 'btn-primary' : ''}`} onClick={() => setView('calendar')}>Calendar</button>
      </div>

      {view !== 'calendar' ? (
        <section>
          <h3 style={{ marginBottom: 14 }}>{titleForView()}</h3>
          {visibleJobs.length === 0 ? (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>No work scheduled.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {visibleJobs.map((job) => (
                <ScheduleCard
                  key={job.id}
                  job={job}
                  workerNames={workerNames}
                  canAssign={canAssign}
                  onAssign={onAssign}
                  onReschedule={onReschedule}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {view === 'calendar' ? (
        <section>
          <div className="button-row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => setCalendarAnchor(addDays(calendarAnchor, -7))}>Previous</button>
            <button type="button" className="btn" onClick={() => setCalendarAnchor(new Date())}>Today</button>
            <button type="button" className="btn" onClick={() => setCalendarAnchor(addDays(calendarAnchor, 7))}>Next</button>
          </div>
          <div className="schedule-calendar-grid">
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const dayJobs = scheduled.filter((job) => jobDateKey(job) === key);
              return (
                <div
                  key={key}
                  className="schedule-day-cell"
                  onDragOver={(event) => canAssign && event.preventDefault()}
                  onDrop={() => handleDrop(key)}
                >
                  <div className="schedule-day-label">{day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  {dayJobs.length === 0 ? <p className="muted">No work</p> : null}
                  {dayJobs.map((job) => (
                    <div
                      key={job.id}
                      className="schedule-job-chip"
                      draggable={canAssign && Boolean(onReschedule)}
                      onDragStart={() => setDragJobId(job.id)}
                      onDragEnd={() => setDragJobId(null)}
                    >
                      <Link href={`/jobs/${job.id}`}>{job.title}</Link>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {unscheduled.length > 0 ? (
        <details className="card" style={{ marginTop: 18 }}>
          <summary><strong>Unscheduled ({unscheduled.length})</strong></summary>
          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            {unscheduled.map((job) => (
              <div key={job.id} className="list-row">
                <Link href={`/jobs/${job.id}`}>{job.title}</Link>
                {canAssign && onReschedule ? (
                  <input className="input" type="date" onChange={(event) => event.target.value && onReschedule(job.id, event.target.value)} />
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ScheduleCard({
  job,
  workerNames,
  canAssign,
  onAssign,
  onReschedule
}: {
  job: ScheduleJob;
  workerNames: Record<string, string>;
  canAssign: boolean;
  onAssign?: (jobId: string, workerId: string | null) => void;
  onReschedule?: (jobId: string, dateKey: string) => void;
}) {
  return (
    <article className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ marginBottom: 6 }}>{job.title}</h3>
          <p style={{ marginBottom: 4 }}>{job.customer_name || 'No customer'}</p>
          <p className="muted" style={{ marginBottom: 4 }}>
            {formatScheduleTimeRange(job.scheduled_start, job.scheduled_end, job.start_date, job.due_date)}
          </p>
          {job.address ? <p className="muted" style={{ marginBottom: 0 }}>{job.address}</p> : null}
        </div>
        <StatusPill status={job.status} />
      </div>

      <div className="button-row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" href={`/jobs/${job.id}`}>{actionLabel(job.status)}</Link>
        {job.address ? (
          <a className="btn" href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer">Maps</a>
        ) : null}
        {job.phone ? <a className="btn" href={`tel:${job.phone}`}>Call</a> : null}
      </div>

      <details style={{ marginTop: 14 }}>
        <summary><strong>More</strong></summary>
        <div className="form" style={{ marginTop: 12 }}>
          {canAssign && onReschedule ? (
            <>
              <label>Date</label>
              <input
                className="input"
                type="date"
                defaultValue={jobDateKey(job) || ''}
                onChange={(event) => event.target.value && onReschedule(job.id, event.target.value)}
              />
            </>
          ) : null}
          {canAssign && onAssign ? (
            <>
              <label>Worker</label>
              <select className="input" value={job.assigned_to || ''} onChange={(event) => onAssign(job.id, event.target.value || null)}>
                <option value="">Needs worker</option>
                {Object.entries(workerNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </>
          ) : (
            <p className="muted">{job.assigned_to ? workerNames[job.assigned_to] || 'Assigned' : 'Needs worker'}</p>
          )}
        </div>
      </details>
    </article>
  );
}
