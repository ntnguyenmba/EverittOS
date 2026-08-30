'use client';

import { useEffect } from 'react';

/**
 * Keeps the job guidance CTA wired to the real job status controls without
 * depending on the translated button copy used by the detail page.
 */
export function JobGuidanceActionBridge() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.job-guidance-next .btn') : null;
      if (!target || target.disabled) return;

      const label = (target.textContent || '').trim().toLowerCase();
      const wantsStart = ['start job', 'iniciar trabajo', 'bắt đầu công việc'].some((value) => label.includes(value));
      const wantsFinish = ['mark job complete', 'marcar trabajo completo', 'đánh dấu hoàn tất'].some((value) => label.includes(value));
      if (!wantsStart && !wantsFinish) return;

      const actions = Array.from(document.querySelectorAll<HTMLButtonElement>('.job-detail-shell .job-detail-actions > button'));
      const realButton = wantsStart ? actions[0] : actions[1];
      if (!realButton || realButton.disabled) return;

      event.preventDefault();
      event.stopPropagation();
      realButton.click();
    }

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return null;
}
