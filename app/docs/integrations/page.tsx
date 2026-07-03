import Link from 'next/link';

const liveIntegrations = [
  { title: 'Google Calendar', status: 'Live', body: 'Sync scheduled jobs and due dates into Google Calendar so field teams can see upcoming work.' },
  { title: 'QuickBooks', status: 'Ready panel', body: 'Keep accounting in QuickBooks while EverittOS stores operational records, job context, and customer workflow.' }
];

const nextIntegrations = [
  { title: 'Email notifications', body: 'Send customer and team updates for job changes, reports, invoices, booking requests, and account events.' },
  { title: 'Customer import', body: 'Prepare simple customer import paths from spreadsheets, forms, and legacy contact lists.' },
  { title: 'Webhook bridge', body: 'Offer a simple handoff for leads, forms, booking events, and completed job updates.' }
];

export default function IntegrationsGuidePage() {
  return (
    <main className="section">
      <div className="container">
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="eyebrow">EverittOS integrations</p>
          <h1>Connect the tools that matter without making the workspace messy.</h1>
          <p className="muted">EverittOS stays focused on operations while calendar, accounting, communication, and customer tools connect where needed.</p>
          <div className="settings-actions" style={{ marginTop: 18 }}>
            <Link className="btn btn-primary" href="/settings/integrations">Open integration settings</Link>
            <Link className="btn" href="/help">Help center</Link>
          </div>
        </div>
        <div className="settings-grid">
          {liveIntegrations.map((item) => (
            <div key={item.title} className="settings-card">
              <p className="eyebrow">{item.status}</p>
              <h3>{item.title}</h3>
              <p className="muted">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="card" style={{ marginTop: 20 }}>
          <h2>Next integration paths</h2>
          <div className="settings-grid" style={{ marginTop: 16 }}>
            {nextIntegrations.map((item) => (
              <div key={item.title} className="settings-card">
                <h3>{item.title}</h3>
                <p className="muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
