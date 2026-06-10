import Link from 'next/link';

export default function ApiDocsPage() {
  return (
    <main className="section">
      <div className="container">
        <h2>EverittOS API</h2>
        <p className="muted">Growth and Enterprise plans can create API keys in settings.</p>

        <div className="settings-card" style={{ marginTop: 24 }}>
          <h3>Authentication</h3>
          <p>Include your API key in the Authorization header:</p>
          <pre className="card" style={{ overflow: 'auto' }}>
            Authorization: Bearer eos_live_your_key_here
          </pre>
        </div>

        <div className="settings-card">
          <h3>Endpoints</h3>
          <div className="list-row">
            <div>
              <strong>GET /api/v1/jobs</strong>
              <p className="muted">List jobs for your organization. Optional query: status, limit.</p>
            </div>
          </div>
          <div className="list-row">
            <div>
              <strong>POST /api/v1/jobs</strong>
              <p className="muted">Create a job. Body: title (required), customer_name, notes, scheduled_start, scheduled_end.</p>
            </div>
          </div>
          <div className="list-row">
            <div>
              <strong>GET /api/v1/customers</strong>
              <p className="muted">List customers for your organization.</p>
            </div>
          </div>
          <div className="list-row">
            <div>
              <strong>GET /api/v1/workers</strong>
              <p className="muted">List workers for your organization.</p>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <h3>Errors</h3>
          <p className="muted">Errors return JSON with an error field and appropriate HTTP status (401, 403, 404, 500).</p>
        </div>

        <Link href="/settings/api" className="btn">
          Back to API settings
        </Link>
      </div>
    </main>
  );
}
