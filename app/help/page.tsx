import Link from 'next/link';

const helpSections = [
  {
    title: 'Getting started',
    body: 'Set up your workspace, invite your team, add customers, and create the first job without overbuilding the account.',
    href: '/onboarding'
  },
  {
    title: 'Daily operations',
    body: 'Use jobs, schedules, photos, reports, customers, messages, and invoices as the daily command center for field work.',
    href: '/dashboard'
  },
  {
    title: 'Integrations',
    body: 'Connect Google Calendar, review QuickBooks readiness, and see the next integration paths for email, payments, and CRM workflows.',
    href: '/docs/integrations'
  },
  {
    title: 'Enterprise readiness',
    body: 'Review SSO, audit logs, permissions, billing controls, security posture, and larger-team implementation notes.',
    href: '/settings/enterprise'
  }
];

const launchChecks = [
  'Create at least one customer and one job before inviting staff.',
  'Connect Google Calendar if the team depends on scheduled field work.',
  'Upload before and after photos on the first job to test proof reporting.',
  'Review roles before sending team invites.',
  'Confirm billing, legal pages, and support contact details before selling.'
];

export default function HelpCenterPage() {
  return (
    <main className="section">
      <div className="container">
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="eyebrow">EverittOS Help Center</p>
          <h1>Simple guidance for launching and running the workspace.</h1>
          <p className="muted">
            Use this as the public support hub for customers who need setup steps, daily operating guidance, integration notes, and enterprise-readiness details.
          </p>
          <div className="settings-actions" style={{ marginTop: 18 }}>
            <Link className="btn btn-primary" href="/onboarding">
              Start walkthrough
            </Link>
            <Link className="btn" href="/login">
              Sign in
            </Link>
          </div>
        </div>

        <div className="settings-grid">
          {helpSections.map((section) => (
            <Link key={section.title} className="settings-card" href={section.href}>
              <h3>{section.title}</h3>
              <p className="muted">{section.body}</p>
            </Link>
          ))}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h2>Launch checklist</h2>
          <ul>
            {launchChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
