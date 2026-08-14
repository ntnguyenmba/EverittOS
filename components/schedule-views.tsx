'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { StatusPill } from '@/components/status-pill';
import {
  isActiveScheduleJob,
  partitionScheduleJobs,
  scheduleJobDateKey
} from '@/lib/schedule-classification';
import { formatLocalDate, formatScheduleTimeRange } from '@/lib/schedule-times';

const copy = {
  en: {
    today: 'Today', tomorrow: 'Tomorrow', week: 'This week', calendar: 'Calendar', noWorkScheduled: 'No work scheduled.',
    previous: 'Previous', next: 'Next', noWork: 'No work', unscheduled: 'Unscheduled', noCustomer: 'No customer',
    continue: 'Continue', start: 'Start', maps: 'Maps', call: 'Call', more: 'More', date: 'Date', worker: 'Worker',
    needsWorker: 'Needs worker', assigned: 'Assigned'
  },
  es: {
    today: 'Hoy', tomorrow: 'Mañana', week: 'Esta semana', calendar: 'Calendario', noWorkScheduled: 'No hay trabajo programado.',
    previous: 'Anterior', next: 'Siguiente', noWork: 'Sin trabajo', unscheduled: 'Sin programar', noCustomer: 'Sin cliente',
    continue: 'Continuar', start: 'Comenzar', maps: 'Mapa', call: 'Llamar', more: 'Más', date: 'Fecha', worker: 'Trabajador',
    needsWorker: 'Necesita trabajador', assigned: 'Asignado'
  },
  vi: {
    today: 'Hôm nay', tomorrow: 'Ngày mai', week: 'Tuần này', calendar: 'Lịch', noWorkScheduled: 'Không có công việc nào được lên lịch.',
    previous: 'Trước', next: 'Tiếp', noWork: 'Không có công việc', unscheduled: 'Chưa lên lịch', noCustomer: 'Không có khách hàng',
    continue: 'Tiếp tục', start: 'Bắt đầu', maps: 'Bản đồ', call: 'Gọi', more: 'Thêm', date: 'Ngày', worker: 'Nhân viên',
    needsWorker: 'Cần nhân viên', assigned: 'Đã phân công'
  }
} as const;

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
  return scheduleJobDateKey(job);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function ScheduleViews({ jobs, workerNames, canAssign, onAssign, onReschedule }: ScheduleViewsProps) {
  const { locale } = useTranslation();
  const text = copy[locale];
  const [view, setView] = useState<ViewMode>('today');
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const [dragJobId, setDragJobId] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);
  const tomorrowKey = dateKey(addDays(today, 1));
  const weekEndKey = dateKey(addDays(today, 6));

  const partitions = useMemo(
    () => partitionScheduleJobs(jobs, todayKey, tomorrowKey, weekEndKey),
    [jobs, todayKey, tomorrowKey, weekEndKey]
  );
  const scheduled = useMemo(
    () =>
      partitions.active
        .filter((job) => jobDateKey(job))
        .sort((a, b) => (jobDateKey(a) || '').localeCompare(jobDateKey(b) || '')),
    [partitions.active]
  );
  const unscheduled = partitions.unscheduled;

  const visibleJobs = useMemo(() => {
    if (view === 'today') return partitions.today;
    if (view === 'tomorrow') return partitions.tomorrow;
    if (view === 'week') return partitions.week;
    return [];
  }, [partitions, view]);

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
    if (view === 'today') return text.today;
    if (view === 'tomorrow') return text.tomorrow;
    if (view === 'week') return text.week;
    return text.calendar;
  }

  return (
    <div className="schedule-views">
      <div className="button-row" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        <button type="button" className={`btn ${view === 'today' ? 'btn-primary' : ''}`} onClick={() => setView('today')}>{text.today}</button>
        <button type="button" className={`btn ${view === 'tomorrow' ? 'btn-primary' : ''}`} onClick={() => setView('tomorrow')}>{text.tomorrow}</button>
        <button type="button" className={`btn ${view === 'week' ? 'btn-primary' : ''}`} onClick={() => setView('week')}>{text.week}</button>
        <button type="button" className={`btn ${view === 'calendar' ? 'btn-primary' : ''}`} onClick={() => setView('calendar')}>{text.calendar}</button>
      </div>

      {view !== 'calendar' ? (
        <section>
          <h3 style={{ marginBottom: 14 }}>{titleForView()}</h3>
          {visibleJobs.length === 0 ? (
            <div className="card"><p className="muted" style={{ margin: 0 }}>{text.noWorkScheduled}</p></div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {visibleJobs.map((job) => (
                <ScheduleCard key={job.id} job={job} workerNames={workerNames} canAssign={canAssign} onAssign={onAssign} onReschedule={onReschedule} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {view === 'calendar' ? (
        <section>
          <div className="button-row" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => setCalendarAnchor(addDays(calendarAnchor, -7))}>{text.previous}</button>
            <button type="button" className="btn" onClick={() => setCalendarAnchor(new Date())}>{text.today}</button>
            <button type="button" className="btn" onClick={() => setCalendarAnchor(addDays(calendarAnchor, 7))}>{text.next}</button>
          </div>
          <div className="schedule-calendar-grid">
            {calendarDays.map((day) => {
              const key = dateKey(day);
              const dayJobs = scheduled.filter((job) => jobDateKey(job) === key);
              return (
                <div key={key} className="schedule-day-cell" onDragOver={(event) => canAssign && event.preventDefault()} onDrop={() => handleDrop(key)}>
                  <div className="schedule-day-label">{day.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  {dayJobs.length === 0 ? <p className="muted">{text.noWork}</p> : null}
                  {dayJobs.map((job) => (
                    <div key={job.id} className="schedule-job-chip" draggable={canAssign && Boolean(onReschedule)} onDragStart={() => setDragJobId(job.id)} onDragEnd={() => setDragJobId(null)}>
                      <Link href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer">{job.title}</Link>
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
          <summary><strong>{text.unscheduled} ({unscheduled.length})</strong></summary>
          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            {unscheduled.map((job) => (
              <div key={job.id} className="list-row">
                <Link href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer">{job.title}</Link>
                {canAssign && onReschedule ? <input className="input" type="date" onChange={(event) => event.target.value && onReschedule(job.id, event.target.value)} /> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ScheduleCard({ job, workerNames, canAssign, onAssign, onReschedule }: {
  job: ScheduleJob;
  workerNames: Record<string, string>;
  canAssign: boolean;
  onAssign?: (jobId: string, workerId: string | null) => void;
  onReschedule?: (jobId: string, dateKey: string) => void;
}) {
  const { locale } = useTranslation();
  const text = copy[locale];
  const status = String(job.status || 'new').toLowerCase();
  const actionLabel = status === 'in_progress' || status === 'in progress' || status === 'started' ? text.continue : text.start;

  return (
    <article className="card open-in-new-tab-card">
      <Link href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer" className="record-card-overlay-link" aria-label={`Open ${job.title} in a new tab`}><span className="record-card-overlay-label">Open {job.title} in a new tab</span></Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ marginBottom: 6 }}>{job.title}</h3>
          <p style={{ marginBottom: 4 }}>{job.customer_name || text.noCustomer}</p>
          <p className="muted" style={{ marginBottom: 4 }}>{formatScheduleTimeRange(job.scheduled_start, job.scheduled_end, job.start_date, job.due_date)}</p>
          {job.address ? <p className="muted" style={{ marginBottom: 0 }}>{job.address}</p> : null}
        </div>
        <StatusPill status={job.status} />
      </div>

      <div className="button-row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer">{actionLabel}</Link>
        {job.address ? <a className="btn" href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer">{text.maps}</a> : null}
        {job.phone ? <a className="btn" href={`tel:${job.phone}`}>{text.call}</a> : null}
      </div>

      <details style={{ marginTop: 14 }}>
        <summary><strong>{text.more}</strong></summary>
        <div className="form" style={{ marginTop: 12 }}>
          {canAssign && onReschedule ? <><label>{text.date}</label><input className="input" type="date" defaultValue={jobDateKey(job) || ''} onChange={(event) => event.target.value && onReschedule(job.id, event.target.value)} /></> : null}
          {canAssign && onAssign ? <><label>{text.worker}</label><select className="input" value={job.assigned_to || ''} onChange={(event) => onAssign(job.id, event.target.value || null)}><option value="">{text.needsWorker}</option>{Object.entries(workerNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></> : <p className="muted">{job.assigned_to ? workerNames[job.assigned_to] || text.assigned : text.needsWorker}</p>}
        </div>
      </details>
    </article>
  );
}
