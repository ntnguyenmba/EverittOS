import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';

export default function CookiesPage() {
  return (
    <main className="section">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>Cookie Policy</h2>
        <p className="muted">Last updated June 2026</p>

        <h3>What are cookies?</h3>
        <p>
          Cookies are small text files stored on your device. We use cookies and similar technologies to operate
          EverittOS, remember preferences, and, only with your consent, understand how marketing pages are used.
        </p>

        <h3>Categories</h3>
        <ul>
          <li>
            <strong>Necessary</strong>: Required for authentication, session management, and security. These cannot be
            disabled while using the app.
          </li>
          <li>
            <strong>Analytics</strong>: Optional. Helps us understand signup and marketing page usage. Loaded only if you
            accept analytics cookies.
          </li>
          <li>
            <strong>Marketing</strong>: Optional. Reserved for future campaign measurement. Not loaded unless you
            accept marketing cookies.
          </li>
        </ul>

        <h3>Passkeys</h3>
        <p>
          If you use passkey sign-in, your device, browser, or password manager stores the credential. EverittOS does
          not receive or store biometric data such as fingerprint or face scan data.
        </p>

        <h3>Authenticated app</h3>
        <p>
          Inside the signed-in EverittOS application, we do not load marketing analytics scripts. Essential session
          cookies remain active so you can stay signed in.
        </p>

        <h3>Managing preferences</h3>
        <p>
          Use the cookie banner on your first visit to accept all, reject non-essential, or manage preferences by
          category. Your choice is stored locally and the banner will not reappear unless you clear site data.
        </p>

        <h3>Third parties</h3>
        <p>
          Stripe checkout and Google sign-in may set their own cookies when you use those features. See their respective
          privacy policies for details.
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
