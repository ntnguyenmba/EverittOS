'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { StatusPill } from '@/components/status-pill';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { fetchPhotoCountsByJobIds } from '@/lib/job-photo-counts';
import { scopeJobsForWorkspace } from '@/lib/jobs-query';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  address: string | null;
  status: string | null;
  photo_count?: number;
};

export default function PhotosPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?next=/photos');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const org = await fetchOrganizationContext(user.id);
      const workspaceRole = normalizeRole(org?.role || profile?.role);
      setPlan(normalizePlan(profile?.plan));
      setRole(workspaceRole);

      const query = scopeJobsForWorkspace(
        supabase
          .from('jobs')
          .select('id, title, customer_name, address, status')
          .order('created_at', { ascending: false }),
        user.id,
        org?.organizationId,
        workspaceRole
      );

      const [{ data }, orgIsDemo] = await Promise.all([
        query,
        fetchOrganizationIsDemo(supabase, org?.organizationId)
      ]);

      const rows = filterDemoSeedJobs((data || []) as Job[], orgIsDemo);
      const photoCounts = await fetchPhotoCountsByJobIds(rows.map((job) => job.id));
      setJobs(rows.map((job) => ({ ...job, photo_count: photoCounts[job.id] || 0 })));
      setLoading(false);
    }

    void load();
  }, [router]);

  const jobsNeedingPhotos = jobs.filter((job) => (job.photo_count || 0) === 0);
  const jobsWithPhotos = jobs.filter((job) => (job.photo_count || 0) > 0);

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader
        title="Before & after photos"
        subtitle="Upload before photos, after photos, and progress photos from each job record."
        action={
          <Link className="btn btn-primary" href="/jobs/new">
            Create job
          </Link>
        }
      />

      <section className="card photos-hub-card">
        <div className="photos-hub-grid">
          <div>
            <h3>Upload photos from a job</h3>
            <p className="muted">
              Choose a job below, then open its Before & After Photos section to upload from your phone camera or desktop.
            </p>
          </div>
          <Link className="btn" href="/jobs">
            View all jobs
          </Link>
        </div>
      </section>

      <section className="card photos-hub-card">
        <h3>Needs before/after photos ({jobsNeedingPhotos.length})</h3>
        {loading ? <p className="loading-state">Loading jobs...</p> : null}
        {!loading && jobsNeedingPhotos.length === 0 ? <p className="muted">All current jobs have photos attached.</p> : null}
        <div className="photos-job-list">
          {jobsNeedingPhotos.map((job) => (
            <Link key={job.id} className="photos-job-row" href={`/jobs/${job.id}#before-after-photos`}>
              <span>
                <strong>{job.title}</strong>
                <small>{job.customer_name || job.address || 'No customer added'}</small>
              </span>
              <span className="photos-job-meta">
                <StatusPill status={job.status} />
                <span>Upload</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card photos-hub-card">
        <h3>Jobs with photos ({jobsWithPhotos.length})</h3>
        {!loading && jobsWithPhotos.length === 0 ? <p className="muted">No uploaded job photos yet.</p> : null}
        <div className="photos-job-list">
          {jobsWithPhotos.map((job) => (
            <Link key={job.id} className="photos-job-row" href={`/jobs/${job.id}#before-after-photos`}>
              <span>
                <strong>{job.title}</strong>
                <small>{job.customer_name || job.address || 'No customer added'}</small>
              </span>
              <span className="photos-job-meta">
                <StatusPill status={job.status} />
                <span>{job.photo_count} photo{job.photo_count === 1 ? '' : 's'}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
