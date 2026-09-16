'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/components/locale-provider';

const DEFAULT_VISIBLE_COUNT = 3;
let nextCompactListId = 1;

const labels = {
  en: { showAll: (count: number) => `Show all ${count}`, showLess: 'Show less' },
  es: { showAll: (count: number) => `Mostrar los ${count}`, showLess: 'Mostrar menos' },
  vi: { showAll: (count: number) => `Hiển thị tất cả ${count}`, showLess: 'Thu gọn' }
} as const;

const candidateSelector = [
  'tbody',
  '[data-compact-list]',
  '[class*="list"]',
  '[class*="List"]',
  '[class*="feed"]',
  '[class*="Feed"]',
  '[class*="history"]',
  '[class*="History"]',
  '[class*="rows"]',
  '[class*="Rows"]'
].join(',');

const blockedClassPattern = /(nav|menu|filter|tabs?|toolbar|button|metrics?|stats?|summary|kpi|quick|header|footer|form|fields?|plans?|pricing|pagination|controls?)/i;
const recordClassPattern = /(list|feed|history|rows)/i;

function directChildren(element: HTMLElement) {
  return Array.from(element.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
}

function hasRepeatedStructure(children: HTMLElement[]) {
  if (children.length <= DEFAULT_VISIBLE_COUNT) return false;
  const counts = new Map<string, number>();
  children.forEach((child) => counts.set(child.tagName, (counts.get(child.tagName) || 0) + 1));
  return Math.max(...Array.from(counts.values())) >= DEFAULT_VISIBLE_COUNT;
}

function isCandidate(element: HTMLElement) {
  if (element.closest('[data-no-collapse]')) return false;
  if (element.tagName === 'TBODY') return true;
  if (element.hasAttribute('data-compact-list')) return true;

  const classText = String(element.className || '');
  if (!recordClassPattern.test(classText) || blockedClassPattern.test(classText)) return false;
  return hasRepeatedStructure(directChildren(element));
}

function controlAnchor(element: HTMLElement) {
  if (element.tagName === 'TBODY') return element.closest('table') as HTMLElement | null;
  return element;
}

export function CompactRecordLists() {
  const { locale } = useTranslation();
  const copy = labels[locale];

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.app-page-stage');
    if (!root) return;

    const managed = new Set<HTMLElement>();
    const controls = new Set<HTMLButtonElement>();
    let frame = 0;

    function updateList(element: HTMLElement) {
      if (!isCandidate(element)) return;

      const children = directChildren(element);
      const total = children.length;
      const anchor = controlAnchor(element);
      if (!anchor) return;

      let id = element.dataset.compactRecordId;
      if (!id) {
        id = `compact-records-${nextCompactListId++}`;
        element.dataset.compactRecordId = id;
      }

      let button = root.querySelector<HTMLButtonElement>(`[data-compact-control-for="${id}"]`);

      if (total <= DEFAULT_VISIBLE_COUNT) {
        children.forEach((child) => { child.hidden = false; });
        button?.remove();
        if (button) controls.delete(button);
        managed.add(element);
        return;
      }

      const expanded = element.dataset.compactExpanded === 'true';
      children.forEach((child, index) => { child.hidden = !expanded && index >= DEFAULT_VISIBLE_COUNT; });

      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'app-list-disclosure';
        button.dataset.compactControlFor = id;
        button.addEventListener('click', () => {
          element.dataset.compactExpanded = element.dataset.compactExpanded === 'true' ? 'false' : 'true';
          updateList(element);
        });
        anchor.insertAdjacentElement('afterend', button);
        controls.add(button);
      }

      button.setAttribute('aria-expanded', String(expanded));
      button.textContent = expanded ? copy.showLess : copy.showAll(total);
      managed.add(element);
    }

    function scan() {
      root.querySelectorAll<HTMLElement>(candidateSelector).forEach(updateList);
    }

    function scheduleScan() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        scan();
      });
    }

    scan();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      managed.forEach((element) => directChildren(element).forEach((child) => { child.hidden = false; }));
      controls.forEach((button) => button.remove());
    };
  }, [copy]);

  return (
    <style jsx global>{`
      .app-list-disclosure {
        width: 100%;
        min-height: 44px;
        margin: 10px 0 2px;
        padding: 10px 14px;
        border: 1px solid rgba(36, 63, 83, .20);
        border-radius: 12px;
        background: rgba(255, 255, 255, .97);
        color: #243f53;
        font: inherit;
        font-size: 14px;
        font-weight: 750;
        line-height: 1.25;
        text-align: center;
        cursor: pointer;
        box-shadow: 0 5px 16px rgba(19, 36, 51, .07);
      }
      .app-list-disclosure:hover,
      .app-list-disclosure:focus-visible {
        background: #eef3f5;
        color: #132433;
        border-color: rgba(36, 63, 83, .34);
      }
      .app-list-disclosure:focus-visible {
        outline: 2px solid #285d78;
        outline-offset: 2px;
      }
      @media (max-width: 760px) {
        .app-list-disclosure {
          min-height: 46px;
          margin-top: 8px;
          border-radius: 11px;
        }
      }
    `}</style>
  );
}
