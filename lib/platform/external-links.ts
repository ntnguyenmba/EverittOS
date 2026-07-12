import { Browser } from '@capacitor/browser';
import { isNativePlatform } from '@/lib/platform/detect';
import { classifyNavigationTarget, isStripeBillingUrl } from '@/lib/platform/navigation';

export async function openExternalUrl(url: string): Promise<void> {
  if (typeof window === 'undefined') return;

  if (isNativePlatform()) {
    await Browser.open({ url, presentationStyle: 'popover' });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Intercept anchor clicks and window navigation for external targets. */
export async function handleNavigationClick(
  href: string,
  origin: string,
  navigateInternal: (path: string) => void
): Promise<'handled' | 'default'> {
  const target = classifyNavigationTarget(href, origin);

  if (target === 'internal') {
    if (href.startsWith('/')) {
      navigateInternal(href);
      return 'handled';
    }
    return 'default';
  }

  if (target === 'protocol' || target === 'external') {
    if (isNativePlatform() || isStripeBillingUrl(href)) {
      await openExternalUrl(href);
      return 'handled';
    }
  }

  return 'default';
}
