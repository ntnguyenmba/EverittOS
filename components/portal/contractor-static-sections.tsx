'use client';

import { useEffect } from 'react';

export function ContractorStaticSections() {
  useEffect(() => {
    let frame = 0;
    let attempts = 0;
    let history: HTMLDetailsElement | null = null;

    const keepHistoryOpen = () => {
      if (history && !history.open) history.open = true;
    };

    const apply = () => {
      const dashboard = document.querySelector('.contractor-dashboard');
      const current = dashboard?.querySelector('#current-jobs');
      const historySection = dashboard?.querySelector('#history');

      if (!(current instanceof HTMLDetailsElement) || !(historySection instanceof HTMLDetailsElement)) {
        attempts += 1;
        if (attempts < 120) frame = window.requestAnimationFrame(apply);
        return;
      }

      current.open = true;
      history = historySection;
      history.open = true;
      history.addEventListener('toggle', keepHistoryOpen);
    };

    frame = window.requestAnimationFrame(apply);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      history?.removeEventListener('toggle', keepHistoryOpen);
    };
  }, []);

  return null;
}
