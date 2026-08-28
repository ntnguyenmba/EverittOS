'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SessionIdleWarning } from '@/components/session-idle-warning';
import { pingActivityHeartbeat } from '@/lib/activity-heartbeat';
import { clearTabSessionId, readTabSessionId, storeTabSessionId } from '@/lib/session-client';
import {
  isSessionExemptPath,
  sessionIdleTimeoutMs,
  sessionIdleWarningBeforeMs
} from '@/lib/session-policy';
import { supabase } from '@/lib/supabase';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'] as const;
const TOUCH_INTERVAL_MS = 60_000;
const MOUSEMOVE_THROTTLE_MS = 2_000;
const COUNTDOWN_INTERVAL_MS = 1000;
const LAST_ACTIVITY_STORAGE_KEY = 'everittos_last_activity_client';
const INITIAL_SESSION_RETRY_DELAYS_MS = [150, 350, 700] as const;

function readLastActivity(): number {
  if (typeof window === 'undefined') return Date.now();
  const stored = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
}

function storeLastActivity(timestamp: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(timestamp));
}

function clearLastActivity() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function signOutToLogin(reason: 'idle' | 'session', detail: string) {
  clearTabSessionId();
  clearLastActivity();
  try {
    await fetch('/api/auth/sign-out', { method: 'POST', keepalive: true });
  } catch {
    await supabase.auth.signOut();
  }
  const params = new URLSearchParams({ reason, detail });
  window.location.assign(`/login?${params.toString()}`);
}

async function getAuthenticatedUserWithRefresh() {
  const first = await supabase.auth.getUser();
  if (first.data.user) return first.data.user;

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.data.session?.user) return refreshed.data.session.user;

  /*
   * Password login is completed by a server route that writes the Supabase auth
   * cookies onto its response. Immediately after window.location.assign(), the
   * client Supabase instance can briefly initialize before that new cookie-backed
   * session is visible. Do not turn that short handoff into a forced sign-out.
   */
  for (const delay of INITIAL_SESSION_RETRY_DELAYS_MS) {
    await wait(delay);
    const retry = await supabase.auth.getUser();
    if (retry.data.user) return retry.data.user;

    const session = await supabase.auth.getSession();
    if (session.data.session?.user) return session.data.session.user;
  }

  return null;
}

async function requestTabSession() {
  try {
    let response = await fetch('/api/auth/tab-session', { cache: 'no-store' });

    if (response.status === 401) {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.data.session?.user) {
        response = await fetch('/api/auth/tab-session', { cache: 'no-store' });
      }
    }

    if (!response.ok) return null;
    const json = (await response.json().catch(() => ({}))) as { tabSessionId?: string };
    return json.tabSessionId || null;
  } catch {
    return null;
  }
}

export function SessionGuard({ children }: { children?: ReactNode }) {
  const pathname = usePathname() || '/';
  const lastActivityRef = useRef(Date.now());
  const lastTouchRef = useRef(0);
  const lastMouseMoveRef = useRef(0);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkingRef = useRef(false);
  const warningOpenRef = useRef(false);

  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const clearTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    logoutTimerRef.current = null;
    warningTimerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const closeWarning = useCallback(() => {
    warningOpenRef.current = false;
    setWarningOpen(false);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const touchSession = useCallback(async () => {
    const now = Date.now();
    if (now - lastTouchRef.current < TOUCH_INTERVAL_MS) return;
    lastTouchRef.current = now;
    try {
      await fetch('/api/auth/session-touch', { method: 'POST' });
    } catch {
      /* A brief network or cookie sync issue should not sign out an active user. */
    }
    void pingActivityHeartbeat();
  }, []);

  const scheduleIdleTimers = useCallback(() => {
    clearTimers();
    closeWarning();

    const idleMs = sessionIdleTimeoutMs();
    const warningBeforeMs = Math.min(sessionIdleWarningBeforeMs(), idleMs - 60_000);
    const warningAtMs = idleMs - warningBeforeMs;
    const elapsed = Date.now() - lastActivityRef.current;
    const untilWarning = Math.max(warningAtMs - elapsed, 0);
    const untilLogout = Math.max(idleMs - elapsed, 0);

    warningTimerRef.current = setTimeout(() => {
      const remainingMs = sessionIdleTimeoutMs() - (Date.now() - lastActivityRef.current);
      if (remainingMs <= 0) return;

      warningOpenRef.current = true;
      setWarningOpen(true);
      setSecondsRemaining(Math.ceil(remainingMs / 1000));

      countdownTimerRef.current = setInterval(() => {
        const nextRemaining = Math.ceil(
          (sessionIdleTimeoutMs() - (Date.now() - lastActivityRef.current)) / 1000
        );
        setSecondsRemaining(Math.max(nextRemaining, 0));
        if (nextRemaining <= 0 && countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }, COUNTDOWN_INTERVAL_MS);
    }, untilWarning);

    logoutTimerRef.current = setTimeout(() => {
      void signOutToLogin(
        'idle',
        'You were signed out after a period of inactivity. Sign in again to continue.'
      );
    }, untilLogout);
  }, [clearTimers, closeWarning]);

  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    storeLastActivity(now);
    scheduleIdleTimers();
    void touchSession();
  }, [scheduleIdleTimers, touchSession]);

  const checkIdleBeforeResume = useCallback(() => {
    const persisted = readLastActivity();
    lastActivityRef.current = persisted;
    if (Date.now() - persisted >= sessionIdleTimeoutMs()) {
      void signOutToLogin(
        'idle',
        'You were signed out after a period of inactivity. Sign in again to continue.'
      );
      return false;
    }
    scheduleIdleTimers();
    return true;
  }, [scheduleIdleTimers]);

  const handleStaySignedIn = useCallback(() => {
    recordActivity();
  }, [recordActivity]);

  useEffect(() => {
    if (isSessionExemptPath(pathname)) return;

    let cancelled = false;

    async function verifySession() {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const user = await getAuthenticatedUserWithRefresh();

        if (!user) {
          if (!cancelled) {
            await signOutToLogin(
              'session',
              'Your session expired. Sign in again to continue.'
            );
          }
          return;
        }

        const storedTabId = readTabSessionId();
        if (!storedTabId) {
          const tabSessionId = await requestTabSession();
          if (tabSessionId) storeTabSessionId(tabSessionId);
        }

        if (cancelled) return;

        const persisted = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
        if (persisted && !checkIdleBeforeResume()) return;
        recordActivity();
      } finally {
        checkingRef.current = false;
      }
    }

    void verifySession();

    const onActivity = (event: Event) => {
      if (event.type === 'mousemove') {
        const now = Date.now();
        if (now - lastMouseMoveRef.current < MOUSEMOVE_THROTTLE_MS) return;
        lastMouseMoveRef.current = now;
      }
      recordActivity();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && checkIdleBeforeResume()) {
        recordActivity();
      }
    };

    const onPageShow = () => {
      if (checkIdleBeforeResume()) recordActivity();
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      cancelled = true;
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
      clearTimers();
      closeWarning();
    };
  }, [pathname, recordActivity, scheduleIdleTimers, touchSession, clearTimers, closeWarning, checkIdleBeforeResume]);

  return (
    <>
      {children}
      <SessionIdleWarning
        open={warningOpen}
        secondsRemaining={secondsRemaining}
        onStaySignedIn={handleStaySignedIn}
      />
    </>
  );
}
