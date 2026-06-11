import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { SUPPORT_EMAIL } from '@/lib/support';

export default function PrivacyPage() {
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <h2>Privacy Policy</h2>
        <p>
          EverittOS stores account, organization, job, customer, photo, and report data in Supabase to operate your
          workspace. We use this data to provide the service, support your team, and improve reliability.
        </p>
        <p>
          We do not sell personal information. Photos and documents are stored in secure storage tied to your
          organization. Access is limited by role and row-level security policies in the database.
        </p>
        <p>
          Product and plan information is on{' '}
          <a href="https://everittventures.com/tech" target="_blank" rel="noopener noreferrer">
            everittventures.com/tech
          </a>
          . Authenticated app pages do not load marketing analytics. See our <Link href="/cookies">cookie notice</Link>{' '}
          for details.
        </p>
        <p>
          You may deactivate your account from settings or request permanent deletion. Deactivation blocks sign-in;
          deletion requests are reviewed by our team. Contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{' '}
          for data access or export questions.
        </p>
        <LegalNotice />
        <Link className="btn" href="/login">
          Back to login
        </Link>
      </div>
    </main>
  );
}
