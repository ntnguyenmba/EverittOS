'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppNavItems } from '@/components/app-nav-items';
import { LanguageSwitcher } from '@/components/language-switcher';
import { OrgSwitcher } from '@/components/org-switcher';
import { useTranslation } from '@/components/locale-provider';
import { useWorkspacePlanOptional } from '@/components/workspace-plan-provider';
import { dashboardPathForRole } from '@/lib/dashboard-nav';
import { navLabel } from '@/lib/nav-i18n';
import { CLIENT_PORTAL_HOME, CONTRACTOR_PORTAL_HOME } from '@/lib/portal-access';
import { isClientRole, isContractorRole, normalizeRole } from '@/lib/roles';

const HIDDEN_PREFIXES = ['/login', '/signup', '/auth', '/onboarding', '/pricing', '/privacy', '/terms', '/cookies', '/disclaimer', '/security', '/book'];
const PORTAL_VISIBLE_JOBS = 10;
const bottomCopy = {
  en: { home: 'Home', jobs: 'Jobs', customers: 'Customers', quotes: 'Quotes', more: 'More', workspace: 'Workspace', language: 'Language', logout: 'Log out', close: 'Close', showAll: 'Show all jobs', showLess: 'Show fewer jobs' },
  es: { home: 'Inicio', jobs: 'Trabajos', customers: 'Clientes', quotes: 'Cotizar', more: 'Más', workspace: 'Espacio de trabajo', language: 'Idioma', logout: 'Cerrar sesión', close: 'Cerrar', showAll: 'Mostrar todos los trabajos', showLess: 'Mostrar menos trabajos' },
  vi: { home: 'Trang chủ', jobs: 'Công việc', customers: 'Khách hàng', quotes: 'Báo giá', more: 'Thêm', workspace: 'Không gian làm việc', language: 'Ngôn ngữ', logout: 'Đăng xuất', close: 'Đóng', showAll: 'Hiện tất cả công việc', showLess: 'Hiện ít công việc hơn' }
} as const;

function Icon({ name }: { name: 'home' | 'jobs' | 'customers' | 'quotes' | 'more' | 'money' }) {
  const common = { width: 23, height: 23, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'home') return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-7h6v7" /></svg>;
  if (name === 'jobs') return <svg {...common}><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M8 6V4h8v2M3 11h18M10 11v2h4v-2" /></svg>;
  if (name === 'customers') return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.4-4 2.3-6 5.5-6s5.1 2 5.5 6" /><path d="M16 8.5a2.5 2.5 0 1 0 0-5M16 14c2.7.2 4.2 2.1 4.5 5" /></svg>;
  if (name === 'quotes') return <svg {...common}><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h5M8 17h3" /></svg>;
  if (name === 'money') return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M7 9H5v2M17 15h2v-2" /></svg>;
  return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
}

function activeFor(pathname: string, href: string) {
  const path = href.split(/[?#]/)[0];
  if (path === '/dashboard' || path === CLIENT_PORTAL_HOME || path === CONTRACTOR_PORTAL_HOME) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { t, locale } = useTranslation();
  const workspace = useWorkspacePlanOptional();
  const role = normalizeRole(workspace?.role);
  const bc = bottomCopy[locale] || bottomCopy.en;
  const [moreOpen, setMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    document.body.classList.toggle('mobile-more-open', moreOpen);
    document.body.style.overflow = moreOpen ? 'hidden' : '';
    return () => {
      document.body.classList.remove('mobile-more-open');
      document.body.style.overflow = '';
    };
  }, [moreOpen]);

  const excludeHrefs = useMemo(
    () => (isClientRole(role) ? [CLIENT_PORTAL_HOME] : isContractorRole(role) ? [CONTRACTOR_PORTAL_HOME] : ['/dashboard', '/jobs', '/customers', '/quotes']),
    [role]
  );
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;
  if (!workspace?.plan && !workspace?.role) return null;

  const links = isClientRole(role)
    ? [
        { href: CLIENT_PORTAL_HOME, label: t('portal.common.overview'), icon: 'home' as const },
        { href: `${CLIENT_PORTAL_HOME}?tab=jobs`, label: t('portal.common.appointments'), icon: 'jobs' as const },
        { href: '#more', label: bc.more, icon: 'more' as const, menu: true }
      ]
    : isContractorRole(role)
      ? [
          { href: CONTRACTOR_PORTAL_HOME, label: t('portal.contractor.nav.dashboard'), icon: 'home' as const },
          { href: `${CONTRACTOR_PORTAL_HOME}#current-jobs`, label: t('portal.contractor.nav.jobs'), icon: 'jobs' as const },
          { href: `${CONTRACTOR_PORTAL_HOME}#history`, label: t('portal.contractor.nav.earnings'), icon: 'money' as const },
          { href: '#more', label: bc.more, icon: 'more' as const, menu: true }
        ]
      : [
          { href: dashboardPathForRole(role), label: bc.home, icon: 'home' as const },
          { href: '/quotes', label: bc.quotes, icon: 'quotes' as const },
          { href: '/jobs', label: navLabel('/jobs', t, bc.jobs, locale), icon: 'jobs' as const },
          { href: '/customers', label: navLabel('/customers', t, bc.customers, locale), icon: 'customers' as const },
          { href: '#more', label: bc.more, icon: 'more' as const, menu: true }
        ];

  const sheet =
    moreOpen && mounted
      ? createPortal(
          <div
            className="everitt-more-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2147483000,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: '16px 12px 96px',
              background: 'rgba(19, 36, 51, 0.45)',
              pointerEvents: 'auto'
            }}
            onClick={() => setMoreOpen(false)}
          >
            <section
              className="everitt-more-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={bc.more}
              style={{
                position: 'relative',
                zIndex: 2147483001,
                width: 'min(520px, 100%)',
                maxHeight: '72vh',
                overflow: 'auto',
                background: '#fff',
                color: '#132433',
                borderRadius: 22,
                padding: 16,
                pointerEvents: 'auto'
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="everitt-more-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong>{bc.more}</strong>
                <button type="button" className="everitt-more-close" onClick={() => setMoreOpen(false)}>
                  {bc.close}
                </button>
              </div>
              <div className="everitt-more-links">
                {workspace?.plan ? (
                  <AppNavItems plan={workspace.plan} role={role} excludeHrefs={excludeHrefs} linkClassName="everitt-more-link" onNavigate={() => setMoreOpen(false)} />
                ) : null}
              </div>
              <div className="everitt-more-settings">
                <div className="everitt-more-field">
                  <span>{bc.workspace}</span>
                  <OrgSwitcher />
                </div>
                <div className="everitt-more-field">
                  <span>{bc.language}</span>
                  <LanguageSwitcher id="bottom-more-language" variant="drawer" />
                </div>
                <button
                  type="button"
                  className="everitt-more-logout"
                  onClick={async () => {
                    setMoreOpen(false);
                    const { performClientLogout } = await import('@/lib/client-logout');
                    await performClientLogout(router);
                  }}
                >
                  {bc.logout}
                </button>
              </div>
            </section>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <nav className={`everitt-bottom-nav everitt-bottom-nav-${links.length}`} aria-label={t('ux.mobileNavLabel')}>
        {links.map((item) =>
          'menu' in item && item.menu ? (
            <button key="more" type="button" className={`everitt-bottom-nav-item everitt-bottom-nav-button${moreOpen ? ' is-active' : ''}`} onClick={() => setMoreOpen(true)}>
              <span className="everitt-bottom-nav-icon">
                <Icon name={item.icon} />
              </span>
              <span className="everitt-bottom-nav-label">{item.label}</span>
            </button>
          ) : (
            <Link key={item.href} href={item.href} className={`everitt-bottom-nav-item${activeFor(pathname, item.href) ? ' is-active' : ''}`} aria-current={activeFor(pathname, item.href) ? 'page' : undefined}>
              <span className="everitt-bottom-nav-icon">
                <Icon name={item.icon} />
              </span>
              <span className="everitt-bottom-nav-label">{item.label}</span>
            </Link>
          )
        )}
      </nav>
      {sheet}
    </>
  );
}
