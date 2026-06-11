export const COOKIE_CONSENT_KEY = 'everittos_cookie_consent';
export const COOKIE_CONSENT_VERSION = '1';

export type CookieCategory = 'necessary' | 'analytics' | 'marketing';

export type CookieConsent = {
  version: string;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export function defaultConsent(): CookieConsent {
  return {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    analytics: false,
    marketing: false,
    updatedAt: new Date().toISOString()
  };
}

export function readCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    return { ...parsed, necessary: true };
  } catch {
    return null;
  }
}

export function writeCookieConsent(consent: CookieConsent): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ ...consent, necessary: true }));
}

export function analyticsAllowed(): boolean {
  return readCookieConsent()?.analytics === true;
}

export function marketingAllowed(): boolean {
  return readCookieConsent()?.marketing === true;
}

export function hasCookieConsentChoice(): boolean {
  return readCookieConsent() !== null;
}
