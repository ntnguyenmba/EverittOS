'use client';

import { useEffect } from 'react';

export function QuotesInputPolish() {
  useEffect(() => {
    const root = document.querySelector('.pricing-helper-layout');
    if (!root) return;

    const handleFocus = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== 'number') return;
      if (target.value === '0') {
        requestAnimationFrame(() => target.select());
      }
    };

    root.addEventListener('focusin', handleFocus);
    return () => root.removeEventListener('focusin', handleFocus);
  }, []);

  return null;
}
