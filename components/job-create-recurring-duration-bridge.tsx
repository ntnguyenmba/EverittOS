'use client';

import { useEffect } from 'react';

function minutesBetween(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return null;
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}

export function JobCreateRecurringDurationBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

      if (url === '/api/recurring-jobs' && method === 'POST' && typeof init?.body === 'string') {
        try {
          const payload = JSON.parse(init.body) as Record<string, unknown>;
          if (payload.duration_minutes == null) {
            const start = (document.getElementById('job-start-time') as HTMLInputElement | null)?.value || '';
            const end = (document.getElementById('job-end-time') as HTMLInputElement | null)?.value || '';
            const duration = minutesBetween(start, end);
            if (duration != null) payload.duration_minutes = duration;
          }
          return originalFetch(input, { ...init, body: JSON.stringify(payload) });
        } catch {
          return originalFetch(input, init);
        }
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
