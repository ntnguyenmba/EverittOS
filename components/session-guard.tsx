'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SessionIdleWarning } from '@/components/session-idle-warning';
import { pingActivityHeartbeat } from '@/lib/activity-heartbeat';
import { clearTabSessionId, readTabSessionId, storeTabSessionId } from '@/lib/session-client';
import { isSessionExemptPath, sessionIdleTimeoutMs, sessionIdleWarningBeforeMs } from '@/lib/session-policy';
import { supabase } from '@/lib/supabase';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'] as const;
const TOUCH_INTERVAL_MS = 60_000;
const MOUSEMOVE_THROTTLE_MS = 2_000;
const COUNTDOWN_INTERVAL_MS = 1000;
const LAST_ACTIVITY_STORAGE_KEY = 'everittos_last_activity_client';

function readLastActivity(): number {
  if (typeof window === 'undefined') return Date.now();
  try {
    const stored = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
  } catch {
    return Date.now();
  }
}
function storeLastActivity(timestamp: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(timestamp));
  } catch {
    /* iOS and strict browser modes may block storage; keep the in-memory clock active. */
  }
}
function clearLastActivity() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
  } catch {
    /* A blocked storage API must not interrupt sign-out or navigation. */
  }
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

async function requestTabSession() {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3000);
    const response = await fetch('/api/auth/tab-session', { cache: 'no-store', signal: controller.signal }).finally(() =>
      window.clearTimeout(timer)
    );
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
    } catch {}
    void pingActivityHeartbeat();
  }, []);
  const scheduleIdleTimers = useCallback(() => {
    clearTimers();
    closeWarning();
    const idleMs = sessionIdleTimeoutMs();
    const warningBeforeMs = Math.min(sessionIdleWarningBeforeMs(), idleMs - 60_000);
    const warningAtMs = idleMs - warningBeforeMs;
    const elapsed = Date.now() - lastActivityRef.current;
    warningTimerRef.current = setTimeout(() => {
      const remainingMs = sessionIdleTimeoutMs() - (Date.now() - lastActivityRef.current);
      if (remainingMs <= 0) return;
      warningOpenRef.current = true;
      setWarningOpen(true);
      setSecondsRemaining(Math.ceil(remainingMs / 1000));
      countdownTimerRef.current = setInterval(() => {
        const nextRemaining = Math.ceil((sessionIdleTimeoutMs() - (Date.now() - lastActivityRef.current)) / 1000);
        setSecondsRemaining(Math.max(nextRemaining, 0));
        if (nextRemaining <= 0 && countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      }, COUNTDOWN_INTERVAL_MS);
    }, Math.max(warningAtMs - elapsed, 0));
    logoutTimerRef.current = setTimeout(() => {
      void signOutToLogin('idle', 'You were signed out after a period of inactivity. Sign in again to continue.');
    }, Math.max(idleMs - elapsed, 0));
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
      void signOutToLogin('idle', 'You were signed out after a period of inactivity. Sign in again to continue.');
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

    async function initializeIdleSession() {
      const storedTabId = readTabSessionId();
      if (!storedTabId) {
        storeLastActivity(Date.now());
        lastActivityRef.current = Date.now();
        const tabSessionId = await requestTabSession();
        if (tabSessionId) storeTabSessionId(tabSessionId);
        if (cancelled) return;
        recordActivity();
        return;
      }
      if (cancelled) return;
      let hasPersistedActivity = false;
      try {
        hasPersistedActivity = Boolean(window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
      } catch {
        /* Continue with the current in-memory activity time when storage is blocked. */
      }
      if (hasPersistedActivity && !checkIdleBeforeResume()) return;
      recordActivity();
    }
    void initializeIdleSession();

    const onActivity = (event: Event) => {
      if (event.type === 'mousemove') {
        const now = Date.now();
        if (now - lastMouseMoveRef.current < MOUSEMOVE_THROTTLE_MS) return;
        lastMouseMoveRef.current = now;
      }
      recordActivity();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && readTabSessionId() && checkIdleBeforeResume()) recordActivity();
    };
    const onPageShow = () => {
      if (readTabSessionId() && checkIdleBeforeResume()) recordActivity();
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
  }, [pathname, recordActivity, clearTimers, closeWarning, checkIdleBeforeResume]);

  return (
    <>
      {children}
      <SessionIdleWarning open={warningOpen} secondsRemaining={secondsRemaining} onStaySignedIn={handleStaySignedIn} />
    </>
  );
}
