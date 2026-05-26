import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">AI operating system for home service businesses</div>
            <h1>Run your service business from one clean dashboard.</h1>
            <p className="hero-copy">
              EverittOS helps small HVAC, cleaning, repair, and property service teams create jobs, assign work, track completion, and keep customer records in one place.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/signup">Start free pilot</Link>
              <Link className="btn" href="/login">Login</Link>
            </div>
          </div>

          <div className="panel app-preview">
            <div className="preview-top">
              <span>EverittOS Command Center</span>
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
                  <div className="stat"><strong>24/7</strong><p>Lead capture</p></div>
                  <div className="stat"><strong>3 min</strong><p>Job setup</p></div>
                  <div className="stat"><strong>100%</strong><p>Job records</p></div>
                </div>
                <div className="workflow">
                  {['Create job', 'Assign worker', 'Track progress', 'Send report'].map((item, index) => (
                    <div className="step" key={item}>
                      <div className="step-num">{index + 1}</div>
                      <div>
                        <h3>{item}</h3>
                        <p>Simple operations your team can understand fast.</p>
                      </div>
                    </div>
                  ))}
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
          <div className="card"><h3>Simple workflow</h3><p>Keep notes, timestamps, and job history easy to find.</p></div>
        </div>
      </section>
    </main>
  );
}
