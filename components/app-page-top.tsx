'use client';

import { AppBackButton } from '@/components/app-back-button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { OrgSwitcher } from '@/components/org-switcher';
import { isClientRole, normalizeRole } from '@/lib/roles';

type AppPageTopProps = {
  role?: string | null;
  showBackButton?: boolean;
};

/** Shared top row for workspace switching and contextual back navigation. */
export function AppPageTop({ role, showBackButton = true }: AppPageTopProps) {
  const normalizedRole = normalizeRole(role);

  // Client portal pages keep focused navigation and never show workspace switching.
  // Keep the language selector visible on every client-facing portal view so invited
  // clients can change language without opening account settings first.
  if (isClientRole(normalizedRole)) {
    return (
      <div className="app-page-top">
        <div style={{ marginLeft: 'auto', width: 'min(100%, 8.75rem)' }}>
          <LanguageSwitcher id="client-portal-language" variant="compact" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-page-top">
      <OrgSwitcher />
      {showBackButton ? (
        <div className="app-page-top-actions">
          <AppBackButton role={role} />
        </div>
      ) : null}
    </div>
  );
}
