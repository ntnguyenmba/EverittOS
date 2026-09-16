'use client';

import { useEffect } from 'react';
import { SUMMARY_LIST_LIMIT } from '@/lib/list-display';

type Locale = 'en' | 'es' | 'vi';

const labels: Record<Locale, { more: string; less: string }> = {
  en: { more: 'Show more', less: 'Show less' },
  es: { more: 'Mostrar más', less: 'Mostrar menos' },
  vi: { more: 'Xem thêm', less: 'Thu gọn' }
};

const ITEM_SELECTOR = ':scope > .list-row, :scope > tr';
let listId = 0;
const managedParents = new Set<HTMLElement>();

function currentLocale(): Locale {
  const value = document.body.dataset.locale || document.documentElement.lang || 'en';
  return value.startsWith('es') ? 'es' : value.startsWith('vi') ? 'vi' : 'en';
}

function controlAnchor(parent: HTMLElement) {
  if (parent.tagName === 'TBODY') return parent.closest('table')?.parentElement || parent.closest('table') || parent;
  return parent;
}

function getDirectItems(parent: HTMLElement) {
  return Array.from(parent.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
}

function setItemVisible(item: HTMLElement, visible: boolean) {
  if (visible) {
    item.removeAttribute('hidden');
    item.style.removeProperty('display');
    item.removeAttribute('data-universal-list-hidden');
    return;
  }
  item.setAttribute('hidden', '');
  item.style.setProperty('display', 'none', 'important');
  item.dataset.universalListHidden = 'true';
}

function applyLimit(parent: HTMLElement) {
  if (!parent.isConnected) {
    managedParents.delete(parent);
    return;
  }

  const items = getDirectItems(parent);
  const anchor = controlAnchor(parent);
  const existingId = parent.dataset.universalListId;
  let control = existingId
    ? document.querySelector<HTMLElement>(`[data-universal-list-control="${existingId}"]`)
    : null;

  if (items.length <= SUMMARY_LIST_LIMIT) {
    items.forEach((item) => setItemVisible(item, true));
    control?.remove();
    delete parent.dataset.universalListExpanded;
    return;
  }

  managedParents.add(parent);
  const id = existingId || `universal-list-${++listId}`;
  parent.dataset.universalListId = id;
  const expanded = parent.dataset.universalListExpanded === 'true';

  items.forEach((item, index) => setItemVisible(item, expanded || index < SUMMARY_LIST_LIMIT));

  if (!control) {
    control = document.createElement('div');
    control.className = 'universal-list-control';
    control.dataset.universalListControl = id;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn universal-list-button';
    button.addEventListener('click', () => {
      parent.dataset.universalListExpanded = parent.dataset.universalListExpanded === 'true' ? 'false' : 'true';
      applyLimit(parent);
    });
    control.appendChild(button);
    anchor.insertAdjacentElement('afterend', control);
  }

  const button = control.querySelector<HTMLButtonElement>('button');
  if (button) {
    const copy = labels[currentLocale()];
    button.textContent = expanded ? copy.less : `${copy.more} (${items.length - SUMMARY_LIST_LIMIT})`;
    button.setAttribute('aria-expanded', String(expanded));
  }
}

function scan() {
  managedParents.forEach((parent) => {
    if (!parent.isConnected) managedParents.delete(parent);
  });

  const parents = new Set<HTMLElement>();
  document.querySelectorAll<HTMLElement>('.list-row').forEach((item) => {
    if (item.parentElement) parents.add(item.parentElement);
  });
  document.querySelectorAll<HTMLElement>('tbody').forEach((body) => {
    if (body.querySelectorAll(':scope > tr').length > SUMMARY_LIST_LIMIT) parents.add(body);
  });
  parents.forEach(applyLimit);
}

export function UniversalListLimit() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };

    scan();
    const observer = new MutationObserver((mutations) => {
      const hasStructuralChange = mutations.some((mutation) => mutation.type === 'childList');
      if (hasStructuralChange) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', schedule);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('popstate', schedule);
      managedParents.clear();
    };
  }, []);

  return null;
}
