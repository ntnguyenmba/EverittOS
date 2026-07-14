'use client';

import { useEffect } from 'react';
import { isInstalledPwa, isNativePlatform } from '@/lib/platform/detect';

/** Adds document attributes used by safe-area CSS without affecting desktop browsers. */
export function MobileDocumentFlags() {
  useEffect(() => {
    const root = document.documentElement;
    if (isNativePlatform()) {
      root.dataset.nativeApp = 'true';
    }
    if (isInstalledPwa()) {
      root.dataset.standalone = 'true';
    }
  }, []);

  return null;
}
