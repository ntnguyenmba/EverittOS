'use client';

import { useEffect } from 'react';
import { isNativePlatform } from '@/lib/platform/detect';
import { clearNativeStepUp, requireNativeStepUp } from '@/lib/native-step-up';
import { clearTabSessionId } from '@/lib/session-client';

const SENSITIVE_PREFIXES = [
  '/api/team/invite',
  '/api/team/invitations/',
  '/api/team/members',
  '/api/team/transfer-ownership',
  '/api/exports/',
  '/api/account/export',
  '/api/account/delete',
  '/api/account/disable',
  '/api/account/request-deletion',
  '/api/integrations/quickbooks/connect',
  '/api/integrations/quickbooks/disconnect',
  '/api/integrations/quickbooks/export-invoice',
  '/api/invoices/'
] as const;

const SENSITIVE_EXACT = new Set([
  '/api/stripe/checkout',
  '/api/stripe/portal',
  '/api/stripe/cancel-subscription',
  '/api/stripe/resume-subscription'
]);

function requestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (input instanceof Request) return new URL(input.url, window.location.origin);
    if (input instanceof URL) return input;
    return new URL(String(input), window.location.origin);
  } catch {
    return null;
  }
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return String(init.method).toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function sensitiveReason(pathname: string, method: string): string | null {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    if (pathname.startsWith('/api/exports/') || pathname === '/api/account/export') {
      return 'Confirm to export EverittOS data';
    }
    return null;
  }

  if (pathname.startsWith('/api/team/')) return 'Confirm to change team access';
  if (pathname.startsWith('/api/invoices/') && pathname.includes('/payment')) return 'Confirm this payment action';
  if (pathname.startsWith('/api/integrations/quickbooks/')) return 'Confirm this financial connection action';
  if (pathname.startsWith('/api/account/')) return 'Confirm this sensitive account action';
  if (SENSITIVE_EXACT.has(pathname)) return 'Confirm this billing action';
  if (SENSITIVE_PREFIXES.some(prefix => pathname.startsWith(prefix))) return 'Confirm this sensitive EverittOS action';
  return null;
}

async function isExpiredSession(response: Response): Promise<boolean> {
  if (response.status !== 401 && response.status !== 403) return false;
  try {
    const payload = await response.clone().json() as { code?: string; error?: string };
    const code = String(payload.code || '').toLowerCase();
    const error = String(payload.error || '').toLowerCase();
    return code === 'session_expired' || code === 'session_revoked' || error.includes('session expired') || error.includes('session revoked');
  } catch {
    return false;
  }
}

function redirectExpiredSession() {
  clearNativeStepUp();
  clearTabSessionId();
  try { window.localStorage.removeItem('everittos_last_activity_client'); } catch {}
  const params = new URLSearchParams({ reason: 'session', detail: 'Your session ended or was revoked. Sign in again to continue.' });
  window.location.assign(`/login?${params.toString()}`);
}

export function NativeSensitiveActionGuard() {
  useEffect(() => {
    if (!isNativePlatform()) return;
    const originalFetch = window.fetch.bind(window);
    let redirecting = false;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);
      if (url && url.origin === window.location.origin) {
        const reason = sensitiveReason(url.pathname, method);
        if (reason) {
          const allowed = await requireNativeStepUp(reason);
          if (!allowed) throw new Error('Authentication required. Unlock EverittOS and try again.');
        }
      }

      const response = await originalFetch(input, init);
      if (!redirecting && url && url.origin === window.location.origin && await isExpiredSession(response)) {
        redirecting = true;
        redirectExpiredSession();
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
