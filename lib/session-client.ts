import { SESSION_TAB_STORAGE_KEY } from '@/lib/session-policy';

export function storeTabSessionId(tabSessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_TAB_STORAGE_KEY, tabSessionId);
  } catch {
    /* sessionStorage may be unavailable in private mode */
  }
}

export function readTabSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(SESSION_TAB_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearTabSessionId(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_TAB_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
