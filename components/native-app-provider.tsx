'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { dispatchAndroidBackPress, registerAndroidBackHandler } from '@/lib/platform/android-back';
import { deepLinkToAppPath } from '@/lib/platform/deep-links';
import { classifyNavigationTarget, handleNavigationClick } from '@/lib/platform';
import { pingActivityHeartbeat } from '@/lib/activity-heartbeat';
import { isNativePlatform } from '@/lib/platform/detect';
import { supabase } from '@/lib/supabase';

async function refreshSessionAfterResume(): Promise<void> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return;
    if (!data.session) {
      // Do not kick the user to login during a transient native WebView restore.
      // SessionGuard performs the authoritative session check after the app settles.
      return;
    }

    const expiresAtMs = Number(data.session.expires_at || 0) * 1000;
    const needsRefresh = !expiresAtMs || expiresAtMs - Date.now() < 10 * 60 * 1000;
    if (needsRefresh) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) return;
    }

    window.dispatchEvent(new Event('everittos:workspace-plan-refresh'));
    void pingActivityHeartbeat({ force: true });
  } catch {
    // Network may still be unavailable immediately after resume; preserve the local session.
  }
}

function stripInternalNewTabTargets(root: ParentNode = document) {
  const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href][target="_blank"]');
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#')) continue;
    if (classifyNavigationTarget(href, window.location.origin) !== 'internal') continue;
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
  }
}

export function NativeAppProvider() {
  const router = useRouter();

  useEffect(() => {
    const native = isNativePlatform();
    let disposed = false;
    const listeners: Array<{ remove: () => Promise<void> | void }> = [];

    stripInternalNewTabTargets();
    const targetObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches('a[href][target="_blank"]')) stripInternalNewTabTargets(node.parentNode || document);
          else stripInternalNewTabTargets(node);
        }
      }
    });
    targetObserver.observe(document.body, { childList: true, subtree: true });

    async function initNativeShell() {
      if (!native) return;
      try { await SplashScreen.hide(); } catch {}
      try { await StatusBar.setStyle({ style: Style.Dark }); await StatusBar.setBackgroundColor({ color: '#24302B' }); } catch {}
      try { await Keyboard.setAccessoryBarVisible({ isVisible: true }); } catch {}

      const appState = await CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void refreshSessionAfterResume(); });
      listeners.push(appState);
      const urlOpen = await CapacitorApp.addListener('appUrlOpen', (event) => { const path = deepLinkToAppPath(event.url); if (path) router.push(path); });
      listeners.push(urlOpen);
      const backButton = await CapacitorApp.addListener('backButton', () => { if (dispatchAndroidBackPress()) return; if (window.history.length > 1) { router.back(); return; } void CapacitorApp.exitApp(); });
      listeners.push(backButton);
      const launch = await CapacitorApp.getLaunchUrl();
      if (!disposed && launch?.url) { const path = deepLinkToAppPath(launch.url); if (path) router.push(path); }
    }

    void initNativeShell();

    const unregisterModalBack = native ? registerAndroidBackHandler({ id: 'modal-overlay', priority: 100, handle: () => { const closeButtons = document.querySelectorAll<HTMLElement>('[data-mobile-back-close]'); const visible = Array.from(closeButtons).find((el) => el.offsetParent !== null); if (!visible) return false; visible.click(); return true; } }) : () => {};
    const unregisterNavBack = native ? registerAndroidBackHandler({ id: 'mobile-nav-drawer', priority: 90, handle: () => { const drawer = document.querySelector<HTMLElement>('.mobile-nav-drawer.open, .mobile-nav-panel.open'); if (!drawer) return false; const close = document.querySelector<HTMLElement>('.mobile-nav-close, [data-mobile-nav-close]'); close?.click(); return true; } }) : () => {};

    function onDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#')) return;
      const classification = classifyNavigationTarget(href, window.location.origin);
      if (!native && classification !== 'internal') return;
      event.preventDefault();
      if (classification === 'internal') { anchor.removeAttribute('target'); anchor.removeAttribute('rel'); }
      void handleNavigationClick(href, window.location.origin, (path) => router.push(path));
    }

    document.addEventListener('click', onDocumentClick, true);
    return () => {
      disposed = true;
      targetObserver.disconnect();
      unregisterModalBack();
      unregisterNavBack();
      document.removeEventListener('click', onDocumentClick, true);
      for (const listener of listeners) void listener.remove();
    };
  }, [router]);

  return null;
}
