/**
 * Client-side authenticated activity heartbeat.
 * Server timestamp (via /api/account/activity) is the source of truth.
 */

export const ACTIVITY_HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000;
/** Minimum gap between non-forced heartbeats to avoid request spam. */
export const ACTIVITY_HEARTBEAT_MIN_GAP_MS = 3 * 60 * 1000;

type HeartbeatOptions = {
  force?: boolean;
};

let lastSentAt = 0;
let inFlight: Promise<boolean> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let started = false;
let authSubscription: { unsubscribe: () => void } | null = null;
let visibilityHandler: (() => void) | null = null;
let nativeListener: { remove: () => Promise<void> | void } | null = null;
let mountCount = 0;

async function hasAuthenticatedSession(): Promise<boolean> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const {
      data: { session }
    } = await supabase.auth.getSession();
    return Boolean(session?.user);
  } catch {
    return false;
  }
}

export async function pingActivityHeartbeat(options: HeartbeatOptions = {}): Promise<boolean> {
  const force = Boolean(options.force);
  const now = Date.now();

  if (!force && now - lastSentAt < ACTIVITY_HEARTBEAT_MIN_GAP_MS) {
    return false;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const authenticated = await hasAuthenticatedSession();
      if (!authenticated) {
        return false;
      }

      const response = await fetch('/api/account/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true
      });

      if (response.status === 401) {
        return false;
      }

      if (!response.ok) {
        return false;
      }

      lastSentAt = Date.now();
      return true;
    } catch {
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

async function onVisibilityOrResume() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return;
  }
  const authenticated = await hasAuthenticatedSession();
  if (!authenticated) return;
  void pingActivityHeartbeat();
}

async function bindNativeResume() {
  try {
    const { isNativePlatform } = await import('@/lib/platform/detect');
    if (!isNativePlatform()) return;

    const { App: CapacitorApp } = await import('@capacitor/app');
    nativeListener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void onVisibilityOrResume();
      }
    });
  } catch {
    // Capacitor App plugin unavailable on web.
  }
}

/**
 * Start the global heartbeat. Safe to call from a single React mount;
 * duplicate mounts are reference-counted and do not create extra timers.
 */
export async function startActivityHeartbeat(): Promise<void> {
  mountCount += 1;
  if (started) {
    void pingActivityHeartbeat({ force: true });
    return;
  }
  started = true;

  const { supabase } = await import('@/lib/supabase');

  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((event: string) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
      void pingActivityHeartbeat({ force: event === 'SIGNED_IN' || event === 'INITIAL_SESSION' });
      return;
    }
    if (event === 'SIGNED_OUT') {
      lastSentAt = 0;
    }
  });
  authSubscription = subscription;

  visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      void onVisibilityOrResume();
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  await bindNativeResume();

  intervalId = setInterval(() => {
    void (async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const authenticated = await hasAuthenticatedSession();
      if (!authenticated) return;
      void pingActivityHeartbeat();
    })();
  }, ACTIVITY_HEARTBEAT_INTERVAL_MS);

  void pingActivityHeartbeat({ force: true });
}

/** Stop the global heartbeat when the last mounted consumer unmounts. */
export function stopActivityHeartbeat(): void {
  mountCount = Math.max(0, mountCount - 1);
  if (mountCount > 0) return;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  if (authSubscription) {
    authSubscription.unsubscribe();
    authSubscription = null;
  }
  if (nativeListener) {
    void nativeListener.remove();
    nativeListener = null;
  }
  started = false;
  lastSentAt = 0;
  inFlight = null;
}

/** Test helper — resets module singleton state. */
export function resetActivityHeartbeatForTests(): void {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
  }
  visibilityHandler = null;
  if (authSubscription) authSubscription.unsubscribe();
  authSubscription = null;
  if (nativeListener) void nativeListener.remove();
  nativeListener = null;
  started = false;
  mountCount = 0;
  lastSentAt = 0;
  inFlight = null;
}
