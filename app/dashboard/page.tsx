import { Sidebar } from '@/components/sidebar';
import { DashboardStats } from '@/components/dashboard-stats';
import { JobCard } from '@/components/job-card';
import { JobCreator } from '@/components/job-creator';
import { jobs } from '@/lib/jobs';

export default function DashboardPage() {
  return <div className="dashboard-shell"><Sidebar /><main className="main"><div className="page-head"><div><h2>Manager Dashboard</h2><p>Assign jobs, track crews, and verify work from one place.</p></div></div><DashboardStats /><div className="grid-2" style={{ marginTop: 18 }}><JobCreator /><div className="workflow">{jobs.map(job => <JobCard key={job.id} job={job} />)}</div></div></main></div>;
}
