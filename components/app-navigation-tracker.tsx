'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { recordAppNavigation } from '@/lib/app-navigation-stack';
import { supabase } from '@/lib/supabase';

const ACTIVITY_STORAGE_PREFIX = 'everittos.last-activity-heartbeat';
const ACTIVITY_INTERVAL_MS = 5 * 60 * 1000;

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

  const { error } = await supabase
    .from('profiles')
    .update({ updated_at: new Date(now).toISOString() })
    .eq('id', user.id);

  if (!error) {
    try {
      window.localStorage.setItem(storageKey, String(now));
    } catch {
      // The database update succeeded, so storage failure can be ignored.
    }
  }
}

/** Tracks authenticated navigation and keeps the user's last-active time current. */
export function AppNavigationTracker() {
  const pathname = usePathname();

  useEffect(() => {
    recordAppNavigation(pathname);
    void recordUserActivity();
  }, [pathname]);

  useEffect(() => {
    function recordWhenVisible() {
      if (document.visibilityState === 'visible') void recordUserActivity();
    }

    document.addEventListener('visibilitychange', recordWhenVisible);
    window.addEventListener('focus', recordWhenVisible);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void recordUserActivity();
    }, ACTIVITY_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', recordWhenVisible);
      window.removeEventListener('focus', recordWhenVisible);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
