import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';

type AuthShellProps = {
  title: string;
  children: ReactNode;
};

/** Single-column auth layout: logo, title, form, minimal legal footer. */
export function AuthShell({ title, children }: AuthShellProps) {
  return (
    <main id="main-content" className="auth-page">
      <div className="auth-shell">
        <div className="auth-shell-main">
          <header className="auth-shell-header auth-shell-header-centered">
            <BrandLogo href="/" size={40} showName />
            <div className="auth-shell-language">
              <LanguageSwitcher id="auth-language" variant="compact" />
            </div>
          </header>

          <div className="auth-shell-content">
            <h1 className="auth-title">{title}</h1>
            {children}
          </div>

          <footer className="auth-shell-footer">
            <p>
              <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/cookies">Cookies</Link> ·{' '}
              <Link href="/security">Security</Link>
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
