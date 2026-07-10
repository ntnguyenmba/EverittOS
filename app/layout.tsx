import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { ToastProvider } from '@/components/feedback/toast-provider';
import { LocaleProvider } from '@/components/locale-provider';
import { LocaleSync } from '@/components/locale-sync';
import { SiteChrome, SkipToMain } from '@/components/site-chrome';
import { AnalyticsGate } from '@/components/analytics-gate';
import { SessionGuard } from '@/components/session-guard';
import { WorkspaceBootstrap } from '@/components/workspace-bootstrap';
import { WorkspacePlanProvider } from '@/components/workspace-plan-provider';
import { AppConnectivityBanner } from '@/components/app-connectivity-banner';
import { SuppressVercelToolbar } from '@/components/suppress-vercel-toolbar';
import { SupabaseRuntimeConfig } from '@/components/supabase-runtime-config';
import { vercelDeploymentEnv } from '@/lib/deployment-env';
import './everitt-theme.css';
import './everitt-app-polish.css';
import './everitt-editorial-fixes.css';
import './typography.css';
import './nav.css';
import './outbound.css';
import './feedback-toast.css';
import './everitt-luxury-refresh.css';
import './dashboard-repair.css';
import './dashboard-visual-balance.css';
import './dashboard-final-polish.css';
import './app-readability-pass.css';
import './customer-ready-polish.css';
import './dashboard-mobile-balance.css';
import './job-mobile-fixes.css';
import './job-visit-layout-override.css';
import './form-alignment-fixes.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#24302B'
};

export const metadata: Metadata = {
  title: 'EverittOS | Business Command Center',
  description: 'Run customers, jobs, leads, schedules, billing, and daily business operations from one workspace.',
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const deployment = vercelDeploymentEnv();

  return (
    <html lang="en" data-deployment={deployment} className={inter.variable}>
      <body>
        <SupabaseRuntimeConfig />
        <AppConnectivityBanner />
        <SuppressVercelToolbar />
        <LocaleProvider>
          <ToastProvider>
            <LocaleSync />
            <SessionGuard>
              <WorkspacePlanProvider>
                <WorkspaceBootstrap />
                <SkipToMain />
                <SiteChrome />
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
