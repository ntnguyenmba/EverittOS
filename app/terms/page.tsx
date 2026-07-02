import Link from 'next/link';
import { LegalNotice } from '@/components/legal-notice';
import { TERMS_VERSION } from '@/lib/legal-versions';
import { SUPPORT_EMAIL } from '@/lib/support';

export default function TermsPage() {
  return (
    <main className="section">
      <div className="container legal-document" style={{ maxWidth: 720 }}>
        <h2>Terms of Service</h2>
        <p className="muted">Version {TERMS_VERSION} · Last updated September 2026</p>

        <h3>Agreement</h3>
        <p>
          By creating an account or using EverittOS, you agree to these Terms and our{' '}
          <Link href="/privacy">Privacy Policy</Link>. If you use EverittOS on behalf of a business, you represent that
          you have authority to bind that organization.
        </p>

        <h3>Service</h3>
        <p>
          EverittOS is provided for business operations and field documentation. You are responsible for all information
          uploaded, stored, entered, exported, shared, or managed within your EverittOS workspace. You represent that you
          have the necessary rights, permissions, and authority to collect, store, manage, process, share, export, and use
          such information in connection with your business and use of the Services.
        </p>
        <p>
          You are responsible for accurate job records, customer data, assignments, team permissions, customer portal
          access, and compliance with laws that apply to your business and industry. You remain responsible for verifying
          the accuracy and appropriateness of information, recommendations, summaries, drafts, exports, reports, and other
          content generated through the Services.
        </p>

        <h3>Workspace roles and permissions</h3>
        <p>
          EverittOS workspaces may include owners, administrators, managers, workers, contractors, viewers, and customers.
          Organization owners and administrators are responsible for inviting appropriate users, assigning roles, managing
          permissions, reviewing activity, and removing access when it is no longer needed.
        </p>
        <p>
          Records created inside an organization may be visible to the organization owner, administrators, managers,
          assigned teammates, selected shared users, and customers with portal access according to the workspace settings.
          Workers and contractors may have access to assigned or shared work data. Customers may have access to their own
          portal records, photos, reports, files, messages, exports, requests, approvals, and related job information.
        </p>
        <p>
          By joining a workspace, invited team members understand that work created for that organization may be visible to
          authorized owners, administrators, managers, assigned teammates, and other users according to role and sharing
          settings.
        </p>

        <h3>Exports, reports, and customer portal files</h3>
        <p>
          EverittOS may allow authorized users and customers to generate, download, or share PDF reports, spreadsheet
          exports, invoices, receipts, photos, documents, messages, approvals, and other operational files. Exported files
          reflect the information available at the time they are generated. Organizations are responsible for reviewing
          exports before distributing them and for configuring appropriate customer and team access.
        </p>

        <h3>Accounting and third-party sync</h3>
        <p>
          EverittOS is not accounting, bookkeeping, tax, payroll, reconciliation, or financial advisory software. EverittOS
          may provide tools to sync or export operational records, including customers, invoices, payments, and expenses,
          to third-party accounting platforms such as QuickBooks. These tools are provided as user-controlled sync and
          export features only.
        </p>
        <p>
          You are responsible for reviewing, approving, correcting, and maintaining the accuracy of all data sent to or
          received from any third-party accounting platform. QuickBooks or your chosen accounting platform remains your
          system of record for accounting, taxes, reconciliations, payroll, and financial reporting. EverittOS does not
          provide accounting or tax advice and does not replace review by a qualified accounting or tax professional.
        </p>

        <h3>Accounts</h3>
        <p>
          You must provide accurate information and keep credentials secure. EverittOS supports email and password
          sign-in. You may optionally register passkeys (WebAuthn) for passwordless sign-in on supported devices. You may
          deactivate your account at any time from Settings. Deletion requests follow the process described in our{' '}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
        <p>
          You are responsible for keeping your devices, passwords, passkeys, and authentication methods secure. If you
          believe your account or device has been compromised, contact us right away at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>

        <h3>Billing</h3>
        <p>
          Paid plans are billed through Stripe. Subscriptions renew automatically unless canceled from billing settings or
          the Stripe customer portal. Canceling stops future renewals; access may continue until the end of the current
          billing period. Prior charges are not refunded when you cancel. We do not change pricing without notice on
          active subscriptions except as permitted by these Terms.
        </p>

        <h3>No Refund Policy</h3>
        <p>
          All payments are final. EverittOS does not offer refunds for subscriptions, setup fees, digital services, AI
          usage, workspace access, add-ons, exports, reports, or partially used billing periods. You may cancel anytime to
          stop future renewals, but prior charges are non-refundable.
        </p>
        <p>
          Billing and refund terms are covered in the <Link href="/terms#billing">Terms of Service</Link>.
        </p>

        <h3>Acceptable use</h3>
        <p>
          You may not misuse the platform, attempt unauthorized access, upload malicious content, or use EverittOS in
          violation of applicable law. You agree not to upload, export, share, or use content in violation of applicable
          laws, regulations, privacy rights, contractual obligations, or third-party rights. We may suspend accounts that
          violate these terms or pose a security risk.
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
