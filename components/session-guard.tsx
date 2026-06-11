'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { clearTabSessionId, readTabSessionId, storeTabSessionId } from '@/lib/session-client';
import { isSessionExemptPath, sessionIdleTimeoutMs } from '@/lib/session-policy';
import { supabase } from '@/lib/supabase';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;
const TOUCH_INTERVAL_MS = 60_000;

async function signOutToLogin(reason: 'idle' | 'session', detail: string) {
  clearTabSessionId();
  try {
    await fetch('/api/auth/sign-out', { method: 'POST', keepalive: true });
  } catch {
    await supabase.auth.signOut();
  }
  const params = new URLSearchParams({ reason, detail });
  window.location.assign(`/login?${params.toString()}`);
}

export function SessionGuard() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const lastActivityRef = useRef(Date.now());
  const lastTouchRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkingRef = useRef(false);

  const scheduleIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    const remaining = sessionIdleTimeoutMs() - (Date.now() - lastActivityRef.current);
    idleTimerRef.current = setTimeout(() => {
      void signOutToLogin(
        'idle',
        'You were signed out after a period of inactivity. Sign in again to continue.'
      );
    }, Math.max(remaining, 0));
  }, []);

  const touchSession = useCallback(async () => {
    const now = Date.now();
    if (now - lastTouchRef.current < TOUCH_INTERVAL_MS) return;
    lastTouchRef.current = now;
    try {
      await fetch('/api/auth/session-touch', { method: 'POST' });
    } catch {
      /* network blip — server middleware still tracks activity on navigation */
    }
  }, []);

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    scheduleIdleTimer();
    void touchSession();
  }, [scheduleIdleTimer, touchSession]);

  useEffect(() => {
    if (isSessionExemptPath(pathname)) return;

    let cancelled = false;

    async function verifySession() {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();

        if (!user) {
          checkingRef.current = false;
          return;
        }

        const storedTabId = readTabSessionId();
        if (!storedTabId) {
          const res = await fetch('/api/auth/tab-session');
          if (res.status === 401) {
            router.replace('/login?reason=session');
            return;
          }
          if (res.ok) {
            const json = await res.json();
            if (json.tabSessionId) {
              storeTabSessionId(json.tabSessionId);
            }
          }
        }

        if (cancelled) return;

        lastActivityRef.current = Date.now();
        scheduleIdleTimer();
        void touchSession();
      } finally {
        checkingRef.current = false;
      }
    }

    void verifySession();

    const onActivity = () => recordActivity();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') recordActivity();
    });

    return () => {
      cancelled = true;
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [pathname, recordActivity, router, scheduleIdleTimer, touchSession]);

  return null;
}
