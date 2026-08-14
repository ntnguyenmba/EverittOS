'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type PortalShellNavProps = {
  links: Array<{ href: string; label: string }>;
  className?: string;
};

export function PortalShellNav({ links, className = 'contractor-nav' }: PortalShellNavProps) {
  const pathname = usePathname() || '/';
  const [hash, setHash] = useState('');

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  return (
    <nav className={className}>
      {links.map((item) => {
        const [itemPath, itemHash = ''] = item.href.split('#');
        const active = pathname === itemPath && (itemHash ? hash === `#${itemHash}` : !hash);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
            <span aria-hidden="true" className="portal-nav-mark" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
