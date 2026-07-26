import Link from 'next/link';

const availableIntegrations = [
  {
    title: 'Google Calendar',
    status: 'Available',
    body: 'Keep scheduled jobs and visit times aligned with Google Calendar so your team can see upcoming work.'
  },
  {
    title: 'QuickBooks',
    status: 'Available',
    body: 'Connect eligible customers and invoices to QuickBooks while EverittOS remains the home for daily operations.'
  }
];

const plannedConnections = [
  {
    title: 'Email updates',
    body: 'Send useful customer and team updates for schedule changes, reports, invoices, and account activity.'
  },
  {
    title: 'Customer import',
    body: 'Bring customer lists into EverittOS from common spreadsheet formats without re-entering every record.'
  },
  {
    title: 'Booking connections',
    body: 'Bring new booking requests and lead information into one organized workflow.'
  }
];

export default function IntegrationsGuidePage() {
  return (
    <main className="section">
      <div className="container">
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="eyebrow">EverittOS integrations</p>
          <h1>Keep your everyday tools connected.</h1>
          <p className="muted">
            EverittOS manages your operational work while connected calendar and accounting tools stay updated where they are most useful.
          </p>
          <div className="settings-actions" style={{ marginTop: 18 }}>
            <Link className="btn btn-primary" href="/settings/integrations">Manage integrations</Link>
            <Link className="btn" href="/help">Help center</Link>
          </div>
        </div>

        <div className="settings-grid">
          {availableIntegrations.map((item) => (
            <div key={item.title} className="settings-card">
              <p className="eyebrow">{item.status}</p>
              <h3>{item.title}</h3>
              <p className="muted">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h2>More connections planned</h2>
          <p className="muted">These additions are planned to make setup and communication easier as EverittOS grows.</p>
          <div className="settings-grid" style={{ marginTop: 16 }}>
            {plannedConnections.map((item) => (
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
