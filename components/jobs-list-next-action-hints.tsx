'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';

const COPY = {
  en: {
    next: 'Next',
    clientPay: 'Set client pay',
    worker: 'Assign worker',
    workerPay: 'Set worker pay',
    schedule: 'Set schedule',
    open: 'Open job'
  },
  es: {
    next: 'Siguiente',
    clientPay: 'Agregar pago del cliente',
    worker: 'Asignar trabajador',
    workerPay: 'Agregar pago del trabajador',
    schedule: 'Programar trabajo',
    open: 'Abrir trabajo'
  },
  vi: {
    next: 'Tiếp theo',
    clientPay: 'Nhập tiền khách trả',
    worker: 'Giao nhân sự',
    workerPay: 'Nhập tiền trả nhân sự',
    schedule: 'Đặt lịch',
    open: 'Mở công việc'
  }
} as const;

function cellText(row: HTMLTableRowElement, selector: string) {
  return (row.querySelector<HTMLElement>(selector)?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isMissingMoney(value: string) {
  return !value || value.endsWith('—') || value.endsWith('-') || /missing|falta|còn thiếu/.test(value);
}

export function JobsListNextActionHints() {
  const pathname = usePathname();
  const { locale } = useTranslation();
  const c = COPY[locale];

  useEffect(() => {
    if (pathname !== '/jobs') return;

    let queued = false;

    function decorateRows() {
      queued = false;
      const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('.jobs-operations-row'));

      for (const row of rows) {
        const propertyCell = row.querySelector<HTMLElement>('.jobs-col-property');
        if (!propertyCell) continue;

        let hint = propertyCell.querySelector<HTMLElement>('.jobs-next-action-hint');
        if (!hint) {
          hint = document.createElement('div');
          hint.className = 'jobs-next-action-hint';
          propertyCell.appendChild(hint);
        }

        const status = cellText(row, '.jobs-col-status');
        const closed = /completed|finished|cancelled|canceled|finalizado|completado|đã hoàn thành|đã hủy/.test(status);
        const customerPay = cellText(row, '.jobs-col-customer-pay');
        const workerPay = cellText(row, '.jobs-col-contractor-pay');
        const assigned = cellText(row, '.jobs-col-assigned');
        const date = cellText(row, '.jobs-col-date');

        let action = c.open;
        if (!closed && isMissingMoney(customerPay)) action = c.clientPay;
        else if (!closed && /unassigned|sin asignar|chưa phân công|—/.test(assigned)) action = c.worker;
        else if (!closed && isMissingMoney(workerPay)) action = c.workerPay;
        else if (!closed && /unscheduled|sin programar|chưa lên lịch/.test(date)) action = c.schedule;

        hint.textContent = `${c.next}: ${action}`;
        hint.dataset.action = action;
      }
    }

    function scheduleDecorate() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(decorateRows);
    }

    decorateRows();
    const observer = new MutationObserver(scheduleDecorate);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [pathname, locale, c]);

  if (pathname !== '/jobs') return null;

  return (
    <style jsx global>{`
      .jobs-next-action-hint {
        margin-top: 7px;
        color: #52606d;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.3;
      }

      @media (max-width: 720px) {
        .jobs-next-action-hint {
          margin-top: 8px;
          padding-top: 7px;
          border-top: 1px solid rgba(37, 54, 74, 0.1);
          font-size: 12px;
        }
      }
    `}</style>
  );
}
