'use client';

import { useEffect } from 'react';

export function ContractorStaticSections() {
  useEffect(() => {
    let frame = 0;
    let attempts = 0;

    const applyLayoutOnce = () => {
      const dashboard = document.querySelector('.contractor-dashboard');
      const today = dashboard?.querySelector('#jobs');
      const schedule = dashboard?.querySelector('#schedule');
      const past = dashboard?.querySelector('#past-jobs');
      const earnings = dashboard?.querySelector('#earnings');

      if (
        !(today instanceof HTMLElement) ||
        !(schedule instanceof HTMLDetailsElement) ||
        !(past instanceof HTMLDetailsElement) ||
        !(earnings instanceof HTMLDetailsElement)
      ) {
        attempts += 1;
        if (attempts < 120) frame = window.requestAnimationFrame(applyLayoutOnce);
        return;
      }

      const scheduleTitle = schedule.querySelector('summary h2');
      if (scheduleTitle) scheduleTitle.textContent = 'Current Jobs';

      const todayCards = Array.from(today.querySelectorAll('.contractor-job-card'));
      const scheduleBodyStart = schedule.querySelector('summary')?.nextSibling;
      for (const card of todayCards.reverse()) {
        schedule.insertBefore(card, scheduleBodyStart);
      }
      today.remove();

      const earningsTitle = earnings.querySelector('summary h2');
      if (earningsTitle) earningsTitle.textContent = 'History';

      const completedCards = Array.from(past.querySelectorAll('.contractor-job-card'));
      const earningsSummary = earnings.querySelector('summary');
      const historyList = document.createElement('div');
      historyList.className = 'contractor-history-jobs';
      historyList.style.marginTop = '12px';
      for (const card of completedCards) historyList.appendChild(card);
      if (completedCards.length > 0 && earningsSummary) earningsSummary.insertAdjacentElement('afterend', historyList);
      past.remove();

      schedule.open = true;
      earnings.open = false;

      if (schedule.parentElement && earnings.parentElement === schedule.parentElement) {
        schedule.parentElement.insertBefore(schedule, earnings);
      }
    };

    frame = window.requestAnimationFrame(applyLayoutOnce);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <style jsx global>{`
      .contractor-dashboard details#schedule > summary,
      .contractor-dashboard details#earnings > summary {
        cursor: pointer !important;
      }

      .contractor-dashboard details#schedule .contractor-job-card > button,
      .contractor-dashboard details#earnings .contractor-job-card > button {
        cursor: default !important;
        pointer-events: none;
      }

      .contractor-dashboard details#schedule .contractor-job-card [aria-expanded],
      .contractor-dashboard details#earnings .contractor-job-card [aria-expanded] {
        pointer-events: none;
      }
    `}</style>
  );
}
