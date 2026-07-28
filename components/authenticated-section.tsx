'use client';

import { AppNavigationTracker } from '@/components/app-navigation-tracker';
import { AppPageTop } from '@/components/app-page-top';

type AuthenticatedSectionProps = {
  role?: string | null;
  children: React.ReactNode;
  className?: string;
};

/** Shared authenticated portal surface with a restrained Everitt property backdrop. */
export function AuthenticatedSection({ role, children, className }: AuthenticatedSectionProps) {
  return (
    <main className={className ? `section authenticated-portal ${className}` : 'section authenticated-portal'}>
      <div className="authenticated-portal-background" aria-hidden="true" />
      <div className="authenticated-portal-overlay" aria-hidden="true" />
      <AppNavigationTracker />
      <div className="container authenticated-portal-container">
        <AppPageTop role={role} />
        {children}
      </div>

      <style jsx>{`
        .authenticated-portal {
          position: relative;
          isolation: isolate;
          min-height: 100svh;
          padding: clamp(18px, 3vw, 38px) 0;
          overflow-x: hidden;
          background: #e8eef2;
        }

        .authenticated-portal-background {
          position: fixed;
          inset: 0;
          z-index: -3;
          pointer-events: none;
          background-image: url('https://raw.githubusercontent.com/ntnguyenmba/everitt-website/main/assets/images/after.jpg');
          background-size: cover;
          background-position: center;
          opacity: 0.22;
          filter: saturate(0.55) contrast(0.92) brightness(0.92);
          transform: scale(1.015);
        }

        .authenticated-portal-overlay {
          position: fixed;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(239, 244, 247, 0.82), rgba(232, 239, 244, 0.9)),
            rgba(233, 239, 243, 0.78);
        }

        .authenticated-portal-container {
          position: relative;
          z-index: 1;
          width: min(1200px, calc(100% - 48px));
          padding: clamp(18px, 3vw, 34px);
          border: 1px solid rgba(255, 255, 255, 0.88);
          border-radius: 24px;
          background: rgba(247, 250, 252, 0.92);
          box-shadow: 0 24px 70px rgba(28, 48, 63, 0.14);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .authenticated-portal-container :global(.card),
        .authenticated-portal-container :global(.panel),
        .authenticated-portal-container :global(.stat) {
          background: rgba(255, 255, 255, 0.985);
          border-color: rgba(37, 54, 74, 0.13);
          box-shadow: 0 1px 3px rgba(37, 54, 74, 0.08), 0 8px 24px rgba(37, 54, 74, 0.045);
        }

        .authenticated-portal-container :global(h1),
        .authenticated-portal-container :global(h2),
        .authenticated-portal-container :global(h3),
        .authenticated-portal-container :global(h4),
        .authenticated-portal-container :global(strong),
        .authenticated-portal-container :global(label) {
          text-shadow: none;
        }

        @media (max-width: 720px) {
          .authenticated-portal {
            padding: 10px 0 20px;
          }

          .authenticated-portal-background {
            background-position: 58% center;
            opacity: 0.16;
          }

          .authenticated-portal-overlay {
            background: rgba(235, 241, 245, 0.9);
          }

          .authenticated-portal-container {
            width: min(100% - 20px, 1200px);
            padding: 14px;
            border-radius: 18px;
            background: rgba(248, 250, 252, 0.96);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
          }
        }

        @media (prefers-reduced-transparency: reduce) {
          .authenticated-portal-container {
            background: #f7fafc;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
          }
        }
      `}</style>
    </main>
  );
}
