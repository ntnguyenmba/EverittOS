'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

type Control = HTMLInputElement | HTMLTextAreaElement;

function setReactValue(control: Control, value: string) {
  const prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function controlForLabel(root: ParentNode, phrases: string[]) {
  const labels = Array.from(root.querySelectorAll('label'));
  for (const label of labels) {
    const text = (label.textContent || '').trim().toLowerCase();
    if (!phrases.some((phrase) => text.includes(phrase))) continue;
    const nested = label.querySelector<Control>('input:not([type="hidden"]), textarea');
    if (nested) return nested;
    const htmlFor = label.getAttribute('for');
    if (htmlFor) {
      const linked = document.getElementById(htmlFor);
      if (linked instanceof HTMLInputElement || linked instanceof HTMLTextAreaElement) return linked;
    }
  }
  return null;
}

function normalizeDatePrefill(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const isoDate = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (isoDate) return isoDate;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function JobPrefillBridge() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const source = searchParams.get('source');
    if (source !== 'quotes' && source !== 'assistant') return;

    const title = searchParams.get('title') || searchParams.get('service') || '';
    const notes = searchParams.get('notes') || searchParams.get('scope') || '';
    const clientIncome = searchParams.get('client_income') || searchParams.get('price') || '';
    const customerName = searchParams.get('customer_name') || '';
    const jobDate = normalizeDatePrefill(searchParams.get('job_date') || '');
    if (!title && !notes && !clientIncome && !customerName && !jobDate) return;

    let attempts = 0;
    const apply = () => {
      attempts += 1;
      const root = document.querySelector('.unified-job-form') || document;
      const titleControl = controlForLabel(root, ['job title', 'title', 'service', 'título', 'servicio', 'tiêu đề', 'dịch vụ']);
      const notesControl = controlForLabel(root, ['notes', 'scope', 'notas', 'alcance', 'ghi chú', 'phạm vi']);
      const incomeControl = controlForLabel(root, ['client income', 'customer price', 'revenue', 'ingreso', 'precio', 'doanh thu', 'giá khách']);
      const customerControl = controlForLabel(root, ['customer name', 'nombre del cliente', 'tên khách hàng']);
      const dateControl = controlForLabel(root, ['start date', 'job date', 'service date', 'fecha de inicio', 'fecha del trabajo', 'ngày bắt đầu', 'ngày làm việc']);

      if (title && titleControl && !titleControl.value) setReactValue(titleControl, title);
      if (notes && notesControl && !notesControl.value) setReactValue(notesControl, notes);
      if (clientIncome && incomeControl && !incomeControl.value) setReactValue(incomeControl, clientIncome.replace(/[^0-9.-]/g, ''));
      if (customerName && customerControl && !customerControl.value) setReactValue(customerControl, customerName);
      if (jobDate && dateControl && !dateControl.value) setReactValue(dateControl, jobDate);

      const complete =
        (!title || Boolean(titleControl)) &&
        (!notes || Boolean(notesControl)) &&
        (!clientIncome || Boolean(incomeControl)) &&
        (!customerName || Boolean(customerControl)) &&
        (!jobDate || Boolean(dateControl));
      if (!complete && attempts < 20) window.setTimeout(apply, 120);
    };

    apply();
  }, [searchParams]);

  return null;
}
