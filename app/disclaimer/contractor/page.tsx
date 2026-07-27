import Link from 'next/link';

export default function ContractorDisclaimerPage() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <h1>Independent Contractor Disclaimer</h1>
        <p>
          Contractors using EverittOS may be independent contractors of the organization that assigned the work. They
          are not employees of EverittOS merely because they use this software. EverittOS provides scheduling,
          communication, job documentation, and payment-status tools. The hiring organization and contractor are
          responsible for agreeing on compensation, classification, taxes, insurance, licensing, working conditions,
          and legal compliance. EverittOS does not guarantee work assignments, payment, employment status, or the
          accuracy of information entered by an organization.
        </p>
        <p>
          EverittOS is software and is not legal, tax, accounting, insurance, or employment advice. Everitt Ventures
          is not automatically the hiring organization for every workspace using EverittOS.
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
          <Link className="btn" href="/portal/contractor">
            Contractor portal
          </Link>
        </nav>
      </div>
    </main>
  );
}
