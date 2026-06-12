'use client';

import { AppBackButton } from '@/components/app-back-button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { OrgSwitcher } from '@/components/org-switcher';

type AppPageTopProps = {
  role?: string | null;
  showBackButton?: boolean;
};

/** Shared top row: org switcher and back navigation. */
export function AppPageTop({ role, showBackButton = true }: AppPageTopProps) {
  return (
    <div className="app-page-top">
      <OrgSwitcher />
      <div className="app-page-top-actions">
        <LanguageSwitcher id="page-top-language" variant="compact" className="app-page-top-language" />
        {showBackButton ? <AppBackButton role={role} /> : null}
      </div>
    </div>
  );
}
