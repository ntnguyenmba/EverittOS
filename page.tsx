import { Sidebar } from '@/components/sidebar';
import { jobs } from '@/lib/jobs';
import { StatusPill } from '@/components/status-pill';
import Link from 'next/link';

export default function JobsPage() {
  return <div className="dashboard-shell"><Sidebar /><main className="main"><div className="page-head"><div><h2>Jobs</h2><p>Live work orders with worker, due date, and proof status.</p></div><Link className="btn btn-primary" href="/dashboard">Create job</Link></div><div className="card"><table className="table"><thead><tr><th>Job</th><th>Worker</th><th>Due</th><th>Status</th></tr></thead><tbody>{jobs.map(job => <tr key={job.id}><td><Link href={`/jobs/${job.id}`}>{job.title}</Link><br /><small>{job.property}</small></td><td>{job.worker}</td><td>{job.due}</td><td><StatusPill status={job.status} /></td></tr>)}</tbody></table></div></main></div>;
}
