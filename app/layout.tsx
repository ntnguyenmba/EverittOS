import './globals.css';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Manrope } from 'next/font/google';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { ToastProvider } from '@/components/feedback/toast-provider';
import { LocaleProvider } from '@/components/locale-provider';
import { LocaleSync } from '@/components/locale-sync';
import { SiteChrome, SkipToMain } from '@/components/site-chrome';
import { AnalyticsGate } from '@/components/analytics-gate';
import { ActivityHeartbeat } from '@/components/activity-heartbeat';
import { SessionGuard } from '@/components/session-guard';
import { WorkspaceBootstrap } from '@/components/workspace-bootstrap';
import { WorkspacePlanProvider } from '@/components/workspace-plan-provider';
import { AppConnectivityBanner } from '@/components/app-connectivity-banner';
import { NetworkStatusBanner } from '@/components/network-status-banner';
import { NativeAppProvider } from '@/components/native-app-provider';
import { MobileDocumentFlags } from '@/components/mobile-document-flags';
import { PwaRegistration } from '@/components/pwa-registration';
import { PwaUpdatePrompt } from '@/components/pwa-update-prompt';
import { SuppressVercelToolbar } from '@/components/suppress-vercel-toolbar';
import { SupabaseRuntimeConfig } from '@/components/supabase-runtime-config';
import { ContractorStaticSections } from '@/components/portal/contractor-static-sections';
import { vercelDeploymentEnv } from '@/lib/deployment-env';
import { LOCALE_COOKIE_NAME, normalizeLocale } from '@/lib/i18n/config';
import './everitt-theme.css';
import './everitt-app-polish.css';
import './everitt-editorial-fixes.css';
import './typography.css';
import './nav.css';
import './outbound.css';
import './feedback-toast.css';
import './everitt-luxury-refresh.css';
import './app-readability-pass.css';
import './customer-ready-polish.css';
import './dashboard.css';
import './job-mobile-fixes.css';
import './payment-receipt-modal-fix.css';
import './job-visit-layout-override.css';
import './form-alignment-fixes.css';
import './jobs-visual-polish.css';
import './mobile-safe-areas.css';
import './receipt.css';
import './mobile-usability-fixes.css';
import './everitt-modern-refresh.css';
import './text-contrast.css';
import './contractor-portal.css';
import './native-tablet-release-polish.css';
import './everitt-visual-system.css';
import './final-layout-guard.css';
import './jobs-visual-final.css';
import './jobs-actions-spacing-fix.css';
import './unified-record-cards.css';
import './team-customer-consistency.css';
import './button-consistency.css';
import './final-app-polish.css';
import './final-overlay-polish.css';
import './final-compact-controls-polish.css';
import './final-language-layout-polish.css';
import './sidebar-plan-card-polish.css';
import './navigation-visibility-guard.css';
import './minimal-release-polish.css';
import './role-dashboard-v1.css';
import './jobs-owner-minimal.css';

const manrope = Manrope({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap'
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#243F53'
};

export const metadata: Metadata = {
  title: 'EverittOS | Run Your Service Business',
  description: 'Manage requests, customers, jobs, schedules, photos, and payments in one simple workspace.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'EverittOS',
    statusBarStyle: 'default'
  },
  other: {
    'mobile-web-app-capable': 'yes'
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' }
    ],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
    shortcut: '/favicon.ico'
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const deployment = vercelDeploymentEnv();
  const cookieStore = await cookies();
  const initialLocale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);

  return (
    <html
      lang={initialLocale}
      data-locale={initialLocale}
      data-deployment={deployment}
      className={manrope.variable}
    >
      <body className={manrope.className} data-locale={initialLocale}>
        <SupabaseRuntimeConfig />
        <PwaRegistration />
        <MobileDocumentFlags />
        <NativeAppProvider />
        <AppConnectivityBanner />
        <NetworkStatusBanner />
        <PwaUpdatePrompt />
        <SuppressVercelToolbar />
        <LocaleProvider initialLocale={initialLocale}>
          <ToastProvider>
            <LocaleSync />
            <SessionGuard>
              <ActivityHeartbeat />
              <WorkspacePlanProvider>
                <WorkspaceBootstrap />
                <SkipToMain />
                <SiteChrome />
                <ContractorStaticSections />
                {children}
                <AnalyticsGate />
                <CookieConsentBanner />
              </WorkspacePlanProvider>
            </SessionGuard>
          </ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
