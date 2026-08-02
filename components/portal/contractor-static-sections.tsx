'use client';

import { useEffect } from 'react';

export function ContractorStaticSections() {
  useEffect(() => {
    let attempts = 0;

    const applyLabels = () => {
      attempts += 1;

      const contractorPastTitle = document.querySelector('.contractor-dashboard #history summary h2');
      const clientPastTitle = document.querySelector('.client-portal-jobs #history summary h2');

      if (contractorPastTitle) contractorPastTitle.textContent = 'Past Jobs';
      if (clientPastTitle) clientPastTitle.textContent = 'Past Jobs';

      if ((!contractorPastTitle || !clientPastTitle) && attempts < 50) {
        window.setTimeout(applyLabels, 100);
      }
    };

    applyLabels();
  }, []);

  return null;
}
