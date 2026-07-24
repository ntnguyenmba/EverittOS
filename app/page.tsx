import Link from 'next/link';
import type { Metadata } from 'next';
import './marketing-home.css';

export const metadata: Metadata = {
  title: 'EverittOS | Run Your Service Business From One Place',
  description:
    'Manage customers, jobs, schedules, teams, photos, reports, and payments in one clear workspace built for service businesses.'
};

const features = [
  {
    number: '01',
    title: 'Customers and jobs',
    description: 'Keep customer details, job history, notes, status, and next steps together instead of scattered across messages and spreadsheets.'
  },
  {
    number: '02',
    title: 'Scheduling and teams',
    description: 'Plan work, assign crews, track visits, and give everyone a clear view of what needs to happen next.'
  },
  {
    number: '03',
    title: 'Photos and reports',
    description: 'Capture before and after photos, organize job records, and share professional customer reports from one place.'
  },
  {
    number: '04',
    title: 'Payments and profit',
    description: 'See what has been collected, what is still owed, contractor costs, expenses, and expected profit without manual calculations.'
  },
  {
    number: '05',
    title: 'Leads and follow-up',
    description: 'Move new requests through a simple pipeline so opportunities do not disappear in texts, email, or handwritten notes.'
  },
  {
    number: '06',
    title: 'Built for the field',
    description: 'Use EverittOS on desktop, tablet, iPhone, and Android with layouts designed for real work, not just office screens.'
  }
];

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'A simple place to start managing customers and jobs.',
    features: ['Dashboard', 'Customer management', 'Basic job tracking', 'Schedule and notifications', 'Basic photo uploads'],
    href: '/signup?plan=free',
    label: 'Start free'
  },
  {
    name: 'Pro',
    price: '$9',
    period: '/month',
    description: 'For solo operators who need stronger job records and customer-facing reports.',
    features: ['Everything in Free', 'Bookings and appointments', 'Before and after photos', 'Standard reports', 'Expanded jobs and customers'],
    href: '/signup?plan=pro',
    label: 'Choose Pro',
    featured: true
  },
  {
    name: 'Business',
    price: '$39',
    period: '/month',
    description: 'For teams that need assignments, activity tracking, and advanced reporting.',
    features: ['Everything in Pro', 'Team and crew management', 'Job assignments', 'Activity log', 'Everitt AI', 'Advanced reporting'],
    href: '/signup?plan=business',
    label: 'Choose Business'
  }
];

export default function HomePage() {
  return (
    <main id="main-content" className="marketing-page">
      <header className="marketing-header">
        <nav className="marketing-nav" aria-label="Main navigation">
          <Link className="marketing-brand" href="/" aria-label="EverittOS home">
            Everitt<span>OS</span>
          </Link>

          <div className="marketing-nav-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#why-everittos">Why EverittOS</a>
          </div>

          <div className="marketing-nav-actions">
            <Link className="marketing-signin" href="/login">
              Sign in
            </Link>
            <Link className="marketing-button" href="/signup?plan=free">
              Start free
            </Link>
          </div>
        </nav>
      </header>

      <section className="marketing-hero">
        <div>
          <p className="marketing-eyebrow">Operations software for service businesses</p>
          <h1>Run the work. Know the numbers.</h1>
          <p className="marketing-hero-copy">
            EverittOS brings customers, jobs, scheduling, teams, photos, reports, and payments into one clear workspace so you can spend less time piecing your business together.
          </p>
          <div className="marketing-hero-actions">
            <Link className="marketing-button" href="/signup?plan=free">
              Start free
            </Link>
            <Link className="marketing-button marketing-button-secondary" href="/login">
              Sign in
            </Link>
          </div>
          <p className="marketing-trust-line">No credit card required for the Free plan.</p>
        </div>

        <div className="marketing-product-frame" aria-label="EverittOS dashboard preview">
          <div className="marketing-window">
            <div className="marketing-window-bar">
              <div className="marketing-window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <span>EverittOS workspace</span>
            </div>
            <div className="marketing-dashboard-preview">
              <aside className="marketing-preview-sidebar" aria-hidden="true">
                <strong>EverittOS</strong>
                <span />
                <span />
                <span />
                <span />
                <span />
              </aside>
              <div className="marketing-preview-main">
                <h3>Today at a glance</h3>
                <div className="marketing-preview-stats">
                  <div className="marketing-preview-stat">
                    <span>Jobs scheduled</span>
                    <strong>12</strong>
                  </div>
                  <div className="marketing-preview-stat">
                    <span>Collected</span>
                    <strong>$2,450</strong>
                  </div>
                  <div className="marketing-preview-stat">
                    <span>Still owed</span>
                    <strong>$950</strong>
                  </div>
                  <div className="marketing-preview-stat">
                    <span>Open leads</span>
                    <strong>8</strong>
                  </div>
                </div>
                <div className="marketing-preview-list">
                  <div className="marketing-preview-row"><span>Residential cleaning</span><em>In progress</em></div>
                  <div className="marketing-preview-row"><span>Move-out service</span><em>Scheduled</em></div>
                  <div className="marketing-preview-row"><span>Property report</span><em>Ready</em></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="why-everittos" className="marketing-section marketing-features">
        <div className="marketing-section-inner">
          <div className="marketing-section-heading">
            <p className="marketing-eyebrow">One reliable system</p>
            <h2>Stop rebuilding your day from texts, notes, and spreadsheets.</h2>
            <p>
              EverittOS gives small service businesses a practical operating system without the weight and complexity of enterprise software.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="marketing-section marketing-features">
        <div className="marketing-section-inner">
          <div className="marketing-section-heading">
            <p className="marketing-eyebrow">What it does</p>
            <h2>Everything important, clearly organized.</h2>
            <p>Designed to be easy enough to use every day and structured enough to help your business grow.</p>
          </div>
          <div className="marketing-feature-grid">
            {features.map((feature) => (
              <article className="marketing-feature-card" key={feature.number}>
                <span className="marketing-feature-number">{feature.number}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="marketing-section marketing-pricing">
        <div className="marketing-section-inner">
          <div className="marketing-section-heading">
            <p className="marketing-eyebrow">Simple pricing</p>
            <h2>Start small. Upgrade when the work grows.</h2>
            <p>Choose the plan that fits your business today. Your workspace and records stay together as you grow.</p>
          </div>

          <div className="marketing-price-grid">
            {plans.map((plan) => (
              <article
                className={`marketing-price-card${plan.featured ? ' marketing-price-card-featured' : ''}`}
                key={plan.name}
              >
                {plan.featured ? <span className="marketing-price-badge">Most popular</span> : null}
                <h3>{plan.name}</h3>
                <div className="marketing-price">
                  {plan.price} <span>{plan.period}</span>
                </div>
                <p>{plan.description}</p>
                <ul>
                  {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
                <Link className="marketing-button" href={plan.href}>
                  {plan.label}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-cta">
        <div>
          <h2>Your business should be easier to run.</h2>
          <p>Build a clear daily workflow for customers, jobs, teams, photos, reports, and money without adding more administrative work.</p>
        </div>
        <Link className="marketing-button" href="/signup?plan=free">
          Start with EverittOS
        </Link>
      </section>

      <footer className="marketing-footer">
        <div className="marketing-footer-inner">
          <span>© {new Date().getFullYear()} EverittOS. An Everitt Ventures product.</span>
          <div className="marketing-footer-links">
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Create account</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
