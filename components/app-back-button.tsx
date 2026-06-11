'use client';

import { useRouter } from 'next/navigation';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { navigateAppBack } from '@/lib/app-navigation-stack';

type AppBackButtonProps = {
  role?: string | null;
  className?: string;
};

export function AppBackButton({ role, className }: AppBackButtonProps) {
  const router = useRouter();
  const fallback = dashboardPathForRole(role);

  function handleBack() {
    navigateAppBack(router, fallback);
  }

  return (
    <button
      type="button"
      className={className ? `app-back-button ${className}` : 'app-back-button'}
      onClick={handleBack}
      aria-label="Go back"
    >
      <span className="app-back-arrow" aria-hidden="true">
        ←
      </span>
      Back
    </button>
  );
}
