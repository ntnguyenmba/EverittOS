'use client';

import { usePathname } from 'next/navigation';
import { Nav } from '@/components/nav';

const MARKETING_PATHS = new Set([
  '/',
  '/product',
  '/industries',
  '/pricing',
  '/demo',
  '/terms',
  '/privacy',
  '/disclaimer',
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
