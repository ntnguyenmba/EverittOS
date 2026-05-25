import Link from 'next/link';
import { DashboardStats } from '@/components/dashboard-stats';

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Premium AI operations for field teams</div>
            <h1>Run your field team from one clean dashboard.</h1>
            <p className="hero-copy">EverittOS helps property managers and service businesses assign jobs in seconds, track progress live, verify work with photos, and store proof reports with timestamps, location, notes, and status.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/dashboard">Launch dashboard</Link>
              <Link className="btn" href="/demo">View mobile demo</Link>
            </div>
          </div>
          <div className="panel app-preview">
            <div className="preview-top"><span>EverittOS Command Center</span><span className="dot" /></div>
            <div className="preview-body">
              <div className="preview-side"><div className="side-item active">Jobs</div><div className="side-item">Workers</div><div className="side-item">Proof Reports</div></div>
              <div className="preview-main">
                <DashboardStats />
                <div className="workflow">
                  {['Create job', 'Assign worker', 'Worker uploads photos', 'Manager verifies completion'].map((item, i) => <div className="step" key={item}><div className="step-num">{i + 1}</div><div><h3>{item}</h3><p>Clean, live, and proof-backed operations.</p></div></div>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="section"><div className="container grid-3">{['Assign jobs in seconds', 'Track progress live', 'Verify work with photos'].map(x => <div className="card" key={x}><h3>{x}</h3><p>Built for property operations, maintenance teams, cleaning crews, landscaping, inspections, and service businesses.</p></div>)}</div></section>
    </main>
  );
}
