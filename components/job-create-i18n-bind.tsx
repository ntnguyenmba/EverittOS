'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { getJobCreateCopy } from '@/lib/i18n/job-create-copy';

export function JobCreateI18nBind() {
  const pathname = usePathname();
  const { locale } = useTranslation();
  const copy = getJobCreateCopy(locale);

  useEffect(() => {
    if (!pathname?.includes('/jobs/new')) return;
    if (copy.jobDetailsHeading === '3. Job details') return;

    const exact: Record<string, string> = {
      '3. Job details': copy.jobDetailsHeading,
      'Job title *': copy.jobTitle,
      'Example: Move-out cleaning': copy.jobTitlePlaceholder,
      Date: copy.date,
      '5. Customer price': copy.customerPriceHeading,
      'This is what the customer will pay for this job.': copy.customerPriceHelp,
      'Customer price': copy.customerPrice,
      '6. Worker': copy.workerHeading,
      'Assign worker': copy.assignWorker,
      Unassigned: copy.unassigned,
      'Worker price': copy.workerPrice,
      'This is what you will pay the worker for this job.': copy.workerPriceHelp,
      'Flat rate': copy.flatRate,
      Hourly: copy.hourly,
      Hours: copy.hours,
      'Worker hourly rate': copy.workerHourlyRate,
      'Job notes': copy.jobNotes,
      'More options': copy.moreOptions,
      'Add one or more visits. Times use the job timezone below.': copy.visitsHelp,
      'Job timezone': copy.jobTimezone,
      'Use company default': copy.companyDefaultTimezone,
      'Filled from the property address when available. You can change it.': copy.timezoneHelp,
      'Visit notes': copy.visitNotes,
      'Add another visit': copy.addVisit,
      'Additional expected expenses': copy.additionalExpenses,
      'Expense description (optional)': copy.expenseDescription,
      'Supplies, parking, travel…': copy.expensePlaceholder,
      'Supplies, parking, travel...': copy.expensePlaceholder,
      'Worker pay notes (optional)': copy.workerPayNotes,
      'Additional expenses': copy.additionalExpenses,
      'Expected profit': copy.expectedProfit,
      'Expected profit = Customer price − Worker price − Additional expected expenses': copy.profitFormula,
      'Expected profit = Customer price - Worker price - Additional expected expenses': copy.profitFormula,
      'Initial photos': copy.initialPhotos,
      'Optional before photos. You can edit or add more photos after the job is created.': copy.initialPhotosHelp,
      '7. Review before saving': copy.reviewHeading,
      'One-time job': copy.oneTimeJob,
      'Recurring series': copy.recurringSeries,
      'Create Job': copy.createJob,
      'Create job': copy.pageTitle
    };

    const applyNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const raw = node.textContent || '';
        const trimmed = raw.trim();
        if (!trimmed) return;
        if (exact[trimmed] && exact[trimmed] !== trimmed) {
          node.textContent = raw.replace(trimmed, exact[trimmed]);
          return;
        }
        if (trimmed.startsWith('Worker cost:')) {
          node.textContent = raw.replace('Worker cost:', `${copy.workerCost}:`);
          return;
        }
        if (trimmed.startsWith('Per visit:')) {
          node.textContent = raw
            .replace('Per visit:', `${copy.perVisit}:`)
            .replace('customer price', copy.customerPrice)
            .replace('worker price', copy.workerPrice)
            .replace('expenses', copy.additionalExpenses)
            .replace('expected profit', copy.expectedProfit);
        }
        return;
      }
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
        const placeholder = node.placeholder?.trim();
        if (placeholder && exact[placeholder]) node.placeholder = exact[placeholder];
      }
      node.childNodes.forEach(applyNode);
    };

    const apply = () => {
      const roots = document.querySelectorAll('.unified-job-form, .job-create-page-header, .formWrap, .card');
      if (roots.length) roots.forEach((root) => applyNode(root));
      else applyNode(document.body);
    };

    apply();
    const interval = window.setInterval(apply, 200);
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, [copy, locale, pathname]);

  return null;
}
