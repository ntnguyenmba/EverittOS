import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';

export default function CookiesPage() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <h2>Cookie &amp; Tracking Notice</h2>
        <p>
          EverittOS uses essential cookies for authentication and session management. These are required to sign in and
          use the application.
        </p>
        <p>
          Public marketing pages may use analytics or performance cookies (for example Google Analytics) to understand
          how visitors use our site. You can control non-essential cookies through your browser settings.
        </p>
        <p>
          The authenticated EverittOS app does not load marketing analytics scripts by default. Stripe checkout and billing
          portal pages may set their own cookies when you manage payments.
        </p>
        <LegalNotice />
        <p>
          <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Service</Link>
        </p>
        <Link className="btn" href="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}
