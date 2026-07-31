import Link from 'next/link';

const helpSections = [
  {
    title: 'Getting started',
    body: 'Set up your company, add customers, create your first job, and invite your team when you are ready.',
    href: '/onboarding'
  },
  {
    title: 'Daily operations',
    body: 'Manage jobs, schedules, photos, reports, customers, messages, and invoices in one place.',
    href: '/dashboard'
  },
  {
    title: 'Integrations',
    body: 'Connect Google Calendar and QuickBooks, then review which information stays updated automatically.',
    href: '/docs/integrations'
  },
  {
    title: 'Team and security',
    body: 'Review roles, permissions, account security, billing controls, and options for larger teams.',
    href: '/settings/enterprise'
  }
];

const setupChecks = [
  'Add at least one customer and one job.',
  'Connect Google Calendar when your team uses scheduled field work.',
  'Upload before and after photos to preview a customer report.',
  'Review each team member role before sending invitations.',
  'Confirm your business details, billing plan, and support contact information.'
];

export default function HelpCenterPage() {
  return (
    <main className="section">
      <div className="container">
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="eyebrow">EverittOS Help Center</p>
          <h1>Guidance for setting up and running your company.</h1>
          <p className="muted">
            Find the main setup steps, everyday workflows, connected tools, and account controls in one place.
          </p>
          <div className="settings-actions" style={{ marginTop: 18 }}>
            <Link className="btn btn-primary" href="/onboarding">
              Start setup guide
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
          <h2>Company setup checklist</h2>
          <ul>
            {setupChecks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
