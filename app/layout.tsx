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
import { WorkspaceBootstrap } from '@/components