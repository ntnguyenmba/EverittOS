import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { TERMS_VERSION } from '@/lib/legal-versions';
import { SUPPORT_EMAIL } from '@/lib/support';

export default function TermsPage() {
  return (
    <main className="section">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>Terms of Service</h2>
        <p className="muted">Version {TERMS_VERSION} · Last updated June 2026</p>

        <h3>Agreement</h3>
        <p>
          By creating an account or using EverittOS, you agree to these Terms and our{' '}
          <Link href="/privacy">Privacy Policy</Link>. If you use EverittOS on behalf of a business, you represent that
          you have authority to bind that organization.
        </p>

        <h3>Service</h3>
        <p>
          EverittOS is provided for business operations and field documentation. You are responsible for accurate job
          records, customer data, and compliance with laws that apply to your business and industry.
        </p>

        <h3>Accounts</h3>
        <p>
          You must provide accurate information and keep credentials secure. EverittOS supports email and password
          sign-in. You may optionally register passkeys (WebAuthn) for passwordless sign-in on supported devices. You may
          deactivate your account at any time from Settings. Deletion requests follow the process described in our
          Privacy Policy.
        </p>
        <p>
          You are responsible for keeping your devices, passwords, passkeys, and authentication methods secure. If you
          believe your account or device has been compromised, contact us right away at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>

        <h3>Billing</h3>
        <p>
          Paid plans are billed through Stripe. Subscriptions renew automatically unless canceled from billing settings or
          the Stripe customer portal. Canceling stops future charges; access may continue until the end of the current
          billing period. Refund terms follow Stripe and your selected plan at checkout. We do not change pricing without
          notice on active subscriptions except as permitted by these Terms.
        </p>

        <h3>Acceptable use</h3>
        <p>
          You may not misuse the platform, attempt unauthorized access, upload malicious content, or use EverittOS in
          violation of applicable law. We may suspend accounts that violate these terms or pose a security risk.
        </p>

        <h3>Changes</h3>
        <p>
          Plans, limits, and features may change with reasonable notice. Material changes to these Terms will be
          communicated through the product or email where appropriate. Continued use after changes constitutes
          acceptance.
        </p>

        <h3>Disclaimer</h3>
        <p>
          EverittOS is provided &quot;as is&quot; to the extent permitted by law. We do not guarantee uninterrupted service.
          Liability is limited as permitted by applicable law.
        </p>

        <h3>Contact</h3>
        <p>
          For billing or account questions, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>

        <LegalNotice />
        <Link className="btn" href="/login">
          Back to login
        </Link>
      </div>
    </main>
  );
}
