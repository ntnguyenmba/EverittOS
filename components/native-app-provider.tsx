'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { dispatchAndroidBackPress, registerAndroidBackHandler } from '@/lib/platform/android-back';
import { deepLinkToAppPath } from '@/lib/platform/deep-links';
import { handleNavigationClick } from '@/lib/platform';
import { pingActivityHeartbeat } from '@/lib/activity-heartbeat';
import { isNativePlatform } from '@/lib/platform/detect';
import { supabase } from '@/lib/supabase';

async function refreshSessionAfterResume(): Promise<void> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      window.location.href = '/login?reason=session_expired';
      return;
    }

    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      window.location.href = '/login?reason=session_expired';
      return;
    }

    window.dispatchEvent(new Event('everittos:workspace-plan-refresh'));
    void pingActivityHeartbeat({ force: true });
  } catch {
    // Network may still be unavailable immediately after resume.
  }
}

/** Wires Capacitor lifecycle, deep links, Android back, and trusted navigation in native shells. */
export function NativeAppProvider() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativePlatform()) return;

    let disposed = false;
    const listeners: Array<{ remove: () => Promise<void> | void }> = [];

    async function initNativeShell() {
      try {
        await SplashScreen.hide();
      } catch {
        // Splash may already be hidden.
      }

      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#24302B' });
      } catch {
        // Status bar plugin is not available on all platforms.
      }

      try {
        await Keyboard.setAccessoryBarVisible({ isVisible: true });
      } catch {
        // Keyboard plugin is optional.
      }

      const appState = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          void refreshSessionAfterResume();
        }
      });
      listeners.push(appState);

      const urlOpen = await CapacitorApp.addListener('appUrlOpen', (event) => {
        const path = deepLinkToAppPath(event.url);
        if (path) {
          router.push(path);
        }
      });
      listeners.push(urlOpen);

      const backButton = await CapacitorApp.addListener('backButton', () => {
        if (dispatchAndroidBackPress()) return;
        if (window.history.length > 1) {
          router.back();
          return;
        }
        void CapacitorApp.exitApp();
      });
      listeners.push(backButton);

      const launch = await CapacitorApp.getLaunchUrl();
      if (!disposed && launch?.url) {
        const path = deepLinkToAppPath(launch.url);
        if (path) router.push(path);
      }
    }

    void initNativeShell();

    const unregisterModalBack = registerAndroidBackHandler({
      id: 'modal-overlay',
      priority: 100,
      handle: () => {
        const closeButtons = document.querySelectorAll<HTMLElement>('[data-mobile-back-close]');
        const visible = Array.from(closeButtons).find((el) => el.offsetParent !== null);
        if (!visible) return false;
        visible.click();
        return true;
      }
    });

    const unregisterNavBack = registerAndroidBackHandler({
      id: 'mobile-nav-drawer',
      priority: 90,
      handle: () => {
        const drawer = document.querySelector<HTMLElement>('.mobile-nav-drawer.open, .mobile-nav-panel.open');
        if (!drawer) return false;
        const close = document.querySelector<HTMLElement>('.mobile-nav-close, [data-mobile-nav-close]');
        close?.click();
        return true;
      }
    });

    function onDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#')) return;

      event.preventDefault();
      void handleNavigationClick(href, window.location.origin, (path) => router.push(path));
    }

    document.addEventListener('click', onDocumentClick, true);

    return () => {
      disposed = true;
      unregisterModalBack();
      unregisterNavBack();
      document.removeEventListener('click', onDocumentClick, true);
      for (const listener of listeners) {
        void listener.remove();
      }
    };
  }, [router]);

  return null;
}
