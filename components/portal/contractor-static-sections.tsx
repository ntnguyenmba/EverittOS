'use client';

import { useEffect } from 'react';

export function ContractorStaticSections() {
  useEffect(() => {
    let attempts = 0;
    let timer: number | undefined;

    const applyOnce = () => {
      attempts += 1;

      const contractorPastTitle = document.querySelector('.contractor-dashboard #history summary h2');
      const clientPastTitle = document.querySelector('.client-portal-jobs #history summary h2');

      if (contractorPastTitle) contractorPastTitle.textContent = 'Past Jobs';
      if (clientPastTitle) clientPastTitle.textContent = 'Past Jobs';

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

      const contractorReady = Boolean(document.querySelector('.contractor-dashboard'));
      const clientReady = Boolean(document.querySelector('.client-portal-jobs'));

      if (!contractorReady && !clientReady && attempts < 30) {
        timer = window.setTimeout(applyOnce, 100);
      }
    };

    applyOnce();

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
