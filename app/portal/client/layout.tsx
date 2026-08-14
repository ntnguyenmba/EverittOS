import Link from 'next/link';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppFooter } from '@/components/app-footer';
import { OrgSwitcher } from '@/components/org-switcher';
import { LOCALE_COOKIE_NAME, normalizeLocale, type Locale } from '@/lib/i18n/config';
import '../contractor/contractor-minimal.css';

type ClientLayoutProps = {
  children: ReactNode;
};

const copy: Record<Locale, {
  appointments: string;
  settings: string;
  navAria: string;
  subtitle: string;
  roleNote: string;
}> = {
  en: {
    appointments: 'Appointments',
    settings: 'Settings',
    navAria: 'Client navigation',
    subtitle: 'Client portal',
    roleNote: 'Your appointments, photos, reports, and invoices in one place.'
  },
  es: {
    appointments: 'Citas',
    settings: 'Configuración',
    navAria: 'Navegación del cliente',
    subtitle: 'Portal del cliente',
    roleNote: 'Sus citas, fotos, informes y facturas en un solo lugar.'
  },
  vi: {
    appointments: 'Lịch hẹn',
    settings: 'Cài đặt',
    navAria: 'Điều hướng khách hàng',
    subtitle: 'Cổng khách hàng',
    roleNote: 'Lịch hẹn, ảnh, báo cáo và hóa đơn của bạn ở cùng một nơi.'
  }
};

export default async function ClientLayout({ children }: ClientLayoutProps) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const c = copy[locale];

  const clientLinks = [
    { href: '/portal/client/jobs', label: c.appointments },
    { href: '/portal/client/settings', label: c.settings }
  ];

  return (
    <div className="dashboard-shell contractor-dashboard-shell client-dashboard-shell">
      <div className="contractor-background" aria-hidden="true" />

      <div className="dashboard-shell-mobile contractor-mobile-header">
        <Link className="contractor-mobile-brand" href="/portal/client/jobs">
          EverittOS
        </Link>
        <div className="portal-header-actions">
          <OrgSwitcher />
          <Link className="btn" href="/portal/client/settings">
            {c.settings}
          </Link>
        </div>
      </div>

      <aside className="sidebar contractor-sidebar" aria-label={c.navAria}>
        <div className="contractor-sidebar-inner">
          <Link className="contractor-brand" href="/portal/client/jobs">
            <span className="contractor-brand-mark" aria-hidden="true">E</span>
            <span>
              <strong>EverittOS</strong>
              <small>{c.subtitle}</small>
            </span>
          </Link>

          <OrgSwitcher />

          <nav className="contractor-nav">
            {clientLinks.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <main id="main-content" className="main contractor-main client-main">
        {children}
        <AppFooter />
      </main>
    </div>
  );
}
