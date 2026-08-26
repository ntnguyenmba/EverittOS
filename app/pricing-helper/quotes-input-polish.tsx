'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function inputValue(root: Element, selectors: string[]) {
  for (const selector of selectors) {
    const element = root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector);
    if (element?.value?.trim()) return element.value.trim();
  }
  return '';
}

function labelValue(root: Element, labelText: string) {
  const labels = Array.from(root.querySelectorAll('label'));
  const label = labels.find((item) => item.textContent?.toLowerCase().includes(labelText.toLowerCase()));
  const control = label?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea');
  return control?.value?.trim() || '';
}

export function QuotesInputPolish() {
  const router = useRouter();

  useEffect(() => {
    const root = document.querySelector('.pricing-helper-layout');
    if (!root) return;

    const handleFocus = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== 'number') return;
      if (target.value === '0') requestAnimationFrame(() => target.select());
    };

    const summary = root.querySelector('.pricing-helper-summary');
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'btn btn-primary quotes-create-job-action';
    action.textContent = 'Create job with this quote';
    action.setAttribute('aria-label', 'Create job using this quote');

    const handleCreateJob = () => {
      const service =
        inputValue(root, ['[name="service"]', '[name="serviceType"]', '#service', '#service-type']) ||
        labelValue(root, 'service');
      const price =
        inputValue(root, ['[name="finalPrice"]', '[name="price"]', '#final-price', '#try-price']) ||
        labelValue(root, 'final price') ||
        labelValue(root, 'try a price');
      const notes = [
        service ? `Service: ${service}` : '',
        price ? `Quoted price: ${price}` : '',
        'Created from Quotes.'
      ].filter(Boolean).join('\n');

      const params = new URLSearchParams();
      if (service) params.set('title', service);
      if (price) params.set('client_income', price.replace(/[^0-9.-]/g, ''));
      if (notes) params.set('notes', notes);
      params.set('source', 'quotes');
      router.push(`/jobs/new?${params.toString()}`);
    };

    action.addEventListener('click', handleCreateJob);
    if (summary && !summary.querySelector('.quotes-create-job-action')) summary.appendChild(action);
    root.addEventListener('focusin', handleFocus);

    return () => {
      root.removeEventListener('focusin', handleFocus);
      action.removeEventListener('click', handleCreateJob);
      action.remove();
    };
  }, [router]);

  return null;
}
