'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { fetchOrganizationContext } from '@/lib/organization';
import { scopeJobsForWorkspace } from '@/lib/jobs-query';
import { supabase } from '@/lib/supabase';

type JobOption = { id: string; title: string };

export function ScheduleCreateForm() {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobId, setJobId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadJobs() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/schedule/new');
        return;
      }
      const org = await fetchOrganizationContext(user.id);
      const { data } = await scopeJobsForWorkspace(
        supabase.from('jobs').select('id, title').order('created_at', { ascending: false }),
        user.id,
        org?.organizationId
      );
      setJobs((data || []) as JobOption[]);
      if (data?.[0]?.id) setJobId(data[0].id);
      setLoading(false);
    }
    void loadJobs();
  }, [router]);

  async function saveSchedule() {
    if (!jobId || !startDate || saving) return;
    setSaving(true);

    const res = await fetch('/api/schedule/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        start_date: startDate,
        due_date: dueDate || startDate
      })
    });
    const json = (await res.json()) as { error?: string; message?: string };
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to save schedule.');
      return;
    }

    appFeedback.saved();
    setTimeout(() => router.push('/schedule'), 600);
  }

  if (loading) {
    return <p className="loading-state" role="status">Loading jobs…</p>;
  }

  return (
    <div className="card form">
      <h3 className="card-title-sm">Schedule work</h3>
      {jobs.length === 0 ? (
        <p className="muted">
          No jobs yet. <Link href="/jobs/new">Create a job</Link> first, then schedule it here.
        </p>
      ) : (
        <>
          <label className="auth-field">
            <span>Job</span>
            <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </label>
          <label className="auth-field">
            <span>Start date</span>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="auth-field">
            <span>Due date</span>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary" disabled={saving || !startDate} onClick={() => void saveSchedule()}>
            {saving ? FEEDBACK.loading : 'Save schedule'}
          </button>
        </>
      )}
    </div>
  );
}
