import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { SUPPORT_EMAIL, supportMailtoHref } from '@/lib/support';

const APP_VERSION = '1.0.0';

export default function AboutPage() {
  return (
    <main className="section">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>About EverittOS</h2>
        <p className="muted">Business operations software built from real work.</p>

        <h3>App information</h3>
        <p>
          <strong>EverittOS</strong>
          <br />
          Version {APP_VERSION}
        </p>

        <h3>Support</h3>
        <p>
          Need help with your account, billing, access, or app features? Email{' '}
          <a href={supportMailtoHref()}>{SUPPORT_EMAIL}</a>.
        </p>

        <h3>Legal and privacy</h3>
        <ul>
          <li>
            <Link href="/privacy">Privacy Policy</Link>
          </li>
          <li>
            <Link href="/terms">Terms of Service</Link>
          </li>
          <li>
            <Link href="/cookies">Cookie Policy</Link>
          </li>
          <li>
            <Link href="/security">Security</Link>
          </li>
          <li>
            <Link href="/account-deletion">Account deletion</Link>
          </li>
        </ul>

        <h3>Company</h3>
        <p>
          EverittOS is provided by Everitt Ventures. Product information is available at{' '}
          <a href="https://everittventures.com/tech" target="_blank" rel="noopener noreferrer">
            everittventures.com/tech
          </a>
          .
        </p>

        <LegalNotice />
        <Link className="btn" href="/settings/account">
          Back to settings
        </Link>
      </div>
    </main>
  );
}
