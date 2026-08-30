'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { getJobCreateCopy } from '@/lib/i18n/job-create-copy';

const MAP: Array<[string, keyof ReturnType<typeof getJobCreateCopy>]> = [
  ['3. Job details', 'jobDetailsHeading'],
  ['Job title *', 'jobTitle'],
  ['Example: Move-out cleaning', 'jobTitlePlaceholder'],
  ['5. Customer price', 'customerPriceHeading'],
  ['This is what the customer will pay for this job.', 'customerPriceHelp'],
  ['Customer price', 'customerPrice'],
  ['6. Worker', 'workerHeading'],
  ['Assign worker', 'assignWorker'],
  ['Unassigned', 'unassigned'],
  ['Worker price', 'workerPrice'],
  ['This is what you will pay the worker for this job.', 'workerPriceHelp'],
  ['Flat rate', 'flatRate'],
  ['Hourly', 'hourly'],
  ['Hours', 'hours'],
  ['Worker hourly rate', 'workerHourlyRate'],
  ['Job notes', 'jobNotes'],
  ['More options', 'moreOptions'],
  ['Add one or more visits. Times use the job timezone below.', 'visitsHelp'],
  ['Job timezone', 'jobTimezone'],
  ['Use company default', 'companyDefaultTimezone'],
  ['Filled from the property address when available. You can change it.', 'timezoneHelp'],
  ['Visit notes', 'visitNotes'],
  ['Add another visit', 'addVisit'],
  ['Additional expected expenses', 'additionalExpenses'],
  ['Expense description (optional)', 'expenseDescription'],
  ['Supplies, parking, travel…', 'expensePlaceholder'],
  ['Worker pay notes (optional)', 'workerPayNotes'],
  ['Additional expenses', 'additionalExpenses'],
  ['Expected profit', 'expectedProfit'],
  ['Expected profit = Customer price − Worker price − Additional expected expenses', 'profitFormula'],
  ['Initial photos', 'initialPhotos'],
  ['Optional before photos. You can edit or add more photos after the job is created.', 'initialPhotosHelp'],
  ['7. Review before saving', 'reviewHeading'],
  ['One-time job', 'oneTimeJob'],
  ['Create Job', 'createJob']
];

export function JobCreateI18nBind() {
  const pathname = usePathname();
  const { locale } = useTranslation();
  const copy = getJobCreateCopy(locale);

  useEffect(() => {
    if (pathname !== '/jobs/new') return;
    const root = document.querySelector('.unified-job-form');
    if (!root) return;

    const apply = () => {
      root.querySelectorAll('h3, h4, label, p, summary, button, option, span').forEach((node) => {
        const text = node.textContent?.trim() || '';
        const match = MAP.find(([en]) => en === text);
        if (match) node.textContent = copy[match[1]];
      });
      root.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((node) => {
        const input = node as HTMLInputElement;
        const match = MAP.find(([en]) => en === input.placeholder);
        if (match) input.placeholder = String(copy[match[1]]);
      });
      const dateLabel = root.querySelector('label[for="recurrence-starts-on"]');
      if (dateLabel && dateLabel.textContent?.trim() === 'Date') dateLabel.textContent = copy.date;
    };

    apply();
    const timer = window.setTimeout(apply, 50);
    return () => window.clearTimeout(timer);
  }, [copy, pathname]);

  return null;
}
