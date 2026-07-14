import { MOBILE_TRUSTED_HOSTS } from '@/lib/platform/config';

const EXTERNAL_PROTOCOLS = ['mailto:', 'tel:', 'sms:', 'geo:'] as const;

export function isExternalProtocol(href: string): boolean {
  const lower = href.trim().toLowerCase();
  return EXTERNAL_PROTOCOLS.some((protocol) => lower.startsWith(protocol));
}

export function isTrustedEverittHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return MOBILE_TRUSTED_HOSTS.some(
    (host) => normalized === host || normalized.endsWith(`.${host}`)
  );
}

/** Internal EverittOS routes stay in-app; external origins open in the system browser. */
export function classifyNavigationTarget(href: string, origin = ''): 'internal' | 'external' | 'protocol' {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#')) return 'internal';
  if (isExternalProtocol(trimmed)) return 'protocol';

  if (trimmed.startsWith('/')) return 'internal';

  try {
    const parsed = new URL(trimmed, origin || 'https://app.everittventures.com');
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'external';
    if (isTrustedEverittHost(parsed.hostname)) return 'internal';
    return 'external';
  } catch {
    return 'external';
  }
}

export function isStripeCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'checkout.stripe.com';
  } catch {
    return false;
  }
}

export function isStripeBillingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'billing.stripe.com' || parsed.hostname === 'checkout.stripe.com')
    );
  } catch {
    return false;
  }
}
