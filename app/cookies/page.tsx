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
          Plan and product information is published on{' '}
          <a href="https://everittventures.com/tech" target="_blank" rel="noopener noreferrer">
            everittventures.com/tech
          </a>
          . The EverittOS app does not load marketing analytics scripts.
        </p>
        <LegalNotice />
        <p>
          <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Service</Link>
        </p>
        <Link className="btn" href="/login">
          Sign in
        </Link>
      </div>
    </main>
  );
}
