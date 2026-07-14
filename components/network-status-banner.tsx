'use client';

import { useEffect, useState } from 'react';
import { readNetworkState, watchNetwork } from '@/lib/platform/network';

/** Small offline notice using existing banner styling. */
export function NetworkStatusBanner() {
  const [online, setOnline] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let dispose: (() => void) | undefined;

    void readNetworkState().then((state) => {
      setOnline(state.online);
      setInitialized(true);
    });

    void watchNetwork((state) => {
      setOnline(state.online);
      setInitialized(true);
    }).then((cleanup) => {
      dispose = cleanup;
    });

    return () => {
      dispose?.();
    };
  }, []);

  if (!initialized || online) return null;

  return (
    <div className="app-connectivity-banner network-offline-banner" role="status" aria-live="polite">
      You are offline. EverittOS needs a connection to load current workspace data. Retry when your network returns.
      <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  );
}
