'use client';

import { useEffect } from 'react';

function normalizedTitle(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase();
}

export function ContractorStaticSections() {
  useEffect(() => {
    let attempts = 0;
    let timer: number | undefined;

    const applyOnce = () => {
      attempts += 1;

      const dashboard = document.querySelector('.contractor-dashboard');
      const currentSection = dashboard?.querySelector('#current-jobs');
      const historySection = dashboard?.querySelector('#history');

      const contractorPastTitle = historySection?.querySelector('summary h2');
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

      currentSection?.querySelectorAll<HTMLElement>('.contractor-job-card-display').forEach((card) => {
        const fields = card.querySelector<HTMLElement>('.inline-actions');
        if (!fields) return;
        const hasPay = Array.from(fields.querySelectorAll('.badge')).some((badge) =>
          String(badge.textContent || '').trim().toLowerCase().startsWith('pay:')
        );
        if (!hasPay) {
          const pay = document.createElement('span');
          pay.className = 'badge';
          pay.textContent = 'Pay: Not set';
          fields.appendChild(pay);
        }
      });

      const completedByTitle = new Map<string, string>();
      historySection?.querySelectorAll<HTMLElement>('.contractor-job-card').forEach((card) => {
        const title = normalizedTitle(card.querySelector('h3')?.textContent);
        const scheduleAndAddress = String(card.querySelector('.muted')?.textContent || '').trim();
        const parts = scheduleAndAddress.split(' · ').map((part) => part.trim()).filter(Boolean);
        const address = parts.length > 1 ? parts.slice(1).join(' · ') : '';
        if (title && address && address.toLowerCase() !== 'not set') completedByTitle.set(title, address);
      });

      historySection?.querySelectorAll<HTMLElement>('.contractor-history-card').forEach((card) => {
        if (card.querySelector('.contractor-history-address')) return;
        const title = normalizedTitle(card.querySelector('h3')?.textContent);
        const address = completedByTitle.get(title) || 'Not set';
        const field = document.createElement('div');
        field.className = 'contractor-history-address';
        const label = document.createElement('span');
        label.className = 'muted';
        label.textContent = 'Address';
        const value = document.createElement('strong');
        value.textContent = address;
        field.append(label, value);
        const details = card.querySelector('dl');
        card.insertBefore(field, details || null);
      });

      const contractorReady = Boolean(currentSection && historySection);
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
