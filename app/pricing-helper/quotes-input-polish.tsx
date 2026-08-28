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

function createLocationField(labelText: string, value: string, placeholder: string, onSave: (value: string) => void) {
  const label = document.createElement('label');
  label.className = 'quotes-market-location-field';
  label.textContent = labelText;
  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'text';
  input.value = value;
  input.placeholder = placeholder;
  input.autocomplete = labelText.toLowerCase().includes('postal') ? 'postal-code' : 'address-level2';
  const save = () => onSave(input.value.trim());
  input.addEventListener('blur', save);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    }
  });
  label.appendChild(input);
  return { label, input, cleanup: () => input.removeEventListener('blur', save) };
}

export function QuotesInputPolish() {
  const router = useRouter();

  useEffect(() => {
    const root = document.querySelector('.pricing-helper-layout');
    if (!root) return;

    let disposed = false;
    const cleanupFns: Array<() => void> = [];

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

    void fetch('/api/pricing-helper')
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (!data || disposed) return;
        const paid = Boolean(data.paidIntelligence);
        const settings = data.settings || {};

        const inputCard = root.querySelector('.pricing-helper-inputs');
        const pasteTextarea = inputCard?.querySelector<HTMLTextAreaElement>('textarea');
        const pasteContainer = pasteTextarea?.closest('div');
        if (!paid && pasteTextarea && pasteContainer) {
          pasteTextarea.disabled = true;
          pasteTextarea.setAttribute('aria-disabled', 'true');
          const pasteButton = pasteContainer.querySelector<HTMLButtonElement>('.btn-primary');
          if (pasteButton) pasteButton.disabled = true;

          const lock = document.createElement('div');
          lock.className = 'quotes-pro-lock';
          const copy = document.createElement('p');
          copy.className = 'muted';
          copy.textContent = 'Paste Request and pricing intelligence are included with Pro and higher.';
          const upgrade = document.createElement('a');
          upgrade.className = 'btn';
          upgrade.href = '/settings/billing?upgrade=pro&reason=plan&detail=Pro%20plan%20required%20for%20Paste%20Request.';
          upgrade.textContent = 'View Pro';
          lock.append(copy, upgrade);
          pasteContainer.appendChild(lock);
          cleanupFns.push(() => lock.remove());
        }

        const advanced = inputCard?.querySelector('.pricing-advanced');
        if (!paid && advanced) {
          const buttons = Array.from(advanced.querySelectorAll<HTMLButtonElement>('button'));
          const templateButton = buttons[1];
          if (templateButton) {
            templateButton.disabled = true;
            templateButton.title = 'Quote templates require Pro or higher.';
          }
          const templateSelect = advanced.querySelector<HTMLSelectElement>('select.input:not(:first-of-type)');
          if (templateSelect) {
            templateSelect.disabled = true;
            templateSelect.title = 'Quote templates require Pro or higher.';
          }
        }

        const market = root.querySelector('.pricing-market');
        const marketBody = market?.querySelector('.pricing-market-body');
        if (!market || !marketBody) return;

        if (!paid) {
          const summaryEl = market.querySelector('summary');
          if (summaryEl) summaryEl.textContent = `${summaryEl.textContent || 'Market context'} · Pro`;
          const locked = document.createElement('p');
          locked.className = 'muted quotes-market-locked';
          locked.textContent = 'Country, local market data and postal/ZIP context are available with Pro and higher.';
          marketBody.replaceChildren(locked);
          cleanupFns.push(() => locked.remove());
          return;
        }

        const countryLabel = marketBody.querySelector('label');
        if (!countryLabel) return;

        const locationWrap = document.createElement('div');
        locationWrap.className = 'form-grid quotes-market-location-grid';

        const saveLocation = async (patch: Record<string, string>) => {
          const current = data.settings || {};
          const payload = {
            ...current,
            currency: current.currency || 'USD',
            marketCountryCode: current.market_country_code ?? current.marketCountryCode ?? 'US',
            marketRegion: current.market_region ?? current.marketRegion ?? '',
            marketCity: current.market_city ?? current.marketCity ?? '',
            marketPostalCode: current.market_postal_code ?? current.marketPostalCode ?? '',
            ownerHourlyCost: current.owner_hourly_cost ?? current.ownerHourlyCost ?? 0,
            workerHourlyCost: current.worker_hourly_cost ?? current.workerHourlyCost ?? 0,
            desiredMargin: current.desired_margin ?? current.desiredMargin ?? 35,
            rangeLowFactor: current.range_low_factor ?? current.rangeLowFactor ?? 0.9,
            rangeHighFactor: current.range_high_factor ?? current.rangeHighFactor ?? 1.15,
            minimumCharge: current.minimum_charge ?? current.minimumCharge ?? 0,
            minimumSimilarJobs: current.minimum_similar_jobs ?? current.minimumSimilarJobs ?? 2,
            sizeTolerancePct: current.size_tolerance_pct ?? current.sizeTolerancePct ?? 25,
            bedroomTolerance: current.bedroom_tolerance ?? current.bedroomTolerance ?? 1,
            bathroomTolerance: current.bathroom_tolerance ?? current.bathroomTolerance ?? 1,
            marketContextEnabled: current.market_context_enabled ?? current.marketContextEnabled ?? false,
            marketContext: current.market_context ?? current.marketContext ?? {},
            rules: current.rules,
            ...patch,
          };
          const response = await fetch('/api/pricing-helper', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (response.ok) {
            const next = await response.json();
            if (next.settings) data.settings = next.settings;
          }
        };

        const region = createLocationField(
          'State / region',
          settings.market_region ?? settings.marketRegion ?? '',
          'State, province or region',
          (value) => void saveLocation({ marketRegion: value }),
        );
        const city = createLocationField(
          'City',
          settings.market_city ?? settings.marketCity ?? '',
          'City',
          (value) => void saveLocation({ marketCity: value }),
        );
        const postal = createLocationField(
          'Postal / ZIP code',
          settings.market_postal_code ?? settings.marketPostalCode ?? '',
          'Postal or ZIP code',
          (value) => void saveLocation({ marketPostalCode: value }),
        );

        locationWrap.append(region.label, city.label, postal.label);
        countryLabel.insertAdjacentElement('afterend', locationWrap);
        cleanupFns.push(region.cleanup, city.cleanup, postal.cleanup, () => locationWrap.remove());
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      root.removeEventListener('focusin', handleFocus);
      action.removeEventListener('click', handleCreateJob);
      action.remove();
      cleanupFns.forEach((cleanup) => cleanup());
    };
  }, [router]);

  return null;
}
