import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { NO_REFUND_POLICY_TEXT } from '@/lib/no-refund-policy';
import { TERMS_VERSION } from '@/lib/legal-versions';
import { SUPPORT_EMAIL } from '@/lib/support';

export default function RefundPolicyPage() {
  return (
    <main className="section">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>No Refund Policy</h2>
        <p className="muted">Part of Terms of Service · Version {TERMS_VERSION} · Last updated June 2026</p>

        <p>{NO_REFUND_POLICY_TEXT}</p>

        <h3>Cancellation</h3>
        <p>
          You may cancel your subscription at any time from billing settings or the Stripe customer portal. Cancellation
          stops future renewals at the end of your current billing period (or immediately, depending on Stripe settings).
          Cancellation does not refund prior charges, setup fees, or partially used billing periods.
        </p>

        <h3>Related policies</h3>
        <p>
          See also our <Link href="/terms">Terms of Service</Link>, <Link href="/privacy">Privacy Policy</Link>, and{' '}
          <Link href="/settings/billing">Plans &amp; billing</Link> in the app.
        </p>

        <h3>Contact</h3>
        <p>
          Billing questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>

        <LegalNotice />
        <Link className="btn" href="/login">
          Back to login
        </Link>
      </div>
    </main>
  );
}
