import './globals.css';
import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { SiteChrome, SkipToMain } from '@/components/site-chrome';
import { AnalyticsGate } from '@/components/analytics-gate';
import { SessionGuard } from '@/components/session-guard';
import { WorkspaceBootstrap } from '@/components/workspace-bootstrap';
import { LocaleBootstrap } from '@/components/locale-bootstrap';
import { SuppressVercelToolbar } from '@/components/suppress-vercel-toolbar';
import { SupabaseRuntimeConfig } from '@/components/supabase-runtime-config';
import { vercelDeploymentEnv } from '@/lib/deployment-env';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'EverittOS | Field Operations Platform',
  description: 'Manage jobs, workers, and schedules from one dashboard.',
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
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} data-deployment={deployment} className={`${inter.variable} ${cormorant.variable}`}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SupabaseRuntimeConfig />
          <SuppressVercelToolbar />
          <SessionGuard />
          <LocaleBootstrap />
          <WorkspaceBootstrap />
          <SkipToMain />
          <SiteChrome />
          <AnalyticsGate />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
