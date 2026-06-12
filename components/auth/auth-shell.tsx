import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';

type AuthShellProps = {
  title: string;
  children: ReactNode;
};

/** Centered auth layout with a muted full-page hero backdrop. */
export function AuthShell({ title, children }: AuthShellProps) {
  return (
    <main id="main-content" className="auth-page auth-orphic-page">
      <div className="auth-orphic-background" aria-hidden="true" />
      <div className="auth-orphic-overlay" aria-hidden="true" />

      <div className="auth-shell auth-orphic-shell">
        <div className="auth-shell-main auth-orphic-main">
          <header className="auth-shell-header auth-orphic-header">
            <BrandLogo href="/" size={44} showName />
            <div className="auth-shell-language auth-orphic-language">
              <LanguageSwitcher id="auth-language" variant="compact" />
            </div>
          </header>

          <section className="auth-glass-card" aria-labelledby="auth-page-title">
            <div className="auth-card-brandline">
              <BrandLogo href="/" size={34} showName={false} />
              <span>EverittOS</span>
            </div>
            <h1 id="auth-page-title" className="auth-title">
              {title}
            </h1>
            <p className="auth-card-subtitle">Run your business from one place.</p>
            {children}
          </section>

          <footer className="auth-shell-footer auth-orphic-footer">
            <p>
              <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/cookies">Cookies</Link> ·{' '}
              <Link href="/security">Security</Link>
            </p>
          </footer>
        </div>
      </div>

      <style>{`
        .auth-orphic-page {
          position: relative;
          min-height: 100svh;
          overflow: hidden;
          isolation: isolate;
          background: #f7f6f3;
        }

        .auth-orphic-background {
          position: fixed;
          inset: -18px;
          z-index: -3;
          background-image: url('https://raw.githubusercontent.com/ntnguyenmba/EverittOS/main/hero.jpg');
          background-size: cover;
          background-position: center;
          filter: blur(10px) saturate(0.82);
          transform: scale(1.04);
          opacity: 0.58;
        }

        .auth-orphic-overlay {
          position: fixed;
          inset: 0;
          z-index: -2;
          background:
            radial-gradient(circle at 50% 36%, rgba(255, 255, 255, 0.62), rgba(247, 246, 243, 0.86) 46%, rgba(247, 246, 243, 0.94) 100%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.72), rgba(247, 246, 243, 0.9));
        }

        .auth-orphic-overlay::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent 0 45%, rgba(45, 55, 72, 0.12) 100%);
          pointer-events: none;
        }

        .auth-orphic-shell {
          position: relative;
          z-index: 1;
          display: block;
          min-height: 100svh;
          background: transparent;
        }

        .auth-orphic-main {
          min-height: 100svh;
          display: grid;
          grid-template-rows: auto 1fr auto;
          place-items: center;
          padding: clamp(20px, 4vw, 40px);
        }

        .auth-orphic-header {
          width: min(1040px, 100%);
          margin: 0 auto;
          justify-content: space-between;
          align-self: start;
        }

        .auth-orphic-language select,
        .auth-orphic-language button {
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(12px);
        }

        .auth-glass-card {
          width: min(480px, 100%);
          margin: clamp(28px, 6vh, 64px) auto;
          padding: clamp(24px, 4vw, 38px);
          border: 1px solid rgba(255, 255, 255, 0.68);
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.72);
          box-shadow: 0 28px 80px rgba(45, 55, 72, 0.16), 0 1px 0 rgba(255, 255, 255, 0.78) inset;
          backdrop-filter: blur(24px);
        }

        .auth-card-brandline {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 22px;
          color: var(--text);
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        .auth-card-brandline .brand-logo-image {
          border-radius: 12px;
          box-shadow: 0 10px 24px rgba(45, 55, 72, 0.12);
        }

        .auth-glass-card .auth-title {
          margin-bottom: 8px;
          font-size: clamp(30px, 5vw, 40px);
          line-height: 1.12;
          letter-spacing: -0.035em;
        }

        .auth-card-subtitle {
          margin: 0 0 24px;
          color: var(--muted);
          font-size: 17px;
          line-height: 1.55;
        }

        .auth-glass-card .auth-methods-note {
          margin: -6px 0 18px;
          font-size: 15px;
        }

        .auth-glass-card .auth-form.card {
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        .auth-glass-card .input {
          min-height: 52px;
          border-color: rgba(45, 55, 72, 0.16);
          background: rgba(255, 255, 255, 0.78);
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.78) inset;
        }

        .auth-glass-card .btn {
          min-height: 52px;
          border-radius: 999px;
        }

        .auth-glass-card .btn-primary {
          box-shadow: 0 16px 36px rgba(45, 55, 72, 0.18);
        }

        .auth-glass-card .auth-links {
          justify-content: center;
          margin-top: 20px;
          gap: 14px 22px;
          font-size: 15px;
        }

        .auth-orphic-footer {
          align-self: end;
          padding-top: 0;
          margin-top: 0;
        }

        .auth-orphic-footer p {
          margin: 0;
          color: rgba(42, 42, 42, 0.68);
        }

        @media (min-width: 960px) {
          .auth-orphic-shell {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .auth-orphic-main {
            padding: 18px 14px 20px;
          }

          .auth-orphic-header {
            gap: 12px;
          }

          .auth-orphic-header .brand-logo-name {
            font-size: 20px;
          }

          .auth-glass-card {
            margin: 22px auto;
            padding: 22px;
            border-radius: 22px;
          }

          .auth-card-brandline {
            margin-bottom: 18px;
          }

          .auth-glass-card .auth-title {
            font-size: 30px;
          }

          .auth-card-subtitle {
            font-size: 16px;
          }

          .auth-password-row {
            display: grid;
            grid-template-columns: 1fr;
          }

          .auth-password-toggle {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
