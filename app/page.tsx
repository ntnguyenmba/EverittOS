import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

export default function HomePage() {
  return (
    <main id="main-content">
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Field operations</div>
            <h1>Run your service business from one dashboard.</h1>
            <p className="hero-copy">
              Manage jobs, assign crews, track completion, and keep customer records in one place. Built for HVAC,
              cleaning, repair, and property teams.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/signup">
                Start free
              </Link>
              <Link className="btn" href="/login">
                Sign in
              </Link>
            </div>
            <p className="trust-line">No credit card required · Free plan available · Cancel anytime</p>
          </div>

          <div className="panel app-preview" aria-hidden="true">
            <div className="preview-top">
              <span>Operations board</span>
              <span className="dot" />
            </div>
            <div className="preview-body">
              <div className="preview-side">
                <div className="side-item active">Jobs</div>
                <div className="side-item">Schedule</div>
                <div className="side-item">Reports</div>
              </div>
              <div className="preview-main">
                <div className="stat-grid">
                  <div className="stat">
                    <strong>0</strong>
                    <p>Open jobs</p>
                  </div>
                  <div className="stat">
                    <strong>0</strong>
                    <p>Scheduled</p>
                  </div>
                  <div className="stat">
                    <strong>0</strong>
                    <p>Completed</p>
                  </div>
                </div>
                <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
                  Every account starts empty. Add your own jobs when you are ready.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid-3">
          <div className="card">
            <h3>Jobs and schedule</h3>
            <p>Create work, set due dates, and see what is open or overdue.</p>
          </div>
          <div className="card">
            <h3>Customers and crew</h3>
            <p>Keep client history, assignments, and field photos in one place.</p>
          </div>
          <div className="card">
            <h3>Reports that ship</h3>
            <p>Print PDF reports with job details and photos for clients.</p>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container site-footer-inner">
          <BrandLogo href="/" showName />
          <nav className="site-footer-links" aria-label="Footer">
            <Link href="/pricing">Pricing</Link>
            <Link href="/product">Product</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/cookies">Cookies</Link>
            <Link href="/login">Sign in</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
