import Link from 'next/link';
import type { ReactNode } from 'react';

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  aside?: ReactNode;
};

const authBrandStyles = `
  .auth-page {
    min-height: 100vh;
    background: #F7F6F3;
    color: #2A2A2A;
  }

  .auth-shell {
    min-height: 100vh;
    max-width: 1280px;
    margin: 0 auto;
  }

  .auth-shell-main {
    padding: clamp(24px, 4vw, 48px);
  }

  .auth-shell-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: clamp(40px, 7vw, 88px);
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(45, 55, 72, 0.12);
  }

  .auth-shell-header .logo {
    color: #2A2A2A;
    font-family: var(--font-display), 'Cormorant Garamond', Georgia, serif;
    font-size: 22px;
    font-weight: 500;
    letter-spacing: 0.04em;
  }

  .auth-shell-header .logo-mark {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: #2D3748;
  }

  .auth-ventures-link,
  .auth-shell-footer a,
  .auth-links a {
    color: #2D3748;
    border-bottom: 1px solid rgba(45, 55, 72, 0.2);
  }

  .auth-shell-content {
    width: min(480px, 100%);
    margin: 0 auto;
    padding: 0 0 48px;
  }

  .auth-eyebrow {
    color: #2D3748;
    letter-spacing: 0.22em;
    font-family: var(--font-inter), Inter, sans-serif;
    font-size: 11px;
    text-transform: uppercase;
  }

  .auth-title {
    color: #2A2A2A;
    font-size: clamp(40px, 6vw, 60px);
    letter-spacing: -0.03em;
    line-height: 1.05;
  }

  .auth-description,
  .auth-shell-footer p,
  .auth-field label,
  .auth-links {
    color: rgba(42, 42, 42, 0.68);
  }

  .auth-form.card {
    border: 1px solid rgba(45, 55, 72, 0.12);
    background: #FFFFFF;
    border-radius: 12px;
    padding: clamp(22px, 4vw, 28px);
    box-shadow: 0 1px 2px rgba(45, 55, 72, 0.04);
  }

  .auth-form .input {
    border: 1px solid rgba(45, 55, 72, 0.12);
    background: #FFFFFF;
    color: #2A2A2A;
    border-radius: 10px;
    padding: 12px 14px;
  }

  .auth-form .input::placeholder {
    color: rgba(42, 42, 42, 0.4);
  }

  .auth-form .input:focus {
    border-color: rgba(45, 55, 72, 0.35);
    box-shadow: 0 0 0 3px rgba(45, 55, 72, 0.06);
  }

  .auth-form .btn-primary {
    width: 100%;
    justify-content: center;
    border: 1px solid #2D3748;
    background: #2D3748;
    color: #F7F6F3;
    border-radius: 6px;
    padding: 12px 18px;
  }

  .auth-form .btn-primary:hover {
    background: #243041;
  }

  .auth-plan-note {
    border: 1px solid rgba(45, 55, 72, 0.12);
    background: rgba(45, 55, 72, 0.06);
    color: #2D3748;
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 14px;
    margin-bottom: 16px;
  }

  .auth-shell-aside {
    border-left: 1px solid rgba(45, 55, 72, 0.12);
    background: #FFFFFF;
    padding: clamp(28px, 4vw, 48px);
  }

  .auth-aside-panel {
    max-width: 420px;
    margin: auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 24px;
  }

  .auth-aside-label {
    color: rgba(42, 42, 42, 0.58);
    letter-spacing: 0.2em;
    font-family: var(--font-inter), Inter, sans-serif;
    font-size: 11px;
    text-transform: uppercase;
  }

  .auth-aside-panel h2 {
    color: #2A2A2A;
    font-size: clamp(32px, 4vw, 44px);
    letter-spacing: -0.03em;
    line-height: 1.1;
  }

  .auth-aside-list li {
    color: rgba(42, 42, 42, 0.68);
  }

  .auth-aside-dot {
    width: 6px;
    height: 6px;
    background: #2D3748;
  }

  .auth-aside-plans div {
    border: 1px solid rgba(45, 55, 72, 0.12);
    background: #F7F6F3;
    border-radius: 10px;
  }

  .auth-aside-plans span {
    color: rgba(42, 42, 42, 0.58);
    font-family: var(--font-inter), Inter, sans-serif;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .auth-aside-plans strong {
    color: #2A2A2A;
  }

  @media (max-width: 959px) {
    .auth-shell-header {
      margin-bottom: 40px;
    }

    .auth-ventures-link {
      font-size: 12px;
    }
  }
`;

export function AuthShell({ eyebrow, title, description, children, aside }: AuthShellProps) {
  return (
    <div className="auth-page">
      <style dangerouslySetInnerHTML={{ __html: authBrandStyles }} />
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
      <p className="auth-aside-label">Private operations board</p>
      <h2>Asset care, field work, and reporting in one place.</h2>
      <ul className="auth-aside-list">
        <li>
          <span className="auth-aside-dot" />
          Track active jobs and customer history
        </li>
        <li>
          <span className="auth-aside-dot" />
          Document work with photos and clean reports
        </li>
        <li>
          <span className="auth-aside-dot" />
          Built for service teams, operators, and portfolio care
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
