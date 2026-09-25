'use client';

import { useEffect } from 'react';
import { drainOfflineRequestQueue } from '@/lib/offline-request-queue';
import { drainContractorOutbox } from '@/lib/contractor-offline';
import { watchNetwork } from '@/lib/platform/network';

export function OfflineSyncManager() {
  useEffect(() => {
    let disposed = false;
    let stopWatching: () => void = () => undefined;
    let draining = false;

    const drain = async () => {
      if (disposed || draining) return;
      draining = true;
      try {
        await drainContractorOutbox();
        await drainOfflineRequestQueue();
      } finally {
        draining = false;
      }
    };

    void watchNetwork((state) => {
      if (state.online) void drain();
    }).then((stop) => {
      if (disposed) stop();
      else stopWatching = stop;
    });

    const onPageShow = () => void drain();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void drain();
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisible);
    void drain();

    return () => {
      disposed = true;
      stopWatching();
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
