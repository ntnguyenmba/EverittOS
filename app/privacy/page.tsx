import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { PRIVACY_VERSION } from '@/lib/legal-versions';
import { SUPPORT_EMAIL } from '@/lib/support';

export default function PrivacyPage() {
  return (
    <main className="section">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>Privacy Policy</h2>
        <p className="muted">Version {PRIVACY_VERSION} · Last updated September 2026</p>

        <h3>Overview</h3>
        <p>
          EverittOS (&quot;we&quot;, &quot;us&quot;) stores account, organization, job, customer, worker, photo, document, report,
          message, export, and activity data in Supabase to operate your workspace. We use this data to provide the
          service, support your team, maintain security, and improve reliability.
        </p>

        <h3>Data we collect</h3>
        <ul>
          <li>Account data: email, role, authentication events, passkey sign-in metadata, and workspace settings.</li>
          <li>Operational data: jobs, schedules, customers, workers, photos, reports, notes, documents, messages, exports, and activity logs.</li>
          <li>Team data: organization membership, assigned jobs, shared records, permissions, invite history, and role changes.</li>
          <li>Customer portal data: customer requests, approvals, job updates, uploaded files, reports, messages, and downloadable exports.</li>
          <li>Billing data: plan, subscription status, and Stripe customer references. Payment details stay with Stripe.</li>
          <li>Technical data: session cookies, device/browser metadata, and security logs.</li>
        </ul>
        <p>
          EverittOS allows users to store and manage business information, including customer records, leads, jobs,
          schedules, forms, documents, invoices, reviews, photos, notes, and other workspace content. Users are
          responsible for ensuring they have the appropriate rights and authorization to collect, store, manage, and use
          information uploaded to EverittOS.
        </p>
        <p>
          Workspace content may be indexed and searched to support platform functionality, including search and business
          intelligence features such as Ask Everitt.
        </p>

        <h3>Workspace, team, and client visibility</h3>
        <p>
          EverittOS is a shared business workspace. Organization owners and authorized administrators may view records
          created or uploaded by invited team members within the workspace, including jobs, customers, notes, photos,
          reports, documents, messages, exports, and activity logs. Managers may view operational work according to the
          organization&apos;s configuration. Workers, contractors, viewers, and clients receive limited access based on role,
          assignment, portal access, or records explicitly shared with them.
        </p>
        <p>
          When a user creates or updates work for an organization, that work may be visible to the organization&apos;s owner,
          administrators, managers, assigned teammates, and other authorized users. Customers using a customer portal may
          see information related to their own account, requests, jobs, approvals, uploaded files, photos, reports,
          messages, and exports.
        </p>
        <p>
          Activity logs may record actions such as invitations, assignments, sharing changes, approvals, exports,
          downloads, uploads, and updates for security, accountability, and audit purposes.
        </p>

        <h3>Exports and downloads</h3>
        <p>
          EverittOS may allow authorized users and customers to create or download PDF reports, spreadsheet exports,
          invoices, receipts, photos, documents, and other files from their permitted records. Organizations are responsible
          for deciding which records are appropriate to share with team members, contractors, customers, and other users.
        </p>

        <h3>Why we process data</h3>
        <ul>
          <li>To deliver and secure the EverittOS platform.</li>
          <li>To support workspace collaboration, assignments, customer portals, exports, and operational notifications.</li>
          <li>To comply with legal obligations and respond to lawful requests.</li>
        </ul>
        <p>
          Ask Everitt may retrieve, organize, summarize, and present information stored within your workspace in order
          to answer questions, locate records, and provide requested business insights.
        </p>

        <h3>AI-assisted features</h3>
        <p>
          Certain features may use artificial intelligence to generate summaries, recommendations, drafts, analyses, or
          other requested content. When AI-assisted features are used, relevant workspace information may be processed for
          the purpose of generating the requested response.
        </p>
        <p>Users should review AI-generated content before relying on or distributing it.</p>

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
          out of sale or sharing of personal information. We do not sell personal information.
        </p>
        <p>
          To deactivate or delete your account, use Settings → Account. Contact{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> for data access requests or recovery during the grace
          period.
        </p>

        <h3>Authentication</h3>
        <p>
          EverittOS supports email and password sign-in. You may optionally register passkeys (WebAuthn) for passwordless
          sign-in. Passkey credentials stay on your device or password manager; we store only the public key metadata
          required to verify sign-in. Google sign-in is not offered unless explicitly enabled in your deployment.
        </p>

        <h3>Security</h3>
        <p>
          Access is limited by role, assignment, explicit sharing, customer portal permissions, and row-level security
          policies. Photos and documents are stored in secure storage tied to your organization. See our{' '}
          <Link href="/security">Security</Link> page and <Link href="/cookies">Cookie Policy</Link> for more detail.
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

        <h3>Legal and billing policies</h3>
        <p>
          Billing, refunds, and subscription terms are covered in our <Link href="/terms">Terms of Service</Link> and{' '}
          <Link href="/terms#billing">Billing terms</Link>.
        </p>

        <LegalNotice />
        <Link className="btn" href="/login">
          Back to login
        </Link>
      </div>
    </main>
  );
}
