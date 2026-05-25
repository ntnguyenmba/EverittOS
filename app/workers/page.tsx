import { Sidebar } from '@/components/sidebar';
import { workers } from '@/lib/workers';
import { StatusPill } from '@/components/status-pill';

export default function WorkersPage() {
  return <div className="dashboard-shell"><Sidebar /><main className="main"><h2>Workers</h2><p>Assign, monitor, and verify field performance.</p><div className="grid-3" style={{ marginTop: 20 }}>{workers.map(worker => <div className="card" key={worker.id}><h3>{worker.name}</h3><p>{worker.role}</p><StatusPill status={worker.status === 'On job' ? 'Progress' : worker.status} /><p>{worker.jobs} jobs today · {worker.rating} rating</p></div>)}</div></main></div>;
}
