import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { sessionIdleTimeoutMinutes, sessionIdleWarningBeforeMinutes } from '@/lib/session-policy';
import { SUPPORT_EMAIL } from '@/lib/support';

export default function SecurityPage() {
  const idleMinutes = sessionIdleTimeoutMinutes();
  const warningMinutes = sessionIdleWarningBeforeMinutes();

  return (
    <main className="section" id="main-content">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>Security</h2>
        <p>
          EverittOS is built for field service teams that handle customer data, job photos, and billing. This page
          describes how we protect accounts and organization data.
        </p>

        <h3>Authentication</h3>
        <p>
          You can sign in with email or Google. Sessions are stored in secure HTTP-only cookies. After{' '}
          {idleMinutes} minutes of inactivity, users are signed out automatically. A warning appears{' '}
          {warningMinutes} minutes before logout. Mouse movement, keyboard input, touch, and navigation reset the timer.
        </p>
        <p>Passkey support is not enabled yet.</p>
        <p>
          Password reset and email verification links expire per Supabase settings. Disabled accounts cannot access the
          app or authenticated APIs.
        </p>

        <h3>Data storage</h3>
        <p>
          Application data (profiles, organizations, jobs, customers, photos, reports) is stored in Supabase Postgres.
          Job photos and organization logos are stored in private Supabase Storage buckets. Data is scoped to your
          organization through row-level security policies.
        </p>
        <p>
          Stripe handles payment card data. EverittOS stores subscription status and Stripe customer IDs on the workspace
          owner profile, not full card numbers.
        </p>

        <h3>Access controls</h3>
        <p>
          Each user belongs to an organization with a role (owner, admin, manager, employee, contractor, client, or
          viewer). Permissions control which pages and actions are available. API access (Growth and Enterprise plans)
          uses scoped API keys stored as hashes.
        </p>
        <p>
          Client and contractor portals show only jobs and data explicitly shared with that account. Managers grant and
          revoke client access per job.
        </p>

        <h3>Encryption</h3>
        <p>
          Traffic to EverittOS uses HTTPS (TLS). Supabase encrypts data at rest on their platform. Session cookies are
          marked secure in production. Photo URLs use time-limited signed links.
        </p>

        <h3>Backups</h3>
        <p>
          Database backups and point-in-time recovery are managed by Supabase according to your Supabase project plan.
          Export customer or job data on request by contacting{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>

        <h3>Application protections</h3>
        <ul className="plan-feature-list">
          <li>Security headers including Content-Security-Policy on all pages</li>
          <li>Rate limits on login, signup, password reset, and sensitive API routes</li>
          <li>Image upload restrictions (type, size, and filename sanitization)</li>
          <li>Input validation on authentication and account routes</li>
          <li>Production API responses omit internal stack traces and diagnostics</li>
        </ul>

        <p style={{ marginTop: 24 }}>
          See also our <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Service</Link>.
        </p>

        <LegalNotice />

        <Link className="btn" href="/login">
          Sign in
        </Link>
      </div>
    </main>
  );
}
