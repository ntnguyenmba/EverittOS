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
        .jobs-list-page {
          min-width: 0;
          overflow-x: hidden;
        }

        .jobs-header-actions {
          width: 100%;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr);
          gap: 8px !important;
        }

        .jobs-header-actions .btn,
        .jobs-header-actions > * {
          width: 100%;
          min-width: 0;
        }

        .jobs-filter-tabs {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px !important;
        }

        .jobs-filter-tab {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          white-space: normal;
        }

        .jobs-advanced-filters .jobs-filter-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }

        .jobs-table-card {
          padding: 0 !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        .jobs-mobile-table-wrap {
          overflow: visible !important;
        }

        .jobs-mobile-table,
        .jobs-mobile-table tbody,
        .jobs-mobile-table tr,
        .jobs-mobile-table td {
          display: block;
          width: 100%;
          box-sizing: border-box;
        }

        .jobs-mobile-table thead {
          display: none;
        }

        .jobs-mobile-table tbody {
          display: grid;
          gap: 12px;
        }

        .jobs-mobile-table .jobs-operations-row {
          position: relative;
          padding: 15px;
          border: 1px solid rgba(37, 54, 74, 0.13);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 6px 18px rgba(37, 54, 74, 0.055);
          overflow: hidden;
        }

        .jobs-mobile-table .jobs-operations-row td {
          min-height: 0;
          padding: 6px 0 !important;
          border: 0 !important;
          text-align: left !important;
        }

        .jobs-mobile-table .jobs-col-date {
          padding-top: 0 !important;
          padding-right: 42px !important;
        }

        .jobs-mobile-table .jobs-col-date strong {
          display: block;
          font-size: 15px;
          line-height: 1.25;
        }

        .jobs-mobile-table .jobs-row-time,
        .jobs-mobile-table .jobs-secondary {
          display: block;
          margin-top: 3px;
          color: #66727c;
          font-size: 12px;
          line-height: 1.35;
        }

        .jobs-mobile-table .jobs-col-property {
          padding-top: 8px !important;
        }

        .jobs-mobile-table .jobs-property-link {
          display: block;
          font-size: 16px;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .jobs-next-action-hint {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(37, 54, 74, 0.1);
          color: #3f586a;
          font-size: 12px;
        }

        .jobs-mobile-table .jobs-col-assigned,
        .jobs-mobile-table .jobs-col-money,
        .jobs-mobile-table .jobs-col-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-block: 7px !important;
          border-top: 1px solid rgba(37, 54, 74, 0.08) !important;
        }

        .jobs-mobile-table .jobs-col-assigned::before,
        .jobs-mobile-table .jobs-col-status::before,
        .jobs-mobile-table .jobs-col-money .jobs-money-label {
          flex: 0 1 auto;
          color: #66727c;
          font-size: 12px;
          font-weight: 600;
        }

        .jobs-mobile-table .jobs-col-assigned::before {
          content: attr(data-label);
        }

        .jobs-mobile-table .jobs-col-status::before {
          content: attr(data-label);
        }

        .jobs-mobile-table .jobs-money-label {
          display: inline !important;
        }

        .jobs-mobile-table .jobs-money-value,
        .jobs-mobile-table .jobs-col-assigned > span,
        .jobs-mobile-table .jobs-col-status > * {
          margin-left: auto;
          text-align: right;
          font-weight: 700;
        }

        .jobs-mobile-table .jobs-col-actions {
          position: absolute;
          top: 10px;
          right: 10px;
          width: auto;
          padding: 0 !important;
        }

        .jobs-menu-trigger {
          min-width: 38px;
          min-height: 38px;
        }

        .jobs-more-panel {
          right: 0 !important;
          left: auto !important;
          min-width: 180px;
        }

        .jobs-list-more {
          width: 100%;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr);
          gap: 8px !important;
          margin-top: 12px !important;
        }

        .jobs-list-more .btn {
          width: 100%;
          min-height: 48px;
        }
      }

      @media (max-width: 380px) {
        .jobs-filter-tabs {
          grid-template-columns: minmax(0, 1fr);
        }

        .jobs-mobile-table .jobs-operations-row {
          padding: 13px;
        }
      }
    `}</style>
  );
}
