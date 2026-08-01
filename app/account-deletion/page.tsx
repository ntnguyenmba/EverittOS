import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { SUPPORT_EMAIL, supportMailtoHref } from '@/lib/support';

export default function AccountDeletionPage() {
  return (
    <main className="section">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>Delete your EverittOS account</h2>
        <p className="muted">You can request account and personal data deletion at any time.</p>

        <h3>Delete your account in EverittOS</h3>
        <ol>
          <li>Sign in to EverittOS.</li>
          <li>Open Settings.</li>
          <li>Select Account.</li>
          <li>Choose Delete account and follow the confirmation steps.</li>
        </ol>

        <h3>Delete your account without signing in</h3>
        <p>
          Email <a href={supportMailtoHref('EverittOS account deletion request')}>{SUPPORT_EMAIL}</a> from the email address
          connected to your account and include the words &quot;Account deletion request&quot; in the subject line.
        </p>
        <p>We may ask you to confirm account ownership before processing the request.</p>

        <h3>What will be deleted</h3>
        <p>
          Your account profile and personal data will be deleted or anonymized, along with workspace data that you own and
          are permitted to remove. This may include jobs, customers, schedules, notes, photos, documents, reports, messages,
          exports, and settings.
        </p>

        <h3>What may be retained</h3>
        <p>
          Limited billing, security, fraud-prevention, legal, and audit records may be retained when required by law or
          needed to protect EverittOS and its users. Data belonging to another organization may remain under that
          organization&apos;s control after your access is removed.
        </p>

        <h3>Recovery period</h3>
        <p>
          If EverittOS provides a recovery period, your account may remain recoverable for a limited time before permanent
          deletion. After permanent deletion, the account and deleted data cannot be restored.
        </p>

        <h3>Need help?</h3>
        <p>
          Contact <a href={supportMailtoHref('EverittOS account deletion help')}>{SUPPORT_EMAIL}</a> for help with deletion,
          access, or data requests.
        </p>

        <p>
          See the <Link href="/privacy">Privacy Policy</Link> for more information about data handling and retention.
        </p>

        <LegalNotice />
        <Link className="btn" href="/login">
          Back to login
        </Link>
      </div>
    </main>
  );
}
