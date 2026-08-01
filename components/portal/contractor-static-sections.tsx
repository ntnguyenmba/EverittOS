'use client';

import { useEffect } from 'react';

export function ContractorStaticSections() {
  useEffect(() => {
    let frame = 0;

    const applyLayout = () => {
      frame = 0;
      const dashboard = document.querySelector('.contractor-dashboard');
      const schedule = dashboard?.querySelector('#schedule');
      const past = dashboard?.querySelector('#past-jobs');
      const earnings = dashboard?.querySelector('#earnings');

      if (!(schedule instanceof HTMLDetailsElement)) return;
      if (!(past instanceof HTMLDetailsElement)) return;
      if (!(earnings instanceof HTMLDetailsElement)) return;

      schedule.open = true;
      earnings.open = true;
      past.open = false;

      if (schedule.parentElement && earnings.parentElement === schedule.parentElement) {
        schedule.parentElement.insertBefore(earnings, schedule);
      }
    };

    const scheduleLayout = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(applyLayout);
    };

    scheduleLayout();
    const observer = new MutationObserver(scheduleLayout);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <style jsx global>{`
      .contractor-dashboard details#schedule > summary,
      .contractor-dashboard details#past-jobs > summary,
      .contractor-dashboard details#earnings > summary {
        cursor: pointer !important;
      }

      .contractor-dashboard details#schedule .contractor-job-card > button,
      .contractor-dashboard details#past-jobs .contractor-job-card > button {
        cursor: default !important;
        pointer-events: none;
      }

      .contractor-dashboard details#schedule .contractor-job-card [aria-expanded],
      .contractor-dashboard details#past-jobs .contractor-job-card [aria-expanded] {
        pointer-events: none;
      }
    `}</style>
  );
}
