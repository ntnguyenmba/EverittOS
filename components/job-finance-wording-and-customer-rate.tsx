'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function replaceWorkerWording(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (current instanceof Text) nodes.push(current);
    current = walker.nextNode();
  }
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style, code, pre')) continue;
    const value = node.nodeValue || '';
    const next = value
      .replace(/Contractors/g, 'Workers')
      .replace(/Contractor/g, 'Worker')
      .replace(/contractors/g, 'workers')
      .replace(/contractor/g, 'worker');
    if (next !== value) node.nodeValue = next;
  }
}

function addBookkeepingSibling() {
  if (document.querySelector('[data-expenses-bookkeeping-link]')) return;
  const header = document.querySelector('.page-header, .page-head');
  if (!header) return;
  const actions = header.querySelector('.page-actions, .page-header-actions') || header.lastElementChild;
  if (!(actions instanceof HTMLElement)) return;
  const link = document.createElement('a');
  link.href = '/bookkeeping';
  link.className = 'btn';
  link.textContent = 'Bookkeeping';
  link.dataset.expensesBookkeepingLink = 'true';
  actions.prepend(link);
}

export function JobFinanceWordingAndCustomerRate() {
  const pathname = usePathname();

  useEffect(() => {
    /* /jobs/new is a controlled React form. Runtime DOM mutation here was
       competing with React and breaking fields/buttons, so it is intentionally
       excluded. Keep this legacy enhancer limited to Expenses. */
    if (pathname !== '/expenses') return;

    const apply = () => {
      const root = document.querySelector('.finance-page, main') || document.body;
      replaceWorkerWording(root);
      addBookkeepingSibling();
    };

    apply();
    const target = document.querySelector('.finance-page, main') || document.body;
    const observer = new MutationObserver(apply);
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
