import Link from 'next/link';

export default function DisclaimerPage() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <h1>Disclaimer</h1>
        <p>
          EverittOS is business operations software. Information entered into the platform is provided by the
          organization and its users. EverittOS does not provide legal, tax, accounting, employment, insurance,
          financial, or regulatory advice. Organizations and users are responsible for verifying information and
          complying with laws, contracts, licensing requirements, tax obligations, and insurance requirements
          applicable to their activities.
        </p>
        <p>
          EverittOS helps record field work, scheduling, communication, documentation, and payment status. It does
          not replace licensed trade, legal, or safety advice. You are responsible for compliance in your market.
        </p>
        <p>
          Reports, photos, estimates, and dashboard totals are operational records based on information entered in
          EverittOS. They may not match bank, tax, payroll, or accounting records. Confirm official financial
          information in your accounting system.
        </p>
        <p>
          EverittOS is not a law firm, accounting firm, employer, insurance provider, or the service provider for
          every organization using the software. Questions about work quality, pricing, refunds, warranties,
          classification, or taxes should be directed to the relevant organization or a qualified professional.
        </p>

        <nav className="button-row" style={{ marginTop: 24, flexWrap: 'wrap', gap: 8 }} aria-label="Related disclaimers">
          <Link className="btn" href="/disclaimer/contractor">
            Contractor disclaimer
          </Link>
          <Link className="btn" href="/disclaimer/customer">
            Customer portal disclaimer
          </Link>
          <Link className="btn" href="/terms">
            Terms of Service
          </Link>
          <Link className="btn" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="btn" href="/login">
            Back to login
          </Link>
        </nav>
      </div>
    </main>
  );
}
