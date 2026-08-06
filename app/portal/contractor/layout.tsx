import Link from 'next/link';
import type { ReactNode } from 'react';
import './contractor-minimal.css';

type ContractorLayoutProps = {
  children: ReactNode;
};

const contractorLinks = [
  { href: '/portal/contractor', label: 'Dashboard' },
  { href: '/portal/contractor#jobs', label: 'Jobs' },
  { href: '/portal/contractor#schedule', label: 'Schedule' },
  { href: '/portal/contractor#earnings', label: 'Earnings' },
  { href: '/portal/contractor/settings', label: 'Settings' }
];

export default function ContractorLayout({ children }: ContractorLayoutProps) {
  return (
    <div className="dashboard-shell contractor-dashboard-shell">
      <div className="contractor-background" aria-hidden="true" />

      <div className="dashboard-shell-mobile contractor-mobile-header">
        <Link className="contractor-mobile-brand" href="/portal/contractor">
          EverittOS
        </Link>
        <Link className="btn" href="/portal/contractor/settings">
          Settings
        </Link>
      </div>

      <aside className="sidebar contractor-sidebar" aria-label="Contractor navigation">
        <div className="contractor-sidebar-inner">
          <Link className="contractor-brand" href="/portal/contractor">
            <span className="contractor-brand-mark" aria-hidden="true">E</span>
            <span>
              <strong>EverittOS</strong>
              <small>Contractor portal</small>
            </span>
          </Link>

          <nav className="contractor-nav">
            {contractorLinks.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <p className="contractor-role-note">
            You can only view work assigned or shared with your contractor profile.
          </p>
        </div>
      </aside>

      <div className="main contractor-main">{children}</div>
    </div>
  );
}
