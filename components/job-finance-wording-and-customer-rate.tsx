'use client';

import { useEffect } from 'react';

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function findLabel(root: ParentNode, text: string) {
  return Array.from(root.querySelectorAll('label')).find((label) => label.textContent?.trim() === text) || null;
}

export function JobFinanceWordingAndCustomerRate() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const apply = () => {
      if (!window.location.pathname.includes('/jobs/new')) return;
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
      flatButton.type = 'button';
      flatButton.className = 'btn btn-primary';
      flatButton.textContent = 'Flat rate';

      const hourlyButton = document.createElement('button');
      hourlyButton.type = 'button';
      hourlyButton.className = 'btn';
      hourlyButton.textContent = 'Hourly';

      controls.append(flatButton, hourlyButton);
      modeWrap.append(modeLabel, controls);
      customerLabel.before(modeWrap);

      const hourlyFields = document.createElement('div');
      hourlyFields.className = 'grid-2';
      hourlyFields.style.display = 'none';
      hourlyFields.style.marginTop = '10px';

      const hoursGroup = document.createElement('div');
      hoursGroup.className = 'form-group';
      const hoursLabel = document.createElement('label');
      hoursLabel.textContent = 'Customer hours';
      const hoursInput = document.createElement('input');
      hoursInput.className = 'input';
      hoursInput.type = 'number';
      hoursInput.min = '0';
      hoursInput.step = '0.25';

      const rateGroup = document.createElement('div');
      rateGroup.className = 'form-group';
      const rateLabel = document.createElement('label');
      rateLabel.textContent = 'Customer hourly rate';
      const rateInput = document.createElement('input');
      rateInput.className = 'input';
      rateInput.type = 'number';
      rateInput.min = '0';
      rateInput.step = '0.01';

      hoursGroup.append(hoursLabel, hoursInput);
      rateGroup.append(rateLabel, rateInput);
      hourlyFields.append(hoursGroup, rateGroup);
      customerInput.after(hourlyFields);

      let customerMode: 'flat' | 'hourly' = 'flat';

      const updateCustomerTotal = () => {
        if (customerMode !== 'hourly') return;
        const hours = Number(hoursInput.value || 0);
        const rate = Number(rateInput.value || 0);
        const total = Math.round((hours * rate + Number.EPSILON) * 100) / 100;
        setReactInputValue(customerInput, total ? total.toFixed(2) : '0');
      };

      const setMode = (mode: 'flat' | 'hourly') => {
        customerMode = mode;
        const hourly = mode === 'hourly';
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
        ['How the contractor is paid', 'Worker pay type'],
        ['Contractor hourly rate', 'Worker hourly rate'],
        ['Calculated contractor pay', 'Calculated worker pay'],
        ['What the contractor earns', 'Worker earns'],
        ['Contractor pay notes (optional)', 'Worker pay notes (optional)'],
        ['Contractor pay', 'Worker pay']
      ]);

      for (const label of Array.from(form.querySelectorAll('label'))) {
        const replacement = wording.get(label.textContent?.trim() || '');
        if (replacement) label.textContent = replacement;
      }
      for (const element of Array.from(form.querySelectorAll('.finance-metric-label'))) {
        const replacement = wording.get(element.textContent?.trim() || '');
        if (replacement) element.textContent = replacement;
      }

      const sectionHeading = Array.from(form.querySelectorAll('h4')).find((heading) => heading.textContent?.trim() === '5. Contractor');
      if (sectionHeading) sectionHeading.textContent = '5. Worker';
      const assignLabel = findLabel(form, 'Assign contractor');
      if (assignLabel) assignLabel.textContent = 'Assign worker';

      cleanup = () => {
        flatButton.replaceWith(flatButton.cloneNode(true));
        hourlyButton.replaceWith(hourlyButton.cloneNode(true));
        hoursInput.replaceWith(hoursInput.cloneNode(true));
        rateInput.replaceWith(rateInput.cloneNode(true));
      };
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', apply);

    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', apply);
      cleanup?.();
    };
  }, []);

  return null;
}
