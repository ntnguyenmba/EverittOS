'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { normalizeLocale, type Locale } from '@/lib/i18n/config';

const SECTION_TITLES: Record<Locale, { current: string; past: string }> = {
  en: { current: 'Current Jobs', past: 'Past Jobs' },
  es: { current: 'Trabajos actuales', past: 'Trabajos anteriores' },
  vi: { current: 'Công việc hiện tại', past: 'Công việc trước đây' }
};

function jobCountLabel(count: number, kind: 'current' | 'past', locale: Locale) {
  if (locale === 'es') {
    const noun = count === 1 ? 'trabajo' : 'trabajos';
    const adj = kind === 'current' ? (count === 1 ? 'actual' : 'actuales') : count === 1 ? 'anterior' : 'anteriores';
    return `${count} ${noun} ${adj}`;
  }
  if (locale === 'vi') {
    return `${count} công việc ${kind === 'current' ? 'hiện tại' : 'trước đây'}`;
  }
  const noun = count === 1 ? 'job' : 'jobs';
  return `${count} ${kind} ${noun}`;
}

function formatSectionSummary(
  section: Element | null,
  title: string,
  kind: 'current' | 'past',
  locale: Locale
) {
  const summary = section?.querySelector('summary');
  const heading = summary?.querySelector('h2');
  if (!summary || !heading) return false;

  const directCount = Array.from(summary.children).find(
    (child) => child instanceof HTMLSpanElement && child.classList.contains('muted')
  );
  const nestedCount = heading.parentElement?.querySelector(':scope > .muted');
  const source = directCount || nestedCount;
  const count = Number.parseInt(String(source?.textContent || '0'), 10) || 0;

  let headingGroup = summary.querySelector<HTMLElement>('.portal-job-section-heading');
  if (!headingGroup) {
    headingGroup = document.createElement('div');
    headingGroup.className = 'portal-job-section-heading';
    summary.insertBefore(headingGroup, summary.firstChild);
    headingGroup.appendChild(heading);
  }

  heading.textContent = title;

  let subtitle = headingGroup.querySelector<HTMLElement>('.portal-job-section-count');
  if (!subtitle) {
    subtitle = document.createElement('span');
    subtitle.className = 'muted portal-job-section-count';
    headingGroup.appendChild(subtitle);
  }
  subtitle.textContent = jobCountLabel(count, kind, locale);

  if (directCount && directCount !== subtitle) directCount.remove();
  if (nestedCount && nestedCount !== subtitle) nestedCount.remove();
  return true;
}

function spaceStatusAndPay() {
  document.querySelectorAll('.portal-job-finance').forEach((row) => {
    if (!(row instanceof HTMLElement)) return;
    if (row.querySelector('.portal-finance-sep')) return;
    const children = Array.from(row.children);
    if (children.length < 2) {
      const glued = String(row.textContent || '');
      const spaced = glued
        .replace(/([a-z])(Your pay)/gi, '$1 · $2')
        .replace(/([a-z])(Pay details)/gi, '$1 · $2')
        .replace(/([a-z])(Tu pago)/gi, '$1 · $2')
        .replace(/([a-zà-ỹ])(Tiền công)/gi, '$1 · $2');
      if (spaced !== glued) row.textContent = spaced;
      return;
    }
    const sep = document.createElement('span');
    sep.className = 'portal-finance-sep';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = ' · ';
    row.insertBefore(sep, children[1]);
    const status = children[0];
    if (status && status.textContent) {
      status.textContent = status.textContent.charAt(0).toUpperCase() + status.textContent.slice(1);
    }
  });
}

export function ContractorStaticSections() {
  const { locale } = useTranslation();
  const normalized = normalizeLocale(locale);
  const titles = SECTION_TITLES[normalized];

  useEffect(() => {
    let attempts = 0;
    let timer: number | undefined;
    let observer: MutationObserver | undefined;

    const applyOnce = () => {
      attempts += 1;

      const contractorCurrent = document.querySelector('.contractor-dashboard #current-jobs');
      const contractorPast = document.querySelector('.contractor-dashboard #history');
      const clientCurrent = document.querySelector('.client-portal-jobs #current-jobs');
      const clientPast = document.querySelector('.client-portal-jobs #history');

      formatSectionSummary(contractorCurrent, titles.current, 'current', normalized);
      formatSectionSummary(contractorPast, titles.past, 'past', normalized);
      formatSectionSummary(clientCurrent, titles.current, 'current', normalized);
      formatSectionSummary(clientPast, titles.past, 'past', normalized);
      spaceStatusAndPay();

      if (attempts < 30) {
        timer = window.setTimeout(applyOnce, 120);
      }
    };

    applyOnce();
    observer = new MutationObserver(() => spaceStatusAndPay());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (timer) window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [normalized, titles.current, titles.past]);

  return null;
}
