'use client';

import { usePathname } from 'next/navigation';
import { Nav } from '@/components/nav';

const MARKETING_PATHS = new Set([
  '/',
  '/product',
  '/industries',
  '/pricing',
  '/terms',
  '/privacy',
  '/cookies',
  '/disclaimer',
  '/security',
  '/docs/api'
]);

function isMarketingPath(pathname: string): boolean {
  if (MARKETING_PATHS.has(pathname)) return true;
  return false;
}

export function SiteChrome() {
  const pathname = usePathname() || '/';

  if (!isMarketingPath(pathname)) {
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
