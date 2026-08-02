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

    const makeJobCardsStatic = () => {
      document.querySelectorAll<HTMLButtonElement>('.contractor-dashboard .contractor-job-card > button').forEach((button) => {
        const display = document.createElement('div');
        display.className = 'contractor-job-card-display';
        display.innerHTML = button.innerHTML;
        button.replaceWith(display);
      });

      document.querySelectorAll<HTMLAnchorElement>('.client-portal-jobs .client-job-card[href]').forEach((link) => {
        link.removeAttribute('href');
        link.removeAttribute('tabindex');
        link.removeAttribute('role');
      });
    };

    const apply = () => {
      const dashboard = document.querySelector('.contractor-dashboard');
      const current = dashboard?.querySelector('#current-jobs');
      const historySection = dashboard?.querySelector('#history');

      makeJobCardsStatic();

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
    const observer = new MutationObserver(makeJobCardsStatic);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      history?.removeEventListener('toggle', keepHistoryOpen);
    };
  }, []);

  return null;
}
