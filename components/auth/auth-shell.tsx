import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';

type AuthShellProps = {
  title: string;
  children: ReactNode;
};

/** Centered auth layout with a visible muted hero backdrop. */
export function AuthShell({ title, children }: AuthShellProps) {
  return (
    <main id="main-content" className="auth-page auth-orphic-page">
      <div className="auth-orphic-background" aria-hidden="true" />
      <div className="auth-orphic-overlay" aria-hidden="true" />

      <div className="auth-orphic-shell">
        <header className="auth-orphic-header">
          <BrandLogo href="/" size={44} showName />
          <div className="auth-shell-language auth-orphic-language">
            <LanguageSwitcher id="auth-language" variant="compact" />
          </div>
        </header>

        <section className="auth-glass-card" aria-labelledby="auth-page-title">
          <h1 id="auth-page-title" className="auth-title">
            {title}
          </h1>
          <p className="auth-card-subtitle">Run your business from one place.</p>
          {children}
          <p className="auth-legal-note">
            By continuing, you agree to the <Link href="/terms">Terms</Link> and acknowledge the{' '}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </section>

        <footer className="auth-orphic-footer">
          <p>
            <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/cookies">Cookies</Link> ·{' '}
            <Link href="/security">Security</Link>
          </p>
        </footer>
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
          inset: 0;
          z-index: -3;
          background-image: url('/hero.jpg');
          background-size: cover;
          background-position: center;
          opacity: 0.46;
          transform: scale(1.01);
        }

        .auth-orphic-overlay {
          position: fixed;
          inset: 0;
          z-index: -2;
          background:
            linear-gradient(90deg, rgba(247, 246, 243, 0.72), rgba(247, 246, 243, 0.46) 42%, rgba(247, 246, 243, 0.74)),
            radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.14), rgba(247, 246, 243, 0.5) 58%, rgba(45, 55, 72, 0.16));
          backdrop-filter: blur(2px) saturate(0.9);
        }

        .auth-orphic-shell {
          position: relative;
          z-index: 1;
          min-height: 100svh;
          display: grid;
          grid-template-rows: auto 1fr auto;
          align-items: center;
          padding: clamp(18px, 4vw, 42px);
        }

        .auth-orphic-header {
          width: min(1120px, 100%);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .auth-orphic-language select,
        .auth-orphic-language button {
          background: rgba(255, 255, 255, 0.84);
          backdrop-filter: blur(12px);
        }

        .auth-glass-card {
          width: min(430px, 100%);
          margin: clamp(26px, 7vh, 72px) auto;
          padding: clamp(26px, 4vw, 36px);
          border: 1px solid rgba(255, 255, 255, 0.72);
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.66);
          box-shadow: 0 24px 70px rgba(25, 38, 55, 0.16), 0 1px 0 rgba(255, 255, 255, 0.78) inset;
          backdrop-filter: blur(20px);
        }

        .auth-glass-card .brand-logo,
        .auth-glass-card .auth-card-brandline {
          display: none;
        }

        .auth-glass-card .auth-title {
          margin-bottom: 8px;
          font-size: clamp(30px, 5vw, 38px);
          line-height: 1.12;
          letter-spacing: -0.035em;
        }

        .auth-card-subtitle {
          margin: 0 0 22px;
          color: var(--muted);
          font-size: 16px;
          line-height: 1.55;
        }

        .auth-glass-card .auth-methods-note {
          margin: -4px 0 16px;
          font-size: 14px;
        }

        .auth-glass-card .auth-form.card {
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        .auth-glass-card .auth-field label {
          color: var(--navy-primary);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .auth-glass-card .input {
          min-height: 52px;
          border-color: rgba(45, 55, 72, 0.16);
          background: rgba(255, 255, 255, 0.84);
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
          margin-top: 18px;
          gap: 14px 22px;
          font-size: 14px;
        }

        .auth-legal-note {
          margin: 18px auto 0;
          max-width: 340px;
          color: rgba(42, 42, 42, 0.5);
          font-size: 11px;
          line-height: 1.45;
          text-align: center;
        }

        .auth-legal-note a,
        .auth-orphic-footer a {
          border-bottom: 1px solid rgba(45, 55, 72, 0.18);
        }

        .auth-orphic-footer {
          align-self: end;
          text-align: center;
        }

        .auth-orphic-footer p {
          margin: 0;
          color: rgba(42, 42, 42, 0.46);
          font-size: 11px;
          line-height: 1.4;
        }

        @media (max-width: 640px) {
          .auth-orphic-shell {
            padding: 16px 14px 18px;
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

          .auth-glass-card .auth-title {
            font-size: 30px;
          }

          .auth-card-subtitle {
            font-size: 15px;
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
