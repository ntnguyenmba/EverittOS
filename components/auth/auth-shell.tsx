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
      radial-gradient(circle at 14% 12%, rgba(45, 55, 72, 0.08), transparent 26%),
      linear-gradient(135deg, #fbfaf7 0%, #f4f1eb 46%, #ffffff 100%);
    color: #25272c;
  }

  .auth-shell {
    min-height: 100vh;
    max-width: 1440px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) minmax(460px, 0.78fr);
  }

  .auth-shell-main {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding: clamp(24px, 4vw, 56px);
  }

  .auth-shell-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: clamp(42px, 8vw, 104px);
  }

  .auth-shell-header .logo {
    color: #25272c;
    font-family: var(--font-display), 'Cormorant Garamond', Georgia, serif;
    font-size: 30px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .auth-shell-header .logo-mark {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: #2d3748;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.28), 0 18px 42px rgba(45,55,72,.18);
  }

  .auth-ventures-link,
  .auth-shell-footer a,
  .auth-links a {
    color: #2d3748;
    border-bottom: 1px solid rgba(45, 55, 72, 0.24);
  }

  .auth-shell-content {
    width: min(560px, 100%);
    margin: 0 auto;
    padding: 0 0 44px;
  }

  .auth-eyebrow {
    color: #2d3748;
    letter-spacing: 0.24em;
    font-family: var(--font-inter), Inter, sans-serif;
    font-size: 11px;
    text-transform: uppercase;
    margin-bottom: 18px;
  }

  .auth-title {
    color: #25272c;
    font-size: clamp(52px, 7.5vw, 82px);
    letter-spacing: -0.045em;
    line-height: 0.96;
    margin-bottom: 18px;
  }

  .auth-description {
    max-width: 460px;
    color: rgba(37, 39, 44, 0.66);
    font-size: 16px;
    line-height: 1.7;
    margin-bottom: 28px;
  }

  .auth-form.card {
    border: 1px solid rgba(45, 55, 72, 0.12);
    background: rgba(255, 255, 255, 0.86);
    backdrop-filter: blur(16px);
    border-radius: 24px;
    padding: clamp(24px, 4vw, 34px);
    box-shadow: 0 30px 80px rgba(45, 55, 72, 0.11);
  }

  .auth-field label {
    color: rgba(37, 39, 44, 0.7);
    font-size: 13px;
    letter-spacing: 0.02em;
  }

  .auth-form .input {
    border: 1px solid rgba(45, 55, 72, 0.14);
    background: #ffffff;
    color: #25272c;
    border-radius: 16px;
    min-height: 56px;
    padding: 14px 16px;
    box-shadow: inset 0 1px 0 rgba(45,55,72,.03);
  }

  .auth-form .input::placeholder {
    color: rgba(37, 39, 44, 0.36);
  }

  .auth-form .input:focus {
    border-color: rgba(45, 55, 72, 0.42);
    box-shadow: 0 0 0 4px rgba(45, 55, 72, 0.07);
  }

  .auth-form .btn-primary {
    width: 100%;
    min-height: 58px;
    justify-content: center;
    border: 1px solid #2d3748;
    background: #2d3748;
    color: #f7f6f3;
    border-radius: 18px;
    padding: 14px 20px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .auth-form .btn-primary:hover {
    background: #202938;
    border-color: #202938;
  }

  .auth-plan-note,
  .auth-message {
    border-radius: 16px;
  }

  .auth-plan-note {
    border: 1px solid rgba(45, 55, 72, 0.14);
    background: rgba(255, 255, 255, 0.72);
    color: #2d3748;
    padding: 13px 15px;
    font-size: 14px;
    margin-bottom: 16px;
  }

  .auth-links {
    margin-top: 20px;
    color: rgba(37, 39, 44, 0.66);
  }

  .auth-shell-footer {
    margin-top: auto;
    color: rgba(37, 39, 44, 0.54);
  }

  .auth-shell-aside {
    min-height: 100vh;
    border-left: 1px solid rgba(45, 55, 72, 0.1);
    background:
      linear-gradient(180deg, rgba(45,55,72,.9), rgba(32,39,51,.94)),
      linear-gradient(135deg, #2d3748, #202938);
    padding: clamp(28px, 5vw, 70px);
    color: #f7f6f3;
  }

  .auth-aside-panel {
    max-width: 520px;
    margin: auto;
    height: 100%;
    min-height: calc(100vh - 140px);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 28px;
  }

  .auth-aside-label {
    color: rgba(247, 246, 243, 0.62);
    letter-spacing: 0.26em;
    font-family: var(--font-inter), Inter, sans-serif;
    font-size: 11px;
    text-transform: uppercase;
  }

  .auth-aside-panel h2 {
    color: #f7f6f3;
    font-size: clamp(42px, 5vw, 64px);
    letter-spacing: -0.045em;
    line-height: 0.98;
    margin: 0;
  }

  .auth-aside-list {
    gap: 14px;
    padding-top: 8px;
  }

  .auth-aside-list li {
    color: rgba(247, 246, 243, 0.72);
    font-size: 15px;
  }

  .auth-aside-dot {
    width: 6px;
    height: 6px;
    background: #f7f6f3;
    opacity: .78;
  }

  .auth-aside-plans {
    margin-top: 8px;
    gap: 12px;
  }

  .auth-aside-plans div {
    border: 1px solid rgba(247, 246, 243, 0.16);
    background: rgba(247, 246, 243, 0.08);
    border-radius: 18px;
    padding: 16px 18px;
    backdrop-filter: blur(12px);
  }

  .auth-aside-plans span {
    color: rgba(247, 246, 243, 0.58);
    font-family: var(--font-inter), Inter, sans-serif;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .auth-aside-plans strong {
    color: #f7f6f3;
    font-weight: 500;
  }

  .auth-aside-caption {
    margin-top: 10px;
    padding-top: 22px;
    border-top: 1px solid rgba(247, 246, 243, 0.14);
    color: rgba(247, 246, 243, 0.58);
    font-size: 13px;
    line-height: 1.7;
  }

  @media (max-width: 959px) {
    .auth-shell {
      grid-template-columns: 1fr;
    }

    .auth-shell-main {
      min-height: auto;
    }

    .auth-shell-header {
      margin-bottom: 44px;
    }

    .auth-shell-aside {
      display: none;
    }

    .auth-title {
      font-size: clamp(42px, 14vw, 62px);
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
              . Field operations for asset care teams.
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
      <h2>Field work, asset care, and reporting without the clutter.</h2>
      <ul className="auth-aside-list">
        <li>
          <span className="auth-aside-dot" />
          Track jobs, clients, photos, and crew activity
        </li>
        <li>
          <span className="auth-aside-dot" />
          Keep service work organized from intake to report
        </li>
        <li>
          <span className="auth-aside-dot" />
          Built for operators, owners, and portfolio care
        </li>
      </ul>
      <div className="auth-aside-plans">
        <div>
          <span>Free</span>
          <strong>Start organized</strong>
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
      <p className="auth-aside-caption">
        A cleaner operating layer for service teams that need simple job control, client history, and polished field reporting.
      </p>
    </div>
  );
}
