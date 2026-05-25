import { Sidebar } from '@/components/sidebar';
import { getJob } from '@/lib/jobs';
import { StatusPill } from '@/components/status-pill';
import { PhotoUpload } from '@/components/photo-upload';

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const job = getJob(params.id);
  return <div className="dashboard-shell"><Sidebar /><main className="main"><div className="page-head"><div><h2>{job.title}</h2><p>{job.property} · {job.location}</p></div><StatusPill status={job.status} /></div><div className="grid-2"><div className="card"><h3>Job details</h3><p><strong>Worker:</strong> {job.worker}</p><p><strong>Due:</strong> {job.due}</p><p><strong>Priority:</strong> {job.priority}</p><p><strong>Notes:</strong> {job.notes}</p><p><strong>Timestamp:</strong> {job.timestamp}</p><button className="btn btn-primary">Verify completion</button></div><div className="card"><h3>Proof report</h3><div className="form"><PhotoUpload label="Before photo" /><PhotoUpload label="After photo" /><textarea className="input" rows={4} placeholder="Completion notes" defaultValue="Work completed, photos attached, location and timestamp recorded." /></div></div></div></main></div>;
}
