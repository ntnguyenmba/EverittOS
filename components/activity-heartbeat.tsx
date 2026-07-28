'use client';

import { useEffect } from 'react';
import { startActivityHeartbeat, stopActivityHeartbeat } from '@/lib/activity-heartbeat';

/**
 * Mount once in the root layout. Starts a singleton authenticated heartbeat
 * for web + Capacitor (resume / foreground / visibility).
 */
export function ActivityHeartbeat() {
  useEffect(() => {
    void startActivityHeartbeat();
    return () => {
      stopActivityHeartbeat();
    };
  }, []);

  return null;
}
