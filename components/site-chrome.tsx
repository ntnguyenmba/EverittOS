'use client';

import { usePathname } from 'next/navigation';
import { Nav } from '@/components/nav';

const LEGAL_PATHS = new Set(['/terms', '/privacy', '/cookies', '/disclaimer', '/security', '/docs/api']);

function isLegalPath(pathname: string): boolean {
  return LEGAL_PATHS.has(pathname);
}

export function SiteChrome() {
  const pathname = usePathname() || '/';

  if (!isLegalPath(pathname)) {
    return null;
  }

  return <Nav />;
}

export function SkipToMain() {
  return (
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
  );
}
