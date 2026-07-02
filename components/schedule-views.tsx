'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatScheduleTimeRange } from '@/lib/schedule-times';

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
};

type ScheduleViewsProps = {
  jobs: ScheduleJob[];
  workerNames: Record<string, string>;
  canAssign: boolean;
  onAssign?: (jobId: string, workerId: string | null) => void;
  onReschedule?: (jobId: string, dateKey: string) => void;
};

type ViewMode = 'calendar' | 'day' | 'week' | 'list';

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function jobDateKey(job: ScheduleJob): string | null {
  if (job.start_date) return job.start_date;
  if (job.due_date) return job.due_date;
  if (job.scheduled_start) return job.scheduled_start.slice(0, 10);
  return null;
}

export function ScheduleViews({ jobs, workerNames, canAssign, onAssign, onReschedule }: ScheduleViewsProps) {
  const [view, setView] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [dragJobId, setDragJobId] = useState<string | null>(null);

  const scheduled = useMemo(
    () =>
      jobs
        .filter((j) => jobDateKey(j))
        .sort((a, b) => (jobDateKey(a) || '').localeCompare(jobDateKey(b) || '')),
    [jobs]
  );

  const unscheduled = useMemo(() => jobs.filter((j) => !jobDateKey(j)), [jobs]);

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
  const jobsForDay = scheduled.filter((j) => jobDateKey(j) === dayKey);

  function handleDrop(targetKey: string) {
    if (!dragJobId || !onReschedule) return;
    onReschedule(dragJobId, targetKey);
    setDragJobId(null);
  }

  function JobChip({ job }: { job: ScheduleJob }) {
    return (
      <div
        className="schedule-job-chip"
        draggable={canAssign && Boolean(onReschedule)}
        onDragStart={() => setDragJobId(job.id)}
        onDragEnd={() => setDragJobId(null)}
      >
        <Link href={`/jobs/${job.id}`}>{job.title}</Link>
      </div>
    );
  }

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
        <button type="button" className="btn" onClick={() => setAnchor(new Date(anchor.getTime() - 86400000 * 7))}>
          Prev
        </button>
        <button type="button" className="btn" onClick={() => setAnchor(new Date())}>
          Today
        </button>
        <button type="button" className="btn" onClick={() => setAnchor(new Date(anchor.getTime() + 86400000 * 7))}>
          Next
        </button>
      </div>

      {unscheduled.length > 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h4>Unscheduled jobs</h4>
          <p className="muted">Drag a job onto a day below, or set dates on the job detail page.</p>
          <div className="inline-actions">
            {unscheduled.map((j) => (
              <div
                key={j.id}
                className="schedule-job-chip"
                draggable={canAssign && Boolean(onReschedule)}
                onDragStart={() => setDragJobId(j.id)}
                onDragEnd={() => setDragJobId(null)}
              >
                <Link href={`/jobs/${j.id}`}>{j.title}</Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {view === 'calendar' && (
        <div className="schedule-calendar-grid">
          {weekDays.map((d) => {
            const key = dateKey(d);
            const dayJobs = scheduled.filter((j) => jobDateKey(j) === key);
            return (
              <div
                key={key}
                className="schedule-day-cell"
                onDragOver={(e) => canAssign && e.preventDefault()}
                onDrop={() => handleDrop(key)}
              >
                <div className="schedule-day-label">{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                {dayJobs.map((j) => (
                  <JobChip key={j.id} job={j} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {view === 'day' && (
        <div className="card">
          <h4>{anchor.toLocaleDateString()}</h4>
          {jobsForDay.length === 0 && <p className="muted">No scheduled work yet.</p>}
          {jobsForDay.map((j) => (
            <ScheduleRow key={j.id} job={j} workerNames={workerNames} canAssign={canAssign} onAssign={onAssign} onReschedule={onReschedule} />
          ))}
        </div>
      )}

      {view === 'week' && (
        <div className="schedule-week-grid">
          {weekDays.map((d) => {
            const key = dateKey(d);
            const dayJobs = scheduled.filter((j) => jobDateKey(j) === key);
            return (
              <div
                key={key}
                className="schedule-week-col"
                onDragOver={(e) => canAssign && e.preventDefault()}
                onDrop={() => handleDrop(key)}
              >
                <strong>{d.toLocaleDateString(undefined, { weekday: 'short' })}</strong>
                {dayJobs.map((j) => (
                  <JobChip key={j.id} job={j} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {view === 'list' && (
        <div className="card">
          <h4>Upcoming jobs</h4>
          {scheduled.length === 0 && <p className="muted">No scheduled work yet.</p>}
          {scheduled.slice(0, 20).map((j) => (
            <ScheduleRow key={j.id} job={j} workerNames={workerNames} canAssign={canAssign} onAssign={onAssign} onReschedule={onReschedule} />
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
    <div className="list-row schedule-row">
      <div>
        <Link href={`/jobs/${job.id}`}>{job.title}</Link>
        <p className="muted">
          {formatScheduleTimeRange(job.scheduled_start, job.scheduled_end, job.start_date, job.due_date)} ·{' '}
          {job.customer_name || 'No customer'}
        </p>
      </div>
      <div className="inline-actions">
        {canAssign && onReschedule ? (
          <input
            className="input"
            type="date"
            defaultValue={jobDateKey(job) || ''}
            onChange={(e) => onReschedule(job.id, e.target.value)}
          />
        ) : null}
        {canAssign && onAssign ? (
          <select
            className="input"
            value={job.assigned_to || ''}
            onChange={(e) => onAssign(job.id, e.target.value || null)}
          >
            <option value="">Needs assignment</option>
            {Object.entries(workerNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        ) : (
          <span>{job.assigned_to ? workerNames[job.assigned_to] || 'Assigned' : 'Needs assignment'}</span>
        )}
      </div>
    </div>
  );
}
