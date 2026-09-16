'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/components/locale-provider';

const DEFAULT_VISIBLE_COUNT = 3;
let nextCompactListId = 1;
let nextSecondarySectionId = 1;

const labels = {
  en: {
    showAll: (count: number) => `Show all ${count}`,
    showLess: 'Show less',
    openSection: 'Show section',
    closeSection: 'Hide section'
  },
  es: {
    showAll: (count: number) => `Mostrar los ${count}`,
    showLess: 'Mostrar menos',
    openSection: 'Mostrar sección',
    closeSection: 'Ocultar sección'
  },
  vi: {
    showAll: (count: number) => `Hiển thị tất cả ${count}`,
    showLess: 'Thu gọn',
    openSection: 'Hiển thị mục',
    closeSection: 'Thu gọn mục'
  }
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

const secondarySelector = [
  '[data-secondary-section]',
  'section',
  '[class*="history"]',
  '[class*="History"]',
  '[class*="activity"]',
  '[class*="Activity"]',
  '[class*="completed"]',
  '[class*="Completed"]',
  '[class*="archive"]',
  '[class*="Archive"]',
  '[class*="older"]',
  '[class*="Older"]'
].join(',');

const blockedClassPattern = /(nav|menu|filter|tabs?|toolbar|button|metrics?|stats?|summary|kpi|quick|header|footer|form|fields?|plans?|pricing|pagination|controls?)/i;
const recordClassPattern = /(list|feed|history|rows)/i;
const secondaryClassPattern = /(history|activity|completed|archive|older)/i;
const secondaryHeadingPattern = /^(history|activity|recent activity|completed|completed jobs|completed work|older records|older items|archive|archived|past activity|job history|customer history)$/i;

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

function directHeading(element: HTMLElement) {
  for (const child of directChildren(element)) {
    if (/^H[2-4]$/.test(child.tagName)) return child;
    const heading = child.querySelector<HTMLElement>(':scope > h2, :scope > h3, :scope > h4');
    if (heading) return child;
  }
  return null;
}

function secondarySectionTitle(element: HTMLElement) {
  const headingContainer = directHeading(element);
  const heading = headingContainer?.matches('h2,h3,h4')
    ? headingContainer
    : headingContainer?.querySelector<HTMLElement>('h2,h3,h4');
  return String(heading?.textContent || '').trim().replace(/\s+/g, ' ');
}

function isSecondarySection(element: HTMLElement) {
  if (element.closest('[data-no-collapse]')) return false;
  if (element.hasAttribute('data-secondary-section')) return true;
  if (element.matches('form') || element.querySelector('form, input, textarea, select, [contenteditable="true"]')) return false;
  const classText = String(element.className || '');
  const title = secondarySectionTitle(element);
  if (!directHeading(element)) return false;
  return secondaryClassPattern.test(classText) || secondaryHeadingPattern.test(title);
}

export function CompactRecordLists() {
  const { locale } = useTranslation();
  const copy = labels[locale];

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.app-page-stage');
    if (!root) return;

    const managedLists = new Set<HTMLElement>();
    const managedSections = new Set<HTMLElement>();
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
        managedLists.add(element);
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
      managedLists.add(element);
    }

    function updateSecondarySection(element: HTMLElement) {
      if (!isSecondarySection(element)) return;

      const children = directChildren(element);
      const heading = directHeading(element);
      if (!heading || children.length < 2) return;

      let id = element.dataset.secondarySectionId;
      if (!id) {
        id = `secondary-section-${nextSecondarySectionId++}`;
        element.dataset.secondarySectionId = id;
      }

      const expanded = element.dataset.secondaryExpanded === 'true';
      children.forEach((child) => {
        if (child === heading || child.dataset.secondarySectionControl === id) return;
        child.hidden = !expanded;
      });

      let button = element.querySelector<HTMLButtonElement>(`:scope > [data-secondary-section-control="${id}"]`);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'app-secondary-disclosure';
        button.dataset.secondarySectionControl = id;
        button.addEventListener('click', () => {
          element.dataset.secondaryExpanded = element.dataset.secondaryExpanded === 'true' ? 'false' : 'true';
          updateSecondarySection(element);
        });
        heading.insertAdjacentElement('afterend', button);
        controls.add(button);
      }

      button.setAttribute('aria-expanded', String(expanded));
      button.textContent = expanded ? copy.closeSection : copy.openSection;
      managedSections.add(element);
    }

    function scan() {
      root.querySelectorAll<HTMLElement>(candidateSelector).forEach(updateList);
      root.querySelectorAll<HTMLElement>(secondarySelector).forEach(updateSecondarySection);
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
      managedLists.forEach((element) => directChildren(element).forEach((child) => { child.hidden = false; }));
      managedSections.forEach((element) => directChildren(element).forEach((child) => { child.hidden = false; }));
      controls.forEach((button) => button.remove());
    };
  }, [copy]);

  return (
    <style jsx global>{`
      .app-list-disclosure,
      .app-secondary-disclosure {
        width: 100%;
        min-height: 42px;
        margin: 9px 0 2px;
        padding: 9px 13px;
        border: 1px solid rgba(36, 63, 83, .18);
        border-radius: 11px;
        background: rgba(255, 255, 255, .97);
        color: #243f53;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.25;
        text-align: center;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(19, 36, 51, .06);
      }
      .app-secondary-disclosure {
        width: auto;
        min-width: 118px;
        min-height: 36px;
        margin: 6px 0 2px;
        padding: 7px 11px;
        font-size: 12px;
      }
      .app-list-disclosure:hover,
      .app-list-disclosure:focus-visible,
      .app-secondary-disclosure:hover,
      .app-secondary-disclosure:focus-visible {
        background: #eef3f5;
        color: #132433;
        border-color: rgba(36, 63, 83, .32);
      }
      .app-list-disclosure:focus-visible,
      .app-secondary-disclosure:focus-visible {
        outline: 2px solid #285d78;
        outline-offset: 2px;
      }
      @media (max-width: 760px) {
        .app-list-disclosure {
          min-height: 44px;
          margin-top: 8px;
          border-radius: 10px;
        }
        .app-secondary-disclosure {
          min-height: 38px;
          margin-top: 6px;
        }
      }
    `}</style>
  );
}
