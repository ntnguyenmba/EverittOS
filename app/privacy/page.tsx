import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { PRIVACY_VERSION } from '@/lib/legal-versions';
import { SUPPORT_EMAIL } from '@/lib/support';

export default function PrivacyPage() {
  return (
    <main className="section">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>Privacy Policy</h2>
        <p className="muted">Version {PRIVACY_VERSION} · Last updated June 2026</p>

        <h3>Overview</h3>
        <p>
          EverittOS (&quot;we&quot;, &quot;us&quot;) stores account, organization, job, customer, worker, photo, and activity data in
          Supabase to operate your workspace. We use this data to provide the service, support your team, maintain
          security, and improve reliability.
        </p>

        <h3>Data we collect</h3>
        <ul>
          <li>Account data: email, name, role, authentication events, and workspace settings.</li>
          <li>Operational data: jobs, schedules, customers, workers, photos, reports, and activity logs.</li>
          <li>Billing data: plan, subscription status, and Stripe customer references (payment details stay with Stripe).</li>
          <li>Technical data: session cookies, device/browser metadata, and security logs.</li>
        </ul>

        <h3>Why we process data</h3>
        <ul>
          <li>To deliver and secure the EverittOS platform (contract performance).</li>
          <li>To send operational notifications you request (legitimate interest / consent where required).</li>
          <li>To comply with legal obligations and respond to lawful requests.</li>
        </ul>

        <h3>Retention</h3>
        <p>
          Active workspace data is retained while your account is active. Soft-deleted accounts enter a recovery window
          before permanent removal. Some billing and audit records may be retained longer where required by law or for
          fraud prevention.
        </p>

        <h3>Your rights (GDPR / CCPA)</h3>
        <p>
          Depending on your location, you may have rights to access, export, correct, delete, or restrict processing of
          your personal data. In Settings → Privacy you can export your data, manage communication preferences, and opt
          out of sale or sharing of personal information (we do not sell personal information).
        </p>
        <p>
          To deactivate or delete your account, use Settings → Account. Contact{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for data access requests or recovery during the grace
          period.
        </p>

        <h3>Passkeys and WebAuthn</h3>
        <p>
          EverittOS may support passkey authentication through WebAuthn. If you choose to use a passkey, your device,
          browser, operating system, or password manager may store a cryptographic credential used to verify your
          sign-in. EverittOS does not receive or store your biometric data, such as fingerprint or face scan data.
        </p>

        <h3>Security</h3>
        <p>
          Access is limited by role and row-level security policies. Photos and documents are stored in secure storage tied
          to your organization. See our <Link href="/security">Security</Link> page and{' '}
          <Link href="/cookies">Cookie Policy</Link> for more detail.
        </p>

        <h3>International transfers</h3>
        <p>
          Data may be processed in the United States and other regions where our infrastructure providers operate.
          Appropriate safeguards apply through our subprocessors&apos; terms and data processing agreements.
        </p>

        <h3>Contact</h3>
        <p>
          Privacy questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Product information is on{' '}
          <a href="https://everittventures.com/tech" target="_blank" rel="noopener noreferrer">
            everittventures.com/tech
          </a>
          .
        </p>

        <LegalNotice />
        <Link className="btn" href="/login">
          Back to login
        </Link>
      </div>
    </main>
  );
}
