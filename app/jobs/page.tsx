'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { StatusPill } from '@/components/status-pill';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { filterDemoSeedJobs } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { fetchPhotoCountsByJobIds } from '@/lib/job-photo-counts';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  customer_id: string | null;
  address: string | null;
  status: string | null;
  photo_count?: number;
};

function JobsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerFilter = searchParams.get('customer');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));

      const org = await fetchOrganizationContext(user.id);
      let query = supabase
        .from('jobs')
        .select('id, title, customer_name, customer_id, address, status')
        .order('created_at', { ascending: false });

      if (org?.organizationId) {
        query = query.eq('organization_id', org.organizationId);
      } else {
        query = query.eq('user_id', user.id);
      }

      if (customerFilter) {
        query = query.eq('customer_id', customerFilter);
      }

      const [{ data }, orgIsDemo] = await Promise.all([
        query,
        fetchOrganizationIsDemo(supabase, org?.organizationId)
      ]);
      const rows = filterDemoSeedJobs(data || [], orgIsDemo);
      const photoCounts = await fetchPhotoCountsByJobIds(rows.map((j) => j.id));
      setJobs(rows.map((j) => ({ ...j, photo_count: photoCounts[j.id] || 0 })));
      setLoading(false);
    }

    load();
  }, [router, customerFilter]);

  return (
    <AppShell plan={plan}>
        <div className="page-head">
          <div>
            <h2>Jobs</h2>
            <p>All jobs you can access based on your role.</p>
          </div>
          <Link className="btn btn-primary" href="/dashboard">
            New job
          </Link>
        </div>

        <div className="card">
          {loading ? <p className="loading-state" role="status">Loading jobs…</p> : null}
          {!loading && jobs.length === 0 ? <LocalizedEmptyState emptyKey="jobs" /> : null}
          {!loading && jobs.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      {job.title}
                      {job.photo_count ? (
                        <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                          {job.photo_count} photo{job.photo_count === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </td>
                    <td>{job.customer_name || 'Not set'}</td>
                    <td>{job.address || 'Not set'}</td>
                    <td>
                      <StatusPill status={job.status} />
                    </td>
                    <td>
                      <Link className="btn" href={`/jobs/${job.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
    </AppShell>
  );
}

export default function JobsPage() {
  return (
    <Suspense>
      <JobsList />
    </Suspense>
  );
}
