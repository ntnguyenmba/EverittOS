import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';

export default function JobsPage() {
  return (
    <div className="dashboard-shell">
      <Sidebar />
      <main className="main">
        <div className="page-head">
          <div>
            <h2>Jobs</h2>
            <p>Open jobs from the dashboard to manage status and completion.</p>
          </div>
        </div>

        <div className="card">
          <h3>Job Management</h3>
          <p>Go back to dashboard to create and open jobs.</p>
          <Link className="btn btn-primary" href="/dashboard">Open Dashboard</Link>
        </div>
      </main>
    </div>
  );
}
