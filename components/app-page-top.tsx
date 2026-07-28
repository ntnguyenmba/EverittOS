'use client';

import { AppBackButton } from '@/components/app-back-button';
import { OrgSwitcher } from '@/components/org-switcher';
import { isClientRole, normalizeRole } from '@/lib/roles';

type AppPageTopProps = {
  role?: string | null;
  showBackButton?: boolean;
};

/** Shared top row for workspace switching and contextual back navigation. */
export function AppPageTop({ role, showBackButton = true }: AppPageTopProps) {
  const normalizedRole = normalizeRole(role);

  // Client portal pages have their own focused navigation. Never show workspace
  // switching here because invited clients may also have an auto-created personal
  // workspace, which makes the portal look duplicated and can send them away from
  // the job that was shared with them.
  if (isClientRole(normalizedRole)) return null;

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
