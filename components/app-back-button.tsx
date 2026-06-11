'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { hasAppBackTarget, navigateAppBack } from '@/lib/app-navigation-stack';

type AppBackButtonProps = {
  role?: string | null;
  className?: string;
};

export function AppBackButton({ role, className }: AppBackButtonProps) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const fallback = dashboardPathForRole(role);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(hasAppBackTarget(pathname, fallback));
  }, [pathname, fallback]);

  function handleBack() {
    navigateAppBack(router, fallback, pathname);
  }

  if (!visible) return null;

  const classes = className ? `app-back-button ${className}` : 'app-back-button';

  return (
    <button type="button" className={classes} onClick={handleBack} aria-label="Go back">
      <span className="app-back-arrow" aria-hidden="true">
        ←
      </span>
      <span className="app-back-label">Back</span>
    </button>
  );
}
