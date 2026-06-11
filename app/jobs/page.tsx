'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/empty-state';
import { EMPTY_COPY } from '@/lib/empty-copy';
import { StatusPill } from '@/components/status-pill';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  customer_id: string | null;
  address: string | null;
  status: string | null;
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

      let query = supabase
        .from('jobs')
        .select('id, title, customer_name, customer_id, address, status')
        .order('created_at', { ascending: false });

      if (customerFilter) {
        query = query.eq('customer_id', customerFilter);
      }

      const { data } = await query;

      setJobs(data || []);
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
          {!loading && jobs.length === 0 ? (
            <EmptyState
              title={EMPTY_COPY.jobs.title}
              description={EMPTY_COPY.jobs.description}
              action={
                <Link className="btn btn-primary" href="/dashboard">
                  Create a job
                </Link>
              }
            />
          ) : null}
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
                    <td>{job.title}</td>
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
