import type { ReactNode } from 'react';
import { AuthContinuingLegalNote, AuthLegalFooterLinks } from '@/components/legal/legal-consent-label';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTranslation } from '@/components/locale-provider';

type AuthShellProps = {
  title: string;
  children: ReactNode;
  hideContinuingLegalNote?: boolean;
};

const authIntroCopy = {
  en: {
    subtitle: 'Run your business from one place.',
    description: 'Customers, jobs, scheduling, teams, photos, payments, and financial tracking.'
  },
  es: {
    subtitle: 'Gestione su negocio desde un solo lugar.',
    description: 'Clientes, trabajos, horarios, equipos, fotos, pagos y seguimiento financiero.'
  },
  vi: {
    subtitle: 'Quản lý doanh nghiệp của bạn ở một nơi.',
    description: 'Khách hàng, công việc, lịch, đội nhóm, ảnh, thanh toán và theo dõi tài chính.'
  }
};

export function AuthShell({ title, children, hideContinuingLegalNote = false }: AuthShellProps) {
  const { locale } = useTranslation();
  const intro = authIntroCopy[locale] || authIntroCopy.en;

  return (
    <main id="main-content" className="auth-page auth-tech-page">
      <div className="auth-tech-background" aria-hidden="true" />
      <div className="auth-tech-overlay" aria-hidden="true" />

      <div className="auth-tech-shell">
        <header className="auth-tech-header">
          <BrandLogo href="/" size={44} showName={false} />
          <div className="auth-shell-language auth-tech-language">
            <LanguageSwitcher id="auth-language" variant="compact" />
          </div>
        </header>

        <section className="auth-tech-card" aria-labelledby="auth-page-title">
          <div className="auth-card-heading">
            <h1 id="auth-page-title" className="auth-title">{title}</h1>
            <p className="auth-card-subtitle">{intro.subtitle}</p>
            <p className="auth-card-description">{intro.description}</p>
          </div>
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
          overflow-x: hidden;
          isolation: isolate;
          background: #e9eef2;
          color: #172433;
          font-family: var(--font-manrope), Manrope, sans-serif;
        }

        .auth-tech-background {
          position: fixed;
          inset: 0;
          z-index: -3;
          background-image: url('/hero.jpg');
          background-size: cover;
          background-position: center;
          opacity: 0.62;
          filter: saturate(0.82) contrast(1.02) brightness(0.92);
          transform: scale(1.015);
        }

        .auth-tech-overlay {
          position: fixed;
          inset: 0;
          z-index: -2;
          background:
            linear-gradient(115deg, rgba(20, 39, 53, 0.46), rgba(28, 52, 68, 0.16) 42%, rgba(236, 242, 246, 0.2)),
            linear-gradient(180deg, rgba(17, 34, 47, 0.08), rgba(17, 34, 47, 0.3));
        }

        .auth-tech-shell {
          --auth-column-width: 450px;
          position: relative;
          z-index: 1;
          min-height: 100svh;
          display: grid;
          grid-template-rows: auto 1fr auto;
          align-items: center;
          padding: clamp(18px, 4vw, 42px);
        }

        .auth-tech-header,
        .auth-tech-card {
          width: min(var(--auth-column-width), calc(100vw - 56px)) !important;
          max-width: min(var(--auth-column-width), calc(100vw - 56px)) !important;
          box-sizing: border-box;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        .auth-tech-header {
          position: relative !important;
          inset: auto !important;
          display: grid !important;
          grid-template-columns: 1fr auto !important;
          align-items: center !important;
          gap: 16px;
          padding: 0 !important;
          min-height: 48px;
        }

        .auth-tech-header .brand-logo {
          position: static !important;
          inset: auto !important;
          transform: none !important;
          justify-self: start !important;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          margin: 0 !important;
        }

        .auth-tech-header .brand-logo,
        .auth-tech-header .brand-logo-name {
          color: #ffffff;
          text-shadow: 0 2px 18px rgba(10, 24, 34, 0.32);
        }

        .auth-shell-language.auth-tech-language {
          position: static !important;
          inset: auto !important;
          transform: none !important;
          justify-self: end !important;
          width: auto !important;
          max-width: 170px !important;
          margin: 0 !important;
          padding: 0 !important;
          z-index: auto !important;
        }

        .auth-shell-language.auth-tech-language > * {
          position: static !important;
          inset: auto !important;
          transform: none !important;
          margin: 0 !important;
        }

        .auth-tech-language select,
        .auth-tech-language button {
          width: auto !important;
          min-width: 126px !important;
          max-width: 170px !important;
          height: 44px !important;
          min-height: 44px !important;
          border: 1px solid rgba(255, 255, 255, 0.62);
          border-radius: 12px !important;
          background: rgba(255, 255, 255, 0.94);
          color: #1e3445;
          font-weight: 700;
          box-shadow: 0 12px 30px rgba(11, 29, 42, 0.17);
          backdrop-filter: blur(12px);
        }

        .auth-tech-card {
          margin-top: clamp(24px, 5vh, 54px) !important;
          margin-bottom: clamp(24px, 5vh, 54px) !important;
          padding: clamp(30px, 4.5vw, 42px);
          border: 1px solid rgba(255, 255, 255, 0.85);
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.975);
          box-shadow:
            0 34px 90px rgba(9, 24, 35, 0.29),
            0 2px 0 rgba(255, 255, 255, 0.9) inset;
          backdrop-filter: blur(18px);
        }

        .auth-card-heading {
          padding-bottom: 23px;
          margin-bottom: 22px;
          border-bottom: 1px solid #d5dee5;
        }

        .auth-tech-card .brand-logo,
        .auth-tech-card .auth-card-brandline {
          display: none;
        }

        .auth-tech-card .auth-title {
          margin: 0 0 10px;
          color: #132433;
          font-size: clamp(34px, 5vw, 43px);
          font-weight: 800;
          line-height: 1.04;
          letter-spacing: -0.05em;
        }

        .auth-card-subtitle {
          margin: 0 0 8px;
          color: #2f4658;
          font-size: 17px;
          font-weight: 700;
          line-height: 1.45;
        }

        .auth-card-description {
          margin: 0;
          color: #526778;
          font-size: 13.5px;
          font-weight: 500;
          line-height: 1.62;
        }

        .auth-tech-card > .auth-message {
          margin: 18px 0 20px;
        }

        .auth-tech-card > .auth-message + .auth-methods-note {
          margin-top: 0;
        }

        .auth-tech-card .auth-methods-note {
          margin: 0 0 17px;
          color: #40586a;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
        }

        .auth-tech-card .auth-plan-note {
          padding: 12px 14px;
          border: 1px solid #b9cbd6;
          border-radius: 12px;
          background: #eef5f8;
          color: #263f51;
          font-weight: 600;
        }

        .auth-tech-card .auth-form .auth-message {
          margin: 4px 0 0;
        }

        .auth-tech-card .auth-form .btn-primary {
          margin-top: 6px;
        }

        .auth-tech-card .auth-form.card {
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        .auth-tech-card .auth-field label,
        .auth-tech-card .password-field label {
          color: #1d3344;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.035em;
          text-transform: none;
        }

        .auth-tech-card .input {
          min-height: 54px;
          border: 1.5px solid #aebdca;
          border-radius: 12px;
          background: #ffffff;
          color: #152838;
          font-size: 16px;
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(18, 40, 56, 0.04) inset;
        }

        .auth-tech-card .input::placeholder {
          color: #6b7d8c;
          opacity: 1;
          font-weight: 500;
        }

        .auth-tech-card .input:hover {
          border-color: #879aaa;
        }

        .auth-tech-card .input:focus {
          border-color: #285d78;
          outline: none;
          box-shadow: 0 0 0 4px rgba(40, 93, 120, 0.14);
        }

        .auth-tech-card .btn {
          min-height: 54px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 800;
        }

        .auth-tech-card .btn-primary {
          background: #285d78;
          border-color: #285d78;
          color: #ffffff;
          box-shadow: 0 14px 30px rgba(40, 93, 120, 0.25);
        }

        .auth-tech-card .btn-primary:hover {
          background: #1f485e;
          border-color: #1f485e;
          transform: translateY(-1px);
          box-shadow: 0 17px 34px rgba(31, 72, 94, 0.29);
        }

        .auth-tech-card .btn-primary:focus-visible {
          outline: 3px solid rgba(40, 93, 120, 0.28);
          outline-offset: 3px;
        }

        .auth-tech-card .btn:disabled {
          background: #9aabb7;
          border-color: #9aabb7;
          color: #ffffff;
          opacity: 1;
          box-shadow: none;
        }

        .auth-tech-card .auth-links {
          justify-content: center;
          margin-top: 20px;
          gap: 14px 24px;
          font-size: 14px;
        }

        .auth-tech-card .auth-links a,
        .auth-tech-card a {
          color: #245b77;
          font-weight: 750;
          text-decoration-thickness: 1.5px;
          text-underline-offset: 3px;
        }

        .auth-tech-card .auth-links a:hover,
        .auth-tech-card a:hover {
          color: #163f56;
        }

        .auth-tech-card .auth-password-toggle {
          color: #245b77;
          font-weight: 800;
        }

        .auth-legal-note {
          margin: 22px auto 0;
          max-width: 370px;
          color: #617484;
          font-size: 11.5px;
          font-weight: 500;
          line-height: 1.55;
          text-align: center;
        }

        .auth-legal-note .legal-inline-link {
          color: #315f78;
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .auth-legal-note .legal-inline-link:hover,
        .auth-legal-note .legal-inline-link:focus-visible {
          color: #173f55;
        }

        .auth-tech-footer {
          align-self: end;
          text-align: center;
          padding-top: 8px;
        }

        .auth-tech-footer .auth-legal-footer,
        .auth-tech-footer .auth-legal-footer a {
          color: rgba(255, 255, 255, 0.94);
          font-weight: 700;
          text-shadow: 0 2px 14px rgba(8, 23, 33, 0.5);
        }

        @media (max-width: 640px) {
          .auth-tech-page {
            overflow-y: auto;
          }

          .auth-tech-background {
            background-position: 56% center;
          }

          .auth-tech-overlay {
            background: linear-gradient(180deg, rgba(18, 37, 50, 0.34), rgba(18, 37, 50, 0.48));
          }

          .auth-tech-shell {
            padding: 16px 14px 20px;
          }

          .auth-tech-header,
          .auth-tech-card {
            width: calc(100vw - 32px) !important;
            max-width: calc(100vw - 32px) !important;
          }

          .auth-tech-header {
            gap: 12px;
          }

          .auth-tech-language select,
          .auth-tech-language button {
            min-width: 112px !important;
            max-width: 142px !important;
          }

          .auth-tech-card {
            margin-top: 20px !important;
            margin-bottom: 20px !important;
            padding: 25px 22px;
            border-radius: 22px;
          }

          .auth-card-heading {
            padding-bottom: 19px;
            margin-bottom: 19px;
          }

          .auth-tech-card .auth-title {
            font-size: 33px;
          }

          .auth-card-subtitle {
            font-size: 16px;
          }

          .auth-card-description {
            font-size: 13px;
          }

          .auth-tech-card > .auth-message {
            margin: 16px 0 18px;
          }

          .auth-password-row {
            display: grid;
            grid-template-columns: 1fr;
          }

          .auth-password-toggle {
            width: 100%;
          }
        }

        @media (min-width: 641px) and (max-width: 1024px) {
          .auth-tech-shell {
            --auth-column-width: 500px;
            padding-left: 28px;
            padding-right: 28px;
          }

          .auth-tech-background {
            background-position: center;
          }
        }
      `}</style>
    </main>
  );
}
