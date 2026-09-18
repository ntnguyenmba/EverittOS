'use client';

import { useEffect } from 'react';

const RECOVERY_KEY = 'everittos-runtime-recovery';

function errorText(value: unknown) {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isRecoverableRuntimeError(value: unknown) {
  const text = errorText(value).toLowerCase();
  return [
    'chunkloaderror',
    'loading chunk',
    'failed to fetch dynamically imported module',
    'importing a module script failed',
    'failed to load module script',
    'unexpected token <',
    'networkerror when attempting to fetch resource'
  ].some((needle) => text.includes(needle));
}

function hardReloadOnce() {
  try {
    const previous = window.sessionStorage.getItem(RECOVERY_KEY);
    const now = Date.now();
    if (previous && now - Number(previous) < 60_000) return;
    window.sessionStorage.setItem(RECOVERY_KEY, String(now));
  } catch {
    // sessionStorage can be unavailable in strict/private browser contexts.
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('__everitt_reload', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    try {
      window.location.reload();
    } catch {
      /* last resort — never throw from the recovery listener */
    }
  }
}

export function RuntimeRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isRecoverableRuntimeError(event.error || event.message)) hardReloadOnce();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isRecoverableRuntimeError(event.reason)) hardReloadOnce();
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
