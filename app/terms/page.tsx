import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { SUPPORT_EMAIL } from '@/lib/support';

export default function TermsPage() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <h2>Terms of Service</h2>
        <p>
          EverittOS is provided for business operations and field documentation. You are responsible for accurate job
          records, customer data, and compliance with laws that apply to your business.
        </p>
        <p>
          Paid plans are billed through Stripe. Subscriptions renew automatically unless canceled from billing settings or
          the Stripe customer portal. Canceling stops future charges; access may continue until the end of the current
          billing period. Refund terms follow Stripe and your selected plan at checkout.
        </p>
        <p>
          Plans, limits, and features may change with reasonable notice. We may suspend accounts that violate these terms
          or pose a security risk.
        </p>
        <p>
          For billing or account questions, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See also our{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
        <LegalNotice />
        <Link className="btn" href="/login">
          Back to login
        </Link>
      </div>
    </main>
  );
}
