'use client';

import { useEffect } from 'react';

export function ContractorStaticSections() {
  useEffect(() => {
    let frame = 0;
    let attempts = 0;

    const applyLayoutOnce = () => {
      const dashboard = document.querySelector('.contractor-dashboard');
      const schedule = dashboard?.querySelector('#schedule');
      const past = dashboard?.querySelector('#past-jobs');
      const earnings = dashboard?.querySelector('#earnings');

      if (
        !(schedule instanceof HTMLDetailsElement) ||
        !(past instanceof HTMLDetailsElement) ||
        !(earnings instanceof HTMLDetailsElement)
      ) {
        attempts += 1;
        if (attempts < 120) frame = window.requestAnimationFrame(applyLayoutOnce);
        return;
      }

      schedule.open = true;
      earnings.open = true;
      past.open = false;

      if (schedule.parentElement && earnings.parentElement === schedule.parentElement) {
        schedule.parentElement.insertBefore(earnings, schedule);
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
