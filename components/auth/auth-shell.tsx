import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { BrandLogo } from '@/components/brand-logo';
import { LocaleSwitcher } from '@/components/locale-switcher';

type AuthShellProps = {
  title: string;
  children: ReactNode;
};

/** Single-column auth layout: logo, title, form, language selector, minimal legal footer. */
export function AuthShell({ title, children }: AuthShellProps) {
  const t = useTranslations('common');

  return (
    <main id="main-content" className="auth-page">
      <div className="auth-shell">
        <div className="auth-shell-main">
          <header className="auth-shell-header auth-shell-header-centered auth-shell-header-with-locale">
            <BrandLogo href="/" size={40} showName />
            <LocaleSwitcher compact showLabel={false} />
          </header>

          <div className="auth-shell-content">
            <h1 className="auth-title">{title}</h1>
            {children}
          </div>

          <footer className="auth-shell-footer">
            <p>
              <Link href="/terms">{t('terms')}</Link> · <Link href="/privacy">{t('privacy')}</Link>
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
