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

function applyLimit(parent: HTMLElement) {
  const items = getDirectItems(parent);
  const anchor = controlAnchor(parent);
  const existingId = parent.dataset.universalListId;
  let control = existingId
    ? document.querySelector<HTMLElement>(`[data-universal-list-control="${existingId}"]`)
    : null;

  if (items.length <= SUMMARY_LIST_LIMIT) {
    items.forEach((item) => { item.hidden = false; item.removeAttribute('data-universal-list-hidden'); });
    control?.remove();
    return;
  }

  const id = existingId || `universal-list-${++listId}`;
  parent.dataset.universalListId = id;
  const expanded = parent.dataset.universalListExpanded === 'true';

  items.forEach((item, index) => {
    const shouldHide = !expanded && index >= SUMMARY_LIST_LIMIT;
    item.hidden = shouldHide;
    if (shouldHide) item.dataset.universalListHidden = 'true';
    else item.removeAttribute('data-universal-list-hidden');
  });

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
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', schedule);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('popstate', schedule);
    };
  }, []);

  return null;
}
