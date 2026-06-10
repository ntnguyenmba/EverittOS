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
    background:
      radial-gradient(circle at 16% 12%, rgba(199, 184, 154, 0.16), transparent 28%),
      radial-gradient(circle at 88% 20%, rgba(79, 98, 122, 0.18), transparent 30%),
      linear-gradient(135deg, #f7f3ec 0%, #eee7dc 46%, #d8cec0 100%);
    color: #182232;
  }

  .auth-page::before {
    content: '';
    position: fixed;
    inset: 18px;
    border: 1px solid rgba(43, 54, 71, 0.14);
    border-radius: 28px;
    pointer-events: none;
  }

  .auth-shell {
    min-height: 100vh;
    max-width: 1440px;
    margin: 0 auto;
  }

  .auth-shell-main {
    padding: clamp(20px, 4vw, 54px);
  }

  .auth-shell-header {
    margin-bottom: clamp(44px, 8vw, 104px);
  }

  .auth-shell-header .logo {
    color: #1d2a3b;
    font-family: var(--font-display), 'Cormorant Garamond', Georgia, serif;
    font-size: 22px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .auth-shell-header .logo-mark {
    width: 34px;
    height: 34px;
    border: 1px solid rgba(43, 54, 71, 0.28);
    border-radius: 50%;
    background: linear-gradient(135deg, #2b3647, #4b5d73);
    box-shadow: 0 18px 34px rgba(43, 54, 71, 0.18);
  }

  .auth-ventures-link,
  .auth-shell-footer a,
  .auth-links a {
    color: #2b3647;
    border-bottom: 1px solid rgba(43, 54, 71, 0.28);
  }

  .auth-shell-content {
    width: min(500px, 100%);
    margin: 0 auto;
    padding: 0 0 48px;
  }

  .auth-eyebrow {
    color: #8a765f;
    letter-spacing: 0.28em;
  }

  .auth-title {
    color: #182232;
    font-size: clamp(40px, 6vw, 64px);
    letter-spacing: -0.035em;
  }

  .auth-description,
  .auth-shell-footer p,
  .auth-field label,
  .auth-links {
    color: rgba(24, 34, 50, 0.68);
  }

  .auth-form.card {
    border: 1px solid rgba(43, 54, 71, 0.14);
    background: rgba(255, 252, 247, 0.72);
    border-radius: 28px;
    padding: clamp(20px, 4vw, 30px);
    box-shadow: 0 28px 80px rgba(43, 54, 71, 0.12);
    backdrop-filter: blur(18px);
  }

  .auth-form .input {
    border: 1px solid rgba(43, 54, 71, 0.16);
    background: rgba(255, 255, 255, 0.68);
    color: #182232;
    border-radius: 16px;
    padding: 14px 15px;
  }

  .auth-form .input::placeholder {
    color: rgba(24, 34, 50, 0.38);
  }

  .auth-form .input:focus {
    border-color: rgba(138, 118, 95, 0.55);
    box-shadow: 0 0 0 4px rgba(138, 118, 95, 0.1);
  }

  .auth-form .btn-primary {
    width: 100%;
    justify-content: center;
    border: 1px solid #2b3647;
    background: #2b3647;
    color: #fbf8f1;
    border-radius: 999px;
    padding: 14px 18px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .auth-form .btn-primary:hover {
    background: #1d2a3b;
  }

  .auth-plan-note {
    border: 1px solid rgba(138, 118, 95, 0.24);
    background: rgba(255, 252, 247, 0.56);
    color: #5e4f3f;
  }

  .auth-shell-aside {
    border-left: 1px solid rgba(43, 54, 71, 0.12);
    background:
      linear-gradient(180deg, rgba(43, 54, 71, 0.9), rgba(29, 42, 59, 0.94)),
      radial-gradient(circle at 50% 14%, rgba(199, 184, 154, 0.22), transparent 34%);
  }

  .auth-aside-panel {
    border: 1px solid rgba(247, 243, 236, 0.14);
    border-radius: 34px;
    padding: clamp(26px, 4vw, 42px);
    background: rgba(255, 255, 255, 0.045);
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.24);
  }

  .auth-aside-label {
    color: rgba(247, 243, 236, 0.58);
    letter-spacing: 0.28em;
  }

  .auth-aside-panel h2 {
    color: #fbf8f1;
    font-size: clamp(34px, 4vw, 54px);
    letter-spacing: -0.035em;
  }

  .auth-aside-list li {
    color: rgba(247, 243, 236, 0.72);
  }

  .auth-aside-dot {
    width: 7px;
    height: 7px;
    background: #c7b89a;
  }

  .auth-aside-plans div {
    border: 1px solid rgba(247, 243, 236, 0.14);
    background: rgba(255, 255, 255, 0.05);
    border-radius: 18px;
  }

  .auth-aside-plans span {
    color: rgba(247, 243, 236, 0.56);
  }

  .auth-aside-plans strong {
    color: #fbf8f1;
  }

  @media (max-width: 959px) {
    .auth-page::before {
      inset: 10px;
      border-radius: 22px;
    }

    .auth-shell-header {
      margin-bottom: 48px;
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
