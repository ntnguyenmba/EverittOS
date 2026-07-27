'use client';

import Link from 'next/link';
import { AuthenticatedSection } from '@/components/authenticated-section';
import { PortalAccountSettings } from '@/components/portal/portal-account-settings';
import { CLIENT_HOME_PATH, CLIENT_SETTINGS_PATH } from '@/lib/client-portal';

export default function ClientPortalSettingsPage() {
  return (
    <AuthenticatedSection role="client">
      <header style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 4 }}>
          Customer portal
        </p>
        <h1>Account settings</h1>
        <p className="muted">Manage your profile, notifications, legal links, and account deletion.</p>
        <div className="button-row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
          <Link href={CLIENT_HOME_PATH} className="btn">
            Back to overview
          </Link>
          <Link href={CLIENT_SETTINGS_PATH} className="btn btn-primary" aria-current="page">
            Account
          </Link>
        </div>
      </header>

      <PortalAccountSettings
        variant="client"
        homeHref={CLIENT_HOME_PATH}
        legalLinks={[
          { href: '/privacy', label: 'Privacy Policy' },
          { href: '/terms', label: 'Terms of Service' },
          { href: '/disclaimer', label: 'General Disclaimer' },
          { href: '/disclaimer/customer', label: 'Customer Portal Disclaimer' }
        ]}
      />
    </AuthenticatedSection>
  );
}
