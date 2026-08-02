'use client';

import { useEffect } from 'react';

export function ContractorStaticSections() {
  useEffect(() => {
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

    makeJobCardsStatic();
    const observer = new MutationObserver(makeJobCardsStatic);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
