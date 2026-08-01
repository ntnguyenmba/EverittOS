'use client';

import { useEffect } from 'react';

const STATIC_SECTION_IDS = ['schedule', 'past-jobs', 'earnings'];

export function ContractorStaticSections() {
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    for (const id of STATIC_SECTION_IDS) {
      const section = document.getElementById(id);
      if (!(section instanceof HTMLDetailsElement)) continue;

      section.open = true;
      const keepOpen = () => {
        if (!section.open) section.open = true;
      };
      section.addEventListener('toggle', keepOpen);
      cleanups.push(() => section.removeEventListener('toggle', keepOpen));
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return (
    <style jsx global>{`
      .contractor-dashboard details#schedule > summary,
      .contractor-dashboard details#past-jobs > summary,
      .contractor-dashboard details#earnings > summary {
        cursor: default !important;
        pointer-events: none;
      }

      .contractor-dashboard details#schedule > summary::-webkit-details-marker,
      .contractor-dashboard details#past-jobs > summary::-webkit-details-marker,
      .contractor-dashboard details#earnings > summary::-webkit-details-marker {
        display: none;
      }
    `}</style>
  );
}
