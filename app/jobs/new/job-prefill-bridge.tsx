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

export function JobPrefillBridge() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('source') !== 'quotes') return;

    const title = searchParams.get('title') || '';
    const notes = searchParams.get('notes') || '';
    const clientIncome = searchParams.get('client_income') || '';
    if (!title && !notes && !clientIncome) return;

    let attempts = 0;
    const apply = () => {
      attempts += 1;
      const root = document.querySelector('.unified-job-form') || document;
      const titleControl = controlForLabel(root, ['job title', 'title', 'título', 'tiêu đề']);
      const notesControl = controlForLabel(root, ['notes', 'notas', 'ghi chú']);
      const incomeControl = controlForLabel(root, ['client income', 'customer price', 'revenue', 'ingreso', 'precio', 'doanh thu', 'giá khách']);

      if (title && titleControl && !titleControl.value) setReactValue(titleControl, title);
      if (notes && notesControl && !notesControl.value) setReactValue(notesControl, notes);
      if (clientIncome && incomeControl && !incomeControl.value) setReactValue(incomeControl, clientIncome);

      const complete = (!title || Boolean(titleControl)) && (!notes || Boolean(notesControl)) && (!clientIncome || Boolean(incomeControl));
      if (!complete && attempts < 20) window.setTimeout(apply, 120);
    };

    apply();
  }, [searchParams]);

  return null;
}
