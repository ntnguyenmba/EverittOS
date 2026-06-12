'use client';

import { useEffect } from 'react';
import { shouldSuppressVercelToolbar } from '@/lib/deployment-env';

const TOOLBAR_SELECTORS = [
  'vercel-live-feedback',
  '[data-vercel-toolbar]',
  '#vercel-toolbar',
  'iframe[src*="vercel.live"]'
];

function removeToolbarNodes() {
  for (const selector of TOOLBAR_SELECTORS) {
    document.querySelectorAll(selector).forEach((node) => node.remove());
  }
}

function isVercelToolbarScript(node: Node): boolean {
  return node instanceof HTMLScriptElement && /vercel\.live/i.test(node.src || '');
}

/**
 * Production guard against Vercel's platform-injected toolbar / feedback widget.
 * Preview and localhost are left alone for internal QA.
 */
export function SuppressVercelToolbar() {
  useEffect(() => {
    if (!shouldSuppressVercelToolbar()) return;

    removeToolbarNodes();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement && node.matches(TOOLBAR_SELECTORS.join(', '))) {
            node.remove();
            return;
          }
          if (isVercelToolbarScript(node)) {
            node.parentNode?.removeChild(node);
          }
        });
      }
      removeToolbarNodes();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
