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
import { RoleHomeGuard } from '@/components/role-home-guard';
import { AppConnectivityBanner } from '@/components/app-connectivity-banner';
import { NetworkStatusBanner } from '@/components/network-status-banner';
import { NativeAppProvider } from '@/components/native-app-provider';
import { NativePinLock } from '@/components/native-pin-lock';
import { MobileDocumentFlags } from '@/components/mobile-document-flags';
import { PwaRegistration } from '@/components/pwa-registration';
import { PwaUpdatePrompt } from '@/components/pwa-update-prompt';
import { SuppressVercelToolbar } from '@/components/suppress-vercel-toolbar';
import { SupabaseRuntimeConfig } from '@/components/supabase-runtime-config';
import { ContractorStaticSections } from '@/components/portal/contractor-static-sections';
import { JobFinanceWordingAndCustomerRate } from '@/components/job-finance-wording-and-customer-rate';
import { CreateFormCancelControls } from '@/components/create-form-cancel-controls';
import { ContractorJobPayVisibility } from '@/components/contractor-job-pay-visibility';
import { ExpensesListEnhancer } from '@/components/expenses-list-enhancer';
import { AskEverittQuickClear } from '@/components/ask-everitt-quick-clear';
import { vercelDeploymentEnv } from '@/lib/deployment-env';
import { LOCALE_COOKIE_NAME, normalizeLocale } from '@/lib/i18n/config';

/* Base product styles only. */
import './everitt-theme.css';
import './typography.css';
import './nav.css';
import './outbound.css';
import './feedback-toast.css';
import './dashboard.css';
import './form-alignment-fixes.css';
import './job-visit-layout-override.css';
import './payment-receipt-modal-fix.css';
import './receipt.css';
import './mobile-safe-areas.css';
import './contractor-portal.css';
import './quote-workspace.css';
import './role-home-structure.css';

/* Canonical signed-in visual system. Keep this order stable. */
import './signed-in-canvas.css';
import './hero-last.css';
import './app-wide-editorial-final.css';
import './jobs-filter-mobile-alignment.css';
import './jobs-mobile-layout-hotfix.css';
import './mobile-readability-and-footer-final.css';
import './login-match-visual.css';
import './word-spacing-fix.css';
import './top-chrome-align.css';
import './ask-everitt-overlay-fix.css';
import './job-card-spacing.css';
import './one-nav.css';
import './box-stack-spacing.css';
import './signed-in-stability.css';

const manrope = Manrope({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700', '800'], variable: '--font-manrope', display: 'swap' });
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#243F53' };
export const metadata: Metadata = { title: 'EverittOS | Run Your Service Business', description: 'Manage requests, customers, jobs, schedules, photos, and payments in one simple workspace.', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'EverittOS', statusBarStyle: 'default' }, other: { 'mobile-web-app-capable': 'yes' }, icons: { icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/icon.png', type: 'image/png', sizes: '512x512' }], apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }], shortcut: '/favicon.ico' } };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const deployment = vercelDeploymentEnv();
  const cookieStore = await cookies();
  const initialLocale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  return <html lang={initialLocale} data-locale={initialLocale} data-deployment={deployment} className={manrope.variable}><body className={manrope.className} data-locale={initialLocale}><SupabaseRuntimeConfig /><PwaRegistration /><MobileDocumentFlags /><NativeAppProvider /><NativePinLock /><AppConnectivityBanner /><NetworkStatusBanner /><PwaUpdatePrompt /><SuppressVercelToolbar /><LocaleProvider initialLocale={initialLocale}><JobFinanceWordingAndCustomerRate /><CreateFormCancelControls /><ContractorJobPayVisibility /><ExpensesListEnhancer /><AskEverittQuickClear /><ToastProvider><LocaleSync /><SessionGuard><ActivityHeartbeat /><WorkspacePlanProvider><WorkspaceBootstrap /><RoleHomeGuard /><SkipToMain /><SiteChrome /><ContractorStaticSections />{children}<AnalyticsGate /><CookieConsentBanner /></WorkspacePlanProvider></SessionGuard></ToastProvider></LocaleProvider></body></html>;
}
