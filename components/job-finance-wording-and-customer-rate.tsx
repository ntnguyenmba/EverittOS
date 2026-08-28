'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function findLabel(root: ParentNode, text: string) {
  return Array.from(root.querySelectorAll('label')).find((label) => label.textContent?.trim() === text) || null;
}

function replaceWorkerWording(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (current instanceof Text) nodes.push(current);
    current = walker.nextNode();
  }
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style, code, pre')) continue;
    const value = node.nodeValue || '';
    const next = value
      .replace(/Contractors/g, 'Workers')
      .replace(/Contractor/g, 'Worker')
      .replace(/contractors/g, 'workers')
      .replace(/contractor/g, 'worker');
    if (next !== value) node.nodeValue = next;
  }
}

function addBookkeepingSibling() {
  if (document.querySelector('[data-expenses-bookkeeping-link]')) return;
  const header = document.querySelector('.page-header, .page-head');
  if (!header) return;
  const actions = header.querySelector('.page-actions, .page-header-actions') || header.lastElementChild;
  if (!(actions instanceof HTMLElement)) return;
  const link = document.createElement('a');
  link.href = '/bookkeeping';
  link.className = 'btn';
  link.textContent = 'Bookkeeping';
  link.dataset.expensesBookkeepingLink = 'true';
  actions.prepend(link);
}

export function JobFinanceWordingAndCustomerRate() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/expenses' && pathname !== '/jobs/new') return;

    const apply = () => {
      const root = pathname === '/jobs/new'
        ? document.querySelector('.unified-job-form') || document.body
        : document.querySelector('.finance-page, main') || document.body;
      replaceWorkerWording(root);
      if (pathname === '/expenses') addBookkeepingSibling();
    };

    apply();
    const observer = new MutationObserver(apply);
    const target = pathname === '/jobs/new'
      ? document.querySelector('.unified-job-form') || document.body
      : document.querySelector('.finance-page, main') || document.body;
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/jobs/new') return;
    let cleanup: (() => void) | undefined;

    const apply = () => {
      const form = document.querySelector('.unified-job-form');
      if (!form || form.querySelector('[data-customer-price-mode]')) return;

      const customerLabel = findLabel(form, 'What the customer pays');
      const customerInput = customerLabel?.nextElementSibling;
      if (!(customerLabel instanceof HTMLLabelElement) || !(customerInput instanceof HTMLInputElement)) return;
      customerLabel.textContent = 'Customer price';

      const modeWrap = document.createElement('div');
      modeWrap.dataset.customerPriceMode = 'true';
      modeWrap.style.marginTop = '12px';
      const modeLabel = document.createElement('label');
      modeLabel.textContent = 'Customer price type';
      const controls = document.createElement('div');
      controls.className = 'segmented-control';
      controls.setAttribute('role', 'group');
      controls.setAttribute('aria-label', 'Customer price type');
      controls.style.marginTop = '8px';
      const flatButton = document.createElement('button');
      flatButton.type = 'button'; flatButton.className = 'btn btn-primary'; flatButton.textContent = 'Flat rate';
      const hourlyButton = document.createElement('button');
      hourlyButton.type = 'button'; hourlyButton.className = 'btn'; hourlyButton.textContent = 'Hourly';
      controls.append(flatButton, hourlyButton); modeWrap.append(modeLabel, controls); customerLabel.before(modeWrap);

      const hourlyFields = document.createElement('div');
      hourlyFields.className = 'grid-2'; hourlyFields.style.display = 'none'; hourlyFields.style.marginTop = '10px';
      const hoursGroup = document.createElement('div'); hoursGroup.className = 'form-group';
      const hoursLabel = document.createElement('label'); hoursLabel.textContent = 'Customer hours';
      const hoursInput = document.createElement('input'); hoursInput.className = 'input'; hoursInput.type = 'number'; hoursInput.min = '0'; hoursInput.step = '0.25';
      const rateGroup = document.createElement('div'); rateGroup.className = 'form-group';
      const rateLabel = document.createElement('label'); rateLabel.textContent = 'Customer hourly rate';
      const rateInput = document.createElement('input'); rateInput.className = 'input'; rateInput.type = 'number'; rateInput.min = '0'; rateInput.step = '0.01';
      hoursGroup.append(hoursLabel, hoursInput); rateGroup.append(rateLabel, rateInput); hourlyFields.append(hoursGroup, rateGroup); customerInput.after(hourlyFields);

      let customerMode: 'flat' | 'hourly' = 'flat';
      const updateCustomerTotal = () => {
        if (customerMode !== 'hourly') return;
        const hours = Number(hoursInput.value || 0); const rate = Number(rateInput.value || 0);
        const total = Math.round((hours * rate + Number.EPSILON) * 100) / 100;
        setReactInputValue(customerInput, total ? total.toFixed(2) : '0');
      };
      const setMode = (mode: 'flat' | 'hourly') => {
        customerMode = mode; const hourly = mode === 'hourly';
        flatButton.className = `btn${hourly ? '' : ' btn-primary'}`;
        hourlyButton.className = `btn${hourly ? ' btn-primary' : ''}`;
        hourlyFields.style.display = hourly ? '' : 'none';
        customerLabel.textContent = hourly ? 'Customer total' : 'Customer price';
        customerInput.readOnly = hourly;
        if (hourly) updateCustomerTotal();
      };
      flatButton.addEventListener('click', () => setMode('flat'));
      hourlyButton.addEventListener('click', () => setMode('hourly'));
      hoursInput.addEventListener('input', updateCustomerTotal);
      rateInput.addEventListener('input', updateCustomerTotal);

      const wording = new Map([
        ['How the contractor is paid', 'Worker pay type'], ['Contractor hourly rate', 'Worker hourly rate'],
        ['Calculated contractor pay', 'Calculated worker pay'], ['What the contractor earns', 'Worker earns'],
        ['Contractor pay notes (optional)', 'Worker pay notes (optional)'], ['Contractor pay', 'Worker pay']
      ]);
      for (const label of Array.from(form.querySelectorAll('label'))) { const replacement = wording.get(label.textContent?.trim() || ''); if (replacement) label.textContent = replacement; }
      for (const element of Array.from(form.querySelectorAll('.finance-metric-label'))) { const replacement = wording.get(element.textContent?.trim() || ''); if (replacement) element.textContent = replacement; }
      const sectionHeading = Array.from(form.querySelectorAll('h4')).find((heading) => heading.textContent?.trim() === '5. Contractor'); if (sectionHeading) sectionHeading.textContent = '5. Worker';
      const assignLabel = findLabel(form, 'Assign contractor'); if (assignLabel) assignLabel.textContent = 'Assign worker';

      cleanup = () => undefined;
    };

    apply();
    const target = document.querySelector('.unified-job-form') || document.body;
    const observer = new MutationObserver(apply);
    observer.observe(target, { childList: true, subtree: true });
    return () => { observer.disconnect(); cleanup?.(); };
  }, [pathname]);

  return null;
}
