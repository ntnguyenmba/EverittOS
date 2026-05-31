import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Field operations for service teams</div>
            <h1>Run your service business from one dashboard.</h1>
            <p className="hero-copy">
              EverittOS helps HVAC, cleaning, repair, and property teams create jobs, assign work, track completion, and keep customer records organized.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/signup">Start Free</Link>
              <Link className="btn" href="/login">Login</Link>
            </div>
          </div>

          <div className="panel app-preview">
            <div className="preview-top">
              <span>EverittOS</span>
              <span className="dot" />
            </div>
            <div className="preview-body">
              <div className="preview-side">
                <div className="side-item active">Jobs</div>
                <div className="side-item">Workers</div>
                <div className="side-item">Reports</div>
              </div>
              <div className="preview-main">
                <div className="stat-grid">
                  <div className="stat"><strong>Open</strong><p>Live jobs</p></div>
                  <div className="stat"><strong>Done</strong><p>Completed</p></div>
                  <div className="stat"><strong>Photos</strong><p>On file</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid-3">
          <div className="card"><h3>Built for service teams</h3><p>HVAC, cleaning, repairs, inspections, landscaping, and property maintenance.</p></div>
          <div className="card"><h3>Manager dashboard</h3><p>Create jobs, see status, and keep customer details organized.</p></div>
          <div className="card"><h3>Clear workflow</h3><p>Notes, timestamps, and job history in one place.</p></div>
        </div>
      </section>
    </main>
  );
}
