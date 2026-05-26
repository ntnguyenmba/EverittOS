import Link from 'next/link';
import { StatusPill } from './status-pill';

export type SupabaseJobCard = {
  id: string;
  title: string;
  customer_name?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export function JobCard({ job }: { job: SupabaseJobCard }) {
  const status = job.status || 'new';
  const subtitle = job.address || job.customer_name || 'No address added yet';
  const created = job.created_at ? new Date(job.created_at).toLocaleString() : 'Just created';

  return (
    <Link href={'/jobs/' + job.id} className="card" style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <h3>{job.title}</h3>
        <StatusPill status={status} />
      </div>
      <p>{subtitle}</p>
      <p>{job.customer_name || 'No customer'} - {created}</p>
    </Link>
  );
}
