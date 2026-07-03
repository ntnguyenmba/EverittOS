import type { ReactNode } from 'react';
import { AuthContinuingLegalNote, AuthLegalFooterLinks } from '@/components/legal/legal-consent-label';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';

type AuthShellProps = {
  title: string;
  children: ReactNode;
  /** Signup uses an explicit consent checkbox; skip the duplicate continuing note. */
  hideContinuingLegalNote?: boolean;
};

/** Centered auth layout aligned with the Everitt Ventures tech site. */
export function AuthShell({ title, children, hideContinuingLegalNote = false }: AuthShellProps) {
  return (
    <main id="main-content" className="auth-page auth-tech-page">
      <div className="auth-tech-background" aria-hidden="true" />
      <div className="auth-tech-overlay" aria-hidden="true" />

      <div className="auth-tech-shell">
        <header className="auth-tech-header">
          <BrandLogo href="/" size={44} showName />
          <div className="auth-shell-language auth-tech-language">
            <LanguageSwitcher id="auth-language" variant="compact" />
          </div>
        </header>

        <section className="auth-tech-card" aria-labelledby="auth-page-title">
          <h1 id="auth-page-title" className="auth-title">
            {title}
          </h1>
          <p className="auth-card-subtitle">Run your business from one place.</p>
          <p className="auth-card-description">
            Manage customers, jobs, scheduling, teams, photos, reports, and more from one secure workspace.
          </p>
          {children}
          {hideContinuingLegalNote ? null : <AuthContinuingLegalNote />}
        </section>

        <footer className="auth-tech-footer">
          <AuthLegalFooterLinks />
        </footer>
      </div>

      <style>{`
        .auth-tech-page {
          position: relative;
          min-height: 100svh;
          overflow: hidden;
          isolation: isolate;
          background: #f8fafc;
          color: var(--text);
        }

        .auth-tech-background {
          position: fixed;
          inset: 0;
          z-index: -3;
          background-image: url('/hero.jpg');
          background-size: cover;
          background-position: center;
          opacity: 0.34;
          filter: grayscale(0.08) saturate(0.72) contrast(0.96) brightness(1.04);
          transform: scale(1.01);
        }

        .auth-tech-overlay {
          position: fixed;
          inset: 0;
          z-index: -2;
          background:
            linear-gradient(135deg, rgba(248, 250, 252, 0.58), rgba(255, 255, 255, 0.5) 45%, rgba(239, 246, 255, 0.58)),
            radial-gradient(circle at 18% 16%, rgba(45, 96, 142, 0.14), transparent 26%),
            radial-gradient(circle at 82% 78%, rgba(45, 55, 72, 0.08), transparent 34%);
        }

        .auth-tech-shell {
          position: relative;
          z-index: 1;
          min-height: 100svh;
          display: grid;
          grid-template-rows: auto 1fr auto;
          align-items: center;
          padding: clamp(18px, 4vw, 42px);
        }

        .auth-tech-header {
          width: min(1120px, 100%);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .auth-tech-language select,
        .auth-tech-language button {
          background: rgba(255, 255, 255, 0.92);
          border-color: rgba(45, 55, 72, 0.13);
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
        }

        .auth-tech-card {
          width: min(420px, 100%);
          margin: clamp(26px, 7vh, 72px) auto;
          padding: clamp(28px, 4vw, 38px);
          border: 1px solid rgba(45, 55, 72, 0.1);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.11), 0 1px 0 rgba(255, 255, 255, 0.9) inset;
        }

        .auth-tech-card .brand-logo,
        .auth-tech-card .auth-card-brandline {
          display: none;
        }

        .auth-tech-card .auth-title {
          margin-bottom: 8px;
          color: #1f2f43;
          font-size: clamp(31px, 5vw, 40px);
          line-height: 1.1;
          letter-spacing: -0.04em;
        }

        .auth-card-subtitle {
          margin: 0 0 8px;
          color: #54677d;
          font-size: 16px;
          line-height: 1.55;
        }

        .auth-card-description {
          margin: 0 0 22px;
          color: rgba(31, 47, 67, 0.66);
          font-size: 13px;
          line-height: 1.6;
        }

        .auth-tech-card .auth-methods-note {
          margin: -4px 0 16px;
          color: #54677d;
          font-size: 14px;
        }

        .auth-tech-card .auth-form .btn-primary {
          margin-top: 4px;
        }

        .auth-tech-card .auth-form.card {
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        .auth-tech-card .auth-field label {
          color: #22344a;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .auth-tech-card .input {
          min-height: 52px;
          border-color: rgba(45, 55, 72, 0.14);
          background: #ffffff;
          color: #1f2f43;
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.92) inset;
        }

        .auth-tech-card .input:focus {
          border-color: rgba(45, 96, 142, 0.42);
          box-shadow: 0 0 0 4px rgba(45, 96, 142, 0.08);
        }

        .auth-tech-card .btn {
          min-height: 52px;
          border-radius: 999px;
        }

        .auth-tech-card .btn-primary {
          background: #2d608e;
          border-color: #2d608e;
          color: #ffffff;
          box-shadow: 0 16px 36px rgba(45, 96, 142, 0.2);
        }

        .auth-tech-card .btn-primary:hover {
          background: #244f76;
          border-color: #244f76;
        }

        .auth-tech-card .auth-links {
          justify-content: center;
          margin-top: 18px;
          gap: 14px 22px;
          color: #2d608e;
          font-size: 14px;
        }

        .auth-legal-note {
          margin: 20px auto 0;
          max-width: 360px;
          color: rgba(31, 47, 67, 0.52);
          font-size: 11px;
          line-height: 1.5;
          text-align: center;
        }

        .auth-legal-note .legal-inline-link {
          color: rgba(36, 79, 118, 0.88);
          font-weight: 600;
          text-decoration: none;
        }

        .auth-legal-note .legal-inline-link:hover,
        .auth-legal-note .legal-inline-link:focus-visible {
          color: #2d608e;
          text-decoration: underline;
        }

        .auth-tech-footer {
          align-self: end;
          text-align: center;
          padding-top: 8px;
        }

        .auth-tech-footer .auth-legal-footer {
          color: rgba(31, 47, 67, 0.46);
        }

        @media (max-width: 640px) {
          .auth-tech-shell {
            padding: 16px 14px 18px;
          }

          .auth-tech-header {
            gap: 12px;
          }

          .auth-tech-header .brand-logo-name {
            font-size: 20px;
          }

          .auth-tech-card {
            margin: 22px auto;
            padding: 22px;
            border-radius: 22px;
          }

          .auth-tech-card .auth-title {
            font-size: 30px;
          }

          .auth-card-subtitle {
            font-size: 15px;
          }

          .auth-card-description {
            font-size: 12.5px;
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
