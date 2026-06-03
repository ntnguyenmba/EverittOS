'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type ScheduleJob = {
  id: string;
  title: string;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
  customer_name: string | null;
};

type ScheduleViewsProps = {
  jobs: ScheduleJob[];
  workerNames: Record<string, string>;
  canAssign: boolean;
  onAssign?: (jobId: string, workerId: string | null) => void;
};

type ViewMode = 'calendar' | 'day' | 'week' | 'list';

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ScheduleViews({ jobs, workerNames, canAssign, onAssign }: ScheduleViewsProps) {
  const [view, setView] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(() => new Date());

  const scheduled = useMemo(
    () => jobs.filter((j) => j.start_date || j.due_date).sort((a, b) => (a.due_date || a.start_date || '').localeCompare(b.due_date || b.start_date || '')),
    [jobs]
  );

  const weekDays = useMemo(() => {
    const start = new Date(anchor);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [anchor]);

  const dayKey = dateKey(anchor);

  const jobsForDay = scheduled.filter((j) => j.start_date === dayKey || j.due_date === dayKey);

  return (
    <div className="schedule-views">
      <div className="schedule-toolbar">
        <button type="button" className={`btn ${view === 'calendar' ? 'btn-primary' : ''}`} onClick={() => setView('calendar')}>
          Calendar
        </button>
        <button type="button" className={`btn ${view === 'day' ? 'btn-primary' : ''}`} onClick={() => setView('day')}>
          Day
        </button>
        <button type="button" className={`btn ${view === 'week' ? 'btn-primary' : ''}`} onClick={() => setView('week')}>
          Week
        </button>
        <button type="button" className={`btn ${view === 'list' ? 'btn-primary' : ''}`} onClick={() => setView('list')}>
          Upcoming
        </button>
        <button type="button" className="btn" onClick={() => setAnchor(new Date(anchor.getTime() - 86400000))}>
          Prev
        </button>
        <button type="button" className="btn" onClick={() => setAnchor(new Date())}>
          Today
        </button>
        <button type="button" className="btn" onClick={() => setAnchor(new Date(anchor.getTime() + 86400000))}>
          Next
        </button>
      </div>

      {view === 'calendar' && (
        <div className="schedule-calendar-grid">
          {weekDays.map((d) => {
            const key = dateKey(d);
            const dayJobs = scheduled.filter((j) => j.start_date === key || j.due_date === key);
            return (
              <div key={key} className="schedule-day-cell">
                <div className="schedule-day-label">{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                {dayJobs.map((j) => (
                  <Link key={j.id} href={`/jobs/${j.id}`} className="schedule-job-chip">
                    {j.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {view === 'day' && (
        <div className="card">
          <h4>{anchor.toLocaleDateString()}</h4>
          {jobsForDay.length === 0 && <p>No jobs scheduled this day.</p>}
          {jobsForDay.map((j) => (
            <ScheduleRow key={j.id} job={j} workerNames={workerNames} canAssign={canAssign} onAssign={onAssign} />
          ))}
        </div>
      )}

      {view === 'week' && (
        <div className="schedule-week-grid">
          {weekDays.map((d) => {
            const key = dateKey(d);
            const dayJobs = scheduled.filter((j) => j.start_date === key || j.due_date === key);
            return (
              <div key={key} className="schedule-week-col">
                <strong>{d.toLocaleDateString(undefined, { weekday: 'short' })}</strong>
                {dayJobs.map((j) => (
                  <Link key={j.id} href={`/jobs/${j.id}`} className="schedule-job-chip">
                    {j.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {view === 'list' && (
        <div className="card">
          <h4>Upcoming jobs</h4>
          {scheduled.length === 0 && <p>No scheduled jobs.</p>}
          {scheduled.slice(0, 20).map((j) => (
            <ScheduleRow key={j.id} job={j} workerNames={workerNames} canAssign={canAssign} onAssign={onAssign} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleRow({
  job,
  workerNames,
  canAssign,
  onAssign
}: {
  job: ScheduleJob;
  workerNames: Record<string, string>;
  canAssign: boolean;
  onAssign?: (jobId: string, workerId: string | null) => void;
}) {
  return (
    <div className="list-row schedule-row">
      <div>
        <Link href={`/jobs/${job.id}`}>{job.title}</Link>
        <p className="muted">
          {job.start_date || 'No start'} to {job.due_date || 'No due'} · {job.customer_name || 'No customer'}
        </p>
      </div>
      {canAssign && onAssign ? (
        <select
          className="input"
          value={job.assigned_to || ''}
          onChange={(e) => onAssign(job.id, e.target.value || null)}
        >
          <option value="">Unassigned</option>
          {Object.entries(workerNames).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      ) : (
        <span>{job.assigned_to ? workerNames[job.assigned_to] || 'Assigned' : 'Unassigned'}</span>
      )}
    </div>
  );
}
