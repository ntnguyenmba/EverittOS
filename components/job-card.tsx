import Link from 'next/link';
import { Job } from '@/lib/jobs';
import { StatusPill } from './status-pill';

export function JobCard({ job }: { job: Job }) {
  return (
    <Link href={`/jobs/${job.id}`} className="card" style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <h3>{job.title}</h3>
        <StatusPill status={job.status} />
      </div>
      <p>{job.property}</p>
      <p>Assigned to {job.worker} · {job.due}</p>
    </Link>
  );
}
