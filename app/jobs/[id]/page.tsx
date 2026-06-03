'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhotoGallery } from '@/components/photo-gallery';
import { PhotoUpload } from '@/components/photo-upload';
import { Sidebar } from '@/components/sidebar';
import { StatusPill } from '@/components/status-pill';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import {
  fetchUsageCounts,
  photoLimitReached,
  reportLimitReached,
  limitMessage
} from '@/lib/everittos-usage';
import { isOwnerOrAdmin, isStaffRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type PageProps = {
  params: Promise<{ id: string }>;
};

type Job = {
  id: string;
  user_id: string;
  title: string;
  customer_name: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: string | null;
  start_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string | null;
};

type Worker = { id: string; name: string };

type TimelineEntry = {
  id: string;
  message: string | null;
  event_type: string;
  created_at: string | null;
};

export default function JobDetailPage({ params }: PageProps) {
  const router = useRouter();
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [canManage, setCanManage] = useState(false);
  const [canEditStatus, setCanEditStatus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);
  const [photoRefresh, setPhotoRefresh] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    params.then((p) => setJobId(p.id));
  }, [params]);

  async function loadJob() {
    if (!jobId) return;
    setLoading(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const role = normalizeRole(profile?.role);
    const userPlan = normalizePlan(profile?.plan);
    setPlan(userPlan);
    setCanManage(isOwnerOrAdmin(role));
    setCanEditStatus(isOwnerOrAdmin(role) || isStaffRole(role));

    const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    const { data: notes } = await supabase
      .from('job_timeline')
      .select('id, message, event_type, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (limitsForPlan(userPlan).crewAssignment) {
      const { data: crew } = await supabase.from('workers').select('id, name').order('name');
      setWorkers(crew || []);
    } else {
      setWorkers([]);
    }

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setJob(data);
    setTimeline(notes || []);
  }

  async function updateStatus(status: string) {
    if (!canEditStatus) return;
    const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId);
    if (error) {
      setMessage(error.message);
      return;
    }
    loadJob();
  }

  async function saveSchedule() {
    if (!job || !canManage || savingSchedule) return;

    setSavingSchedule(true);
    setMessage('');

    const { error } = await supabase
      .from('jobs')
      .update({
        start_date: job.start_date || null,
        due_date: job.due_date || null,
        assigned_to: job.assigned_to || null
      })
      .eq('id', jobId);

    setSavingSchedule(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    loadJob();
  }

  async function createReport() {
    if (!job || creatingReport) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    setCreatingReport(true);
    setMessage('');

    const usage = await fetchUsageCounts(user.id);
    if (reportLimitReached(plan, usage)) {
      setCreatingReport(false);
      setMessage(limitMessage('reports', plan));
      return;
    }

    const { error } = await supabase.from('job_reports').insert({
      user_id: user.id,
      job_id: job.id,
      title: `${job.title} report`
    });

    setCreatingReport(false);

    if (error) {
      if (error.message.includes('PLAN_LIMIT_REPORTS')) {
        setMessage(limitMessage('reports', plan));
      } else {
        setMessage(error.message);
      }
      return;
    }

    router.push(`/jobs/${job.id}/report`);
  }

  useEffect(() => {
    loadJob();
  }, [jobId]);

  if (loading) {
    return (
      <div className="dashboard-shell">
        <Sidebar plan={plan} />
        <main className="main">
          <div className="card">Loading job...</div>
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="dashboard-shell">
        <Sidebar plan={plan} />
        <main className="main">
          <div className="card">{message || 'Job not found or access denied.'}</div>
        </main>
      </div>
    );
  }

  const crewEnabled = limitsForPlan(plan).crewAssignment;

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />
      <main className="main">
        <div className="page-head">
          <div>
            <h2>{job.title}</h2>
            <p>{job.address || 'No address added'}</p>
          </div>
          <StatusPill status={job.status} />
        </div>

        {message && <p className="card">{message}</p>}

        <div className="grid-2">
          <div className="card">
            <h3>Job details</h3>
            <p>
              <strong>Customer:</strong> {job.customer_name || 'Not set'}
            </p>
            <p>
              <strong>Phone:</strong> {job.phone || 'Not set'}
            </p>
            <p>
              <strong>Notes:</strong> {job.notes || 'No notes'}
            </p>
            <p>
              <strong>Created:</strong> {job.created_at ? new Date(job.created_at).toLocaleString() : 'Just created'}
            </p>

            {canEditStatus && (
              <div className="form" style={{ marginTop: 16 }}>
                <button className="btn" type="button" onClick={() => updateStatus('in_progress')}>
                  Start job
                </button>
                <button className="btn btn-primary" type="button" onClick={() => updateStatus('completed')}>
                  Mark completed
                </button>
              </div>
            )}
          </div>

          <div className="card form">
            <h3>Schedule</h3>
            <label>Start date</label>
            <input
              className="input"
              type="date"
              disabled={!canManage}
              value={job.start_date || ''}
              onChange={(e) => setJob({ ...job, start_date: e.target.value })}
            />
            <label>Due date</label>
            <input
              className="input"
              type="date"
              disabled={!canManage}
              value={job.due_date || ''}
              onChange={(e) => setJob({ ...job, due_date: e.target.value })}
            />
            {crewEnabled ? (
              <>
                <label>Assigned worker</label>
                <select
                  className="input"
                  disabled={!canManage}
                  value={job.assigned_to || ''}
                  onChange={(e) => setJob({ ...job, assigned_to: e.target.value || null })}
                >
                  <option value="">Unassigned</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p>Crew assignment is available on the Business plan.</p>
            )}
            {canManage && (
              <button className="btn btn-primary" type="button" onClick={saveSchedule} disabled={savingSchedule}>
                {savingSchedule ? 'Saving...' : 'Save schedule'}
              </button>
            )}
          </div>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Photos</h3>
          <PhotoGallery jobId={job.id} refreshKey={photoRefresh} />
          {canManage && (
            <PhotoUpload
              jobId={job.id}
              userId={job.user_id}
              onUploaded={() => {
                setPhotoRefresh((k) => k + 1);
                loadJob();
              }}
            />
          )}
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Proof report</h3>
          <p>Generate a printable report with job details and photos.</p>
          <button className="btn btn-primary" type="button" onClick={createReport} disabled={creatingReport}>
            {creatingReport ? 'Creating...' : 'Create report'}
          </button>
          <Link className="btn" href={`/jobs/${job.id}/report`} style={{ marginLeft: 8 }}>
            View latest
          </Link>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <h3>Activity</h3>
          {timeline.length === 0 && <p>No timeline entries yet.</p>}
          {timeline.map((entry) => (
            <div key={entry.id} style={{ marginTop: 10 }}>
              <strong>{entry.event_type}</strong>
              <p>{entry.message || 'Update recorded'}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
