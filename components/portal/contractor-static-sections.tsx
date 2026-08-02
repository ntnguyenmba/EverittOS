'use client';

import { useEffect } from 'react';

function jobCountLabel(count: number, kind: 'current' | 'past') {
  const noun = count === 1 ? 'job' : 'jobs';
  return `${count} ${kind} ${noun}`;
}

function formatSectionSummary(section: Element | null, title: string, kind: 'current' | 'past') {
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
  subtitle.textContent = jobCountLabel(count, kind);

  if (directCount && directCount !== subtitle) directCount.remove();
  if (nestedCount && nestedCount !== subtitle) nestedCount.remove();
  return true;
}

export function ContractorStaticSections() {
  useEffect(() => {
    let attempts = 0;
    let timer: number | undefined;

    const applyOnce = () => {
      attempts += 1;

      const contractorCurrent = document.querySelector('.contractor-dashboard #current-jobs');
      const contractorPast = document.querySelector('.contractor-dashboard #history');
      const clientCurrent = document.querySelector('.client-portal-jobs #current-jobs');
      const clientPast = document.querySelector('.client-portal-jobs #history');

      const changed = [
        formatSectionSummary(contractorCurrent, 'Current Jobs', 'current'),
        formatSectionSummary(contractorPast, 'Past Jobs', 'past'),
        formatSectionSummary(clientCurrent, 'Current Jobs', 'current'),
        formatSectionSummary(clientPast, 'Past Jobs', 'past')
      ].some(Boolean);

      if (!changed && attempts < 30) {
        timer = window.setTimeout(applyOnce, 100);
      }
    };

    applyOnce();

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
