import Link from 'next/link';

export default function CustomerDisclaimerPage() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <h1>Customer Portal Disclaimer</h1>
        <p>
          The customer portal displays information entered or shared by the service provider. Appointment times,
          estimates, invoices, photos, reports, and job updates may change as work progresses. EverittOS provides the
          software used to display this information but is not the company performing the service unless specifically
          stated. Questions about work, pricing, refunds, warranties, or service quality should be directed to the
          service provider.
        </p>
        <p>
          EverittOS does not provide legal, tax, accounting, employment, insurance, financial, or regulatory advice.
          Confirm important details directly with your service provider.
        </p>
        <p>
          Calendar events are provided for convenience. Confirm appointment details in EverittOS because external
          calendar updates may be delayed or affected by provider settings.
        </p>

        <nav className="button-row" style={{ marginTop: 24, flexWrap: 'wrap', gap: 8 }}>
          <Link className="btn" href="/disclaimer">
            General disclaimer
          </Link>
          <Link className="btn" href="/terms">
            Terms of Service
          </Link>
          <Link className="btn" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="btn" href="/portal/client">
            Customer portal
          </Link>
        </nav>
      </div>
    </main>
  );
}
