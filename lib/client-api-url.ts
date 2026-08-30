import { appUrl, PRODUCTION_APP_ORIGIN } from '@/lib/app-url';

function isNativeLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'capacitor:' ||
      url.protocol === 'ionic:' ||
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

/** Resolve an app API path to the real EverittOS server, including inside native Capacitor shells. */
export function resolveClientApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, '');

    // Native app shells may report capacitor://localhost or localhost even though
    // authentication must be handled by the production EverittOS server.
    if (isNativeLocalOrigin(origin)) {
      return `${PRODUCTION_APP_ORIGIN}${normalized}`;
    }

    return `${origin}${normalized}`;
  }

  return appUrl(normalized);
}
