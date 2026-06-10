import Link from 'next/link';
import type { ReactNode } from 'react';

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  aside?: ReactNode;
};

export function AuthShell({ eyebrow, title, description, children, aside }: AuthShellProps) {
  return (
    <div className="auth-page">
      <main className="auth-shell">
        <div className="auth-shell-main">
          <header className="auth-shell-header">
            <Link href="/" className="logo">
              <span className="logo-mark" />
              EverittOS
            </Link>
            <Link href="https://everittventures.com/tech" className="auth-ventures-link">
              Everitt Ventures Tech
            </Link>
          </header>

          <div className="auth-shell-content">
            <p className="auth-eyebrow">{eyebrow}</p>
            <h1 className="auth-title">{title}</h1>
            <p className="auth-description">{description}</p>
            {children}
          </div>

          <footer className="auth-shell-footer">
            <p>
              Part of{' '}
              <a href="https://everittventures.com/tech" target="_blank" rel="noopener noreferrer">
                Everitt Ventures
              </a>
              . Field operations for service teams.
            </p>
          </footer>
        </div>

        {aside ? <aside className="auth-shell-aside">{aside}</aside> : null}
      </main>
    </div>
  );
}

export function AuthAsidePanel() {
  return (
    <div className="auth-aside-panel">
      <p className="auth-aside-label">Operations board</p>
      <h2>Jobs, crews, photos, and reports in one place.</h2>
      <ul className="auth-aside-list">
        <li>
          <span className="auth-aside-dot" />
          Track active jobs and customer history
        </li>
        <li>
          <span className="auth-aside-dot" />
          Document field work with photos and reports
        </li>
        <li>
          <span className="auth-aside-dot" />
          Scale from solo operator to full crew
        </li>
      </ul>
      <div className="auth-aside-plans">
        <div>
          <span>Free</span>
          <strong>Get organized</strong>
        </div>
        <div>
          <span>Pro</span>
          <strong>$9/month</strong>
        </div>
        <div>
          <span>Business</span>
          <strong>$39/month</strong>
        </div>
      </div>
    </div>
  );
}
