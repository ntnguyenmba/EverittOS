'use client';

import Link from 'next/link';
import { GoToDashboardLink } from '@/components/go-to-dashboard-link';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhotoUpload } from '@/components/photo-upload';
import { normalizePlan, photoUploadAllowed } from '@/lib/everittos-plans';
import { limitsForPlan } from '@/lib/everittos-limits';
import { isContractorRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type AssignedJob = {
  id: string;
  title: string;
  status: string | null;
  due_date: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  address: string | null;
  customer_name: string | null;
  phone?: string | null;
  notes?: string | null;
  user_id: string;
};

function formatVisit(job: AssignedJob) {
  if (!job.scheduled_start) return job.due_date || 'Date not set';
  const start = new Date(job.scheduled_start);
  const end = job.scheduled_end ? new Date(job.scheduled_end) : null;
  const date = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endTime = end ? end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  return `${date} ${startTime}${endTime ? ` to ${endTime}` : ''}`;
}

export default function ContractorPortalPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<AssignedJob[]>([]);
  const [plan, setPlan] = useState(normalizePlan('free'));
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/portal/contractor');
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase.from('profiles').select('role, plan').eq('id', user.id).maybeSingle();
      const role = normalizeRole(profile?.role);
      const p = normalizePlan(profile?.plan);
      setPlan(p);

      if (!isContractorRole(role) && !limitsForPlan(p).contractorPortal) {
        setMessage('Contractor portal requires Growth plan or a contractor role.');
        setLoading(false);
        return;
      }

      const { data: worker } = await supabase.from('workers').select('id').eq('auth_user_id', user.id).maybeSingle();

      let jobRows: AssignedJob[] = [];

      if (worker?.id) {
        const { data: assignments } = await supabase.from('job_assignments').select('job_id').eq('worker_id', worker.id);
        const ids = (assignments || []).map((a: { job_id: string }) => a.job_id);
        if (ids.length) {
          const { data } = await supabase
            .from('jobs')
            .select('id, title, status, due_date, scheduled_start, scheduled_end, address, customer_name, phone, notes, user_id')
            .in('id', ids);
          jobRows = (data || []) as AssignedJob[];
        }

        const { data: direct } = await supabase
          .from('jobs')
          .select('id, title, status, due_date, scheduled_start, scheduled_end, address, customer_name, phone, notes, user_id')
          .eq('assigned_to', worker.id);
        const merged = new Map<string, AssignedJob>();
        [...jobRows, ...((direct || []) as AssignedJob[])].forEach((j) => merged.set(j.id, j));
        jobRows = Array.from(merged.values());
      }

      setJobs(jobRows);
      setLoading(false);
    }
    load();
  }, [router]);

  async function updateStatus(jobId: string, status: string) {
    await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    router.refresh();
  }

  return (
    <AuthenticatedSection role="contractor">
        <h2>My Jobs</h2>
        <p className="muted">Assigned work only: customer, address, date, time, notes, photos, start, and complete.</p>

        {loading && <div className="card">Loading...</div>}
        {message && <div className="card">{message}</div>}
        {!loading && !message && jobs.length === 0 && <div className="card">No assigned jobs yet.</div>}

        {jobs.map((job) => (
          <div key={job.id} className="card" style={{ marginTop: 16 }}>
            <p className="muted">{formatVisit(job)}</p>
            <h3>{job.title}</h3>
            <p><strong>Customer:</strong> {job.customer_name || 'Not set'}</p>
            <p><strong>Phone:</strong> {job.phone || 'Not set'}</p>
            <p><strong>Address:</strong> {job.address || 'Not set'}</p>
            <p><strong>Notes:</strong> {job.notes || 'No notes'}</p>
            <p><strong>Status:</strong> {job.status || 'new'}</p>
            <div className="inline-actions">
              <button type="button" className="btn" onClick={() => updateStatus(job.id, 'in_progress')}>
                Start
              </button>
              <button type="button" className="btn btn-primary" onClick={() => updateStatus(job.id, 'completed')}>
                Complete
              </button>
              <Link className="btn" href={`/jobs/${job.id}`}>
                Details
              </Link>
            </div>
            {photoUploadAllowed(plan) && (
              <PhotoUpload jobId={job.id} userId={job.user_id} disabled={false} />
            )}
          </div>
        ))}

        <GoToDashboardLink role="contractor" className="btn" style={{ marginTop: 24 }}>
          Back to dashboard
        </GoToDashboardLink>
    </AuthenticatedSection>
  );
}
