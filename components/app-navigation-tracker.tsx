'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { recordAppNavigation } from '@/lib/app-navigation-stack';

/** Tracks authenticated in-app navigation for AppBackButton. */
export function AppNavigationTracker() {
  const pathname = usePathname();

  useEffect(() => {
    recordAppNavigation(pathname);
  }, [pathname]);

  return null;
}
