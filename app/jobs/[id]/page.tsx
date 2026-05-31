'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { StatusPill } from '@/components/status-pill';
import { PhotoUpload } from '@/components/photo-upload';
import { normalizePlan, photoUploadAllowed, type EverittosPlan } from '@/lib/everittos-plans';
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
  created_at: string | null;
};

type TimelineEntry = {
  id: string;
  message: string | null;
  event_type: string;
  created_at: string | null;
};

export default function JobDetailPage({ params }: PageProps) {
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [canEditStatus, setCanEditStatus] = useState(false);
  const [loading, setLoading] = useState(true);
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
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const role = normalizeRole(profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setCanEditStatus(isOwnerOrAdmin(role) || isStaffRole(role));

    const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    const { data: notes } = await supabase
      .from('job_timeline')
      .select('id, message, event_type, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setJob(data);
    setTimeline(notes || []);
  }

  async function updateStatus(status: string) {
    const { error } = await supabase.from('jobs').update({ status }).eq('id', jobId);
    if (error) {
      alert(error.message);
      return;
    }
    loadJob();
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
          <div className="card">{message || 'Job not found.'}</div>
        </main>
      </div>
    );
  }

  const uploadsEnabled = photoUploadAllowed(plan);

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

        <div className="grid-2">
          <div className="card">
            <h3>Job details</h3>
            <p><strong>Customer:</strong> {job.customer_name || 'No customer'}</p>
            <p><strong>Phone:</strong> {job.phone || 'No phone'}</p>
            <p><strong>Notes:</strong> {job.notes || 'No notes'}</p>
            <p><strong>Created:</strong> {job.created_at ? new Date(job.created_at).toLocaleString() : 'Just created'}</p>

            {canEditStatus && (
              <div className="form" style={{ marginTop: 16 }}>
                <button className="btn" type="button" onClick={() => updateStatus('in_progress')}>Start job</button>
                <button className="btn btn-primary" type="button" onClick={() => updateStatus('completed')}>Mark completed</button>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Photos</h3>
            <PhotoUpload jobId={job.id} userId={job.user_id} disabled={!uploadsEnabled} onUploaded={loadJob} />
            <button className="btn" type="button" onClick={() => window.print()}>Print report</button>
          </div>
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
