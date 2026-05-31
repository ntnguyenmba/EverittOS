'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { StatusPill } from '@/components/status-pill';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

type Job = {
  id: string;
  title: string;
  customer_name: string | null;
  address: string | null;
  status: string | null;
};

export default function JobsPage() {
  const router = useRouter();
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

      const { data } = await supabase
        .from('jobs')
        .select('id, title, customer_name, address, status')
        .order('created_at', { ascending: false });

      setJobs(data || []);
      setLoading(false);
    }

    load();
  }, [router]);

  return (
    <div className="dashboard-shell">
      <Sidebar plan={plan} />
      <main className="main">
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
          {loading && <p>Loading jobs...</p>}
          {!loading && jobs.length === 0 && <p>No jobs found.</p>}
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
                    <td>{job.customer_name || '—'}</td>
                    <td>{job.address || '—'}</td>
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
      </main>
    </div>
  );
}
