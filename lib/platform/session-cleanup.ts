import { isNativePlatform } from '@/lib/platform/detect';

const PRIVATE_CACHE_PREFIXES = ['/api/', '/auth/', '/settings/billing'];

/** Keys that may hold organization-scoped client state. */
const CLIENT_STATE_KEYS = [
  'everittos_tab_session',
  'everittos_selected_org',
  'everittos_selected_location',
  'everittos_pending_uploads',
  'everittos_offline_draft'
] as const;

export async function clearApplicationControlledCache(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;

  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.includes('everittos') && !key.includes('static'))
        .map((key) => caches.delete(key))
    );
  } catch {
    // Cache API may be unavailable in some contexts.
  }
}

export function clearClientSessionState(): void {
  if (typeof window === 'undefined') return;

  for (const key of CLIENT_STATE_KEYS) {
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch {
      // Storage may be blocked in private mode.
    }
  }
}

export function clearSensitiveQueryFromHistory(): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const sensitive = ['token', 'code', 'access_token', 'refresh_token', 'session_id'];
  let changed = false;

  for (const param of sensitive) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  }

  if (changed) {
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

export async function performPlatformLogoutCleanup(): Promise<void> {
  clearClientSessionState();
  clearSensitiveQueryFromHistory();
  await clearApplicationControlledCache();

  if (isNativePlatform() && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      // Keep the service worker installed; only skip caching private responses on next fetch.
      void registrations;
    } catch {
      // Ignore SW cleanup errors.
    }
  }
}

export function shouldBypassServiceWorkerCache(url: string): boolean {
  if (!url) return true;
  return PRIVATE_CACHE_PREFIXES.some((prefix) => url.includes(prefix));
}
