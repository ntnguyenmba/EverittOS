'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { recordAppNavigation } from '@/lib/app-navigation-stack';
import { performClientLogout } from '@/lib/client-logout';
import { supabase } from '@/lib/supabase';

const ACTIVITY_STORAGE_PREFIX = 'everittos.last-activity-heartbeat';
const SESSION_ACTIVITY_KEY = 'everittos.session.last-user-activity';
const ACTIVITY_INTERVAL_MS = 5 * 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_CHECK_INTERVAL_MS = 30 * 1000;
const USER_ACTIVITY_EVENTS: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'scroll'];

async function recordUserActivity() {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return;

  const now = Date.now();
  const storageKey = `${ACTIVITY_STORAGE_PREFIX}:${user.id}`;

  try {
    const previous = Number(window.localStorage.getItem(storageKey) || 0);
    if (now - previous < ACTIVITY_INTERVAL_MS) return;
  } catch {
    // Continue without local throttling when storage is unavailable.
  }

  try {
    const response = await fetch('/api/account/activity', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      keepalive: true
    });

    if (!response.ok) return;

    const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    if (!result?.ok) return;

    try {
      window.localStorage.setItem(storageKey, String(now));
    } catch {
      // The server heartbeat succeeded, so storage failure can be ignored.
    }
  } catch {
    // Activity tracking must never interrupt navigation or app use.
  }
}

function readLastUserActivity() {
  try {
    const value = Number(window.localStorage.getItem(SESSION_ACTIVITY_KEY) || 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeLastUserActivity(timestamp = Date.now()) {
  try {
    window.localStorage.setItem(SESSION_ACTIVITY_KEY, String(timestamp));
  } catch {
    // Keep the in-memory timer working when storage is unavailable.
  }
}

/** Tracks authenticated navigation, server activity, and the 30-minute inactivity session limit. */
export function AppNavigationTracker() {
  const pathname = usePathname();

  useEffect(() => {
    recordAppNavigation(pathname);
    void recordUserActivity();
  }, [pathname]);

  useEffect(() => {
    let lastActivity = readLastUserActivity() || Date.now();
    let loggingOut = false;
    writeLastUserActivity(lastActivity);

    function markActive() {
      lastActivity = Date.now();
      writeLastUserActivity(lastActivity);
    }

    async function checkSessionTimeout() {
      if (loggingOut) return;
      const storedActivity = readLastUserActivity();
      if (storedActivity > lastActivity) lastActivity = storedActivity;
      if (Date.now() - lastActivity < INACTIVITY_TIMEOUT_MS) return;

      loggingOut = true;
      await performClientLogout();
    }

    function recordWhenVisible() {
      if (document.visibilityState !== 'visible') return;
      void checkSessionTimeout();
      void recordUserActivity();
    }

    for (const eventName of USER_ACTIVITY_EVENTS) {
      window.addEventListener(eventName, markActive, { passive: true });
    }
    document.addEventListener('visibilitychange', recordWhenVisible);
    window.addEventListener('focus', recordWhenVisible);

    const activityInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void recordUserActivity();
    }, ACTIVITY_INTERVAL_MS);
    const timeoutInterval = window.setInterval(() => void checkSessionTimeout(), SESSION_CHECK_INTERVAL_MS);

    return () => {
      for (const eventName of USER_ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, markActive);
      }
      document.removeEventListener('visibilitychange', recordWhenVisible);
      window.removeEventListener('focus', recordWhenVisible);
      window.clearInterval(activityInterval);
      window.clearInterval(timeoutInterval);
    };
  }, []);

  return null;
}
