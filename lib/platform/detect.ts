import { Capacitor } from '@capacitor/core';

export type AppPlatform = 'web' | 'ios' | 'android';

/** True when running inside a Capacitor native shell. */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function getAppPlatform(): AppPlatform {
  if (!isNativePlatform()) return 'web';
  const platform = Capacitor.getPlatform();
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android';
  return 'web';
}

/** True for installed PWA or standalone display mode in a mobile browser. */
export function isInstalledPwa(): boolean {
  if (typeof window === 'undefined') return false;

  const matchMediaStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return matchMediaStandalone || iosStandalone;
}

export function isMobileWebUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function platformLabel(): string {
  const platform = getAppPlatform();
  if (platform === 'ios') return 'ios';
  if (platform === 'android') return 'android';
  if (isInstalledPwa()) return 'pwa';
  return 'web';
}
