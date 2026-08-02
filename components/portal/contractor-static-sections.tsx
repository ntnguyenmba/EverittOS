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
        button.type = 'button';
        button.tabIndex = -1;
        button.setAttribute('aria-disabled', 'true');
        button.style.pointerEvents = 'none';
        button.style.cursor = 'default';
      });

      document.querySelectorAll<HTMLAnchorElement>('.client-portal-jobs .client-job-card[href]').forEach((link) => {
        link.removeAttribute('href');
        link.tabIndex = -1;
        link.setAttribute('aria-disabled', 'true');
        link.style.cursor = 'default';
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
