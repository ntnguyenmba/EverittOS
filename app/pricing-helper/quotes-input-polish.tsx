'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function labelControl(root: Element, includes: string) {
  const label = Array.from(root.querySelectorAll('label')).find((item) => item.textContent?.toLowerCase().includes(includes.toLowerCase()));
  return label?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea') || null;
}

function value(root: Element, label: string) { return labelControl(root, label)?.value?.trim() || ''; }
function numberValue(raw: string) { const n = Number(raw.replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : null; }
function requestValue(root: Element) { return root.querySelector<HTMLTextAreaElement>('.pricing-helper-inputs textarea')?.value?.trim() || ''; }
function currencyFrom(data: any) { return data?.settings?.currency || data?.settings?.market_currency || 'USD'; }

function quotePayload(root: Element, data: any) {
  const price = value(root, 'final price') || value(root, 'precio final') || value(root, 'giá cuối cùng') || value(root, 'try a price');
  const service = value(root, 'service type') || value(root, 'tipo de servicio') || value(root, 'loại dịch vụ');
  const size = value(root, 'job size') || value(root, 'tamaño / cantidad') || value(root, 'quy mô / số lượng');
  const unit = value(root, 'unit') || value(root, 'unidad') || value(root, 'đơn vị');
  const primary = value(root, 'primary units') || value(root, 'unidades principales') || value(root, 'đơn vị chính');
  const extra = value(root, 'extra units') || value(root, 'unidades adicionales') || value(root, 'đơn vị bổ sung');
  const condition = value(root, 'condition') || value(root, 'condición') || value(root, 'tình trạng');
  const frequency = value(root, 'frequency') || value(root, 'frecuencia') || value(root, 'tần suất');
  const hours = value(root, 'estimated labor hours') || value(root, 'horas de trabajo estimadas') || value(root, 'số giờ công ước tính');
  const detected = Array.from(root.querySelectorAll('.pricing-helper-inputs .muted')).find((el) => /detected extras|extras detectados|phần thêm/i.test(el.textContent || ''))?.textContent || '';
  const addOns = detected.includes(':') ? detected.split(':').slice(1).join(':').split(',').map((item) => item.trim()).filter(Boolean) : [];
  return {
    serviceType: service,
    sizeValue: numberValue(size),
    sizeUnit: unit,
    primaryUnits: numberValue(primary),
    extraUnits: numberValue(extra),
    condition,
    frequency,
    addOns,
    laborHours: numberValue(hours),
    price: numberValue(price),
    currency: currencyFrom(data),
    sourceRequest: requestValue(root),
  };
}

function quoteText(quote: any) {
  const size = quote.size_value != null ? `${quote.size_value} ${quote.size_unit || ''}`.trim() : '';
  const units = [quote.primary_units != null ? `${quote.primary_units} primary` : '', quote.extra_units != null ? `${quote.extra_units} extra` : ''].filter(Boolean).join(' · ');
  return [
    'QUOTE',
    quote.service_type || 'Service',
    size,
    units,
    quote.condition || '',
    quote.frequency || '',
    Array.isArray(quote.add_ons) && quote.add_ons.length ? `Includes: ${quote.add_ons.join(', ')}` : '',
    '',
    `Total: ${new Intl.NumberFormat(undefined, { style: 'currency', currency: quote.currency || 'USD' }).format(Number(quote.price || 0))}`,
    '',
    'Please reply to confirm acceptance.'
  ].filter((line, index, all) => line !== '' || (index > 0 && all[index - 1] !== '')).join('\n');
}

function button(text: string, className = 'btn') {
  const el = document.createElement('button'); el.type = 'button'; el.className = className; el.textContent = text; return el;
}

export function QuotesInputPolish() {
  const router = useRouter();
  useEffect(() => {
    const root = document.querySelector('.pricing-helper-layout');
    if (!root) return;
    let disposed = false;
    let pricingData: any = null;
    let savedQuote: any = null;
    const cleanup: Array<() => void> = [];
    const summary = root.querySelector('.pricing-helper-summary');
    if (!summary) return;

    const actions = document.createElement('div'); actions.className = 'inline-actions quotes-document-actions';
    const save = button('Save quote', 'btn btn-primary');
    const copy = button('Copy');
    const share = button('Share');
    const accept = button('Mark accepted');
    const createJob = button('Create job');
    copy.disabled = share.disabled = accept.disabled = createJob.disabled = true;
    actions.append(save, copy, share, accept, createJob); summary.appendChild(actions);

    const status = document.createElement('p'); status.className = 'muted quotes-document-status'; status.textContent = 'Save the quote before sharing or converting it to a job.'; summary.appendChild(status);

    async function saveQuote() {
      if (!pricingData) return;
      const payload = quotePayload(root as Element, pricingData);
      if (payload.price == null) { status.textContent = 'Choose a final price first.'; return; }
      save.disabled = true; status.textContent = 'Saving quote…';
      const response = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await response.json().catch(() => ({})); save.disabled = false;
      if (!response.ok || !json.quote) { status.textContent = json.error || 'Unable to save quote.'; return; }
      savedQuote = json.quote; status.textContent = 'Draft saved. Ready to share.'; copy.disabled = share.disabled = accept.disabled = createJob.disabled = false; save.textContent = 'Save another quote';
    }

    async function setStatus(next: string, extra: Record<string, string> = {}) {
      if (!savedQuote?.id) return false;
      const response = await fetch(`/api/quotes/${savedQuote.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next, ...extra }) });
      const json = await response.json().catch(() => ({})); if (!response.ok) { status.textContent = json.error || 'Unable to update quote.'; return false; }
      savedQuote = json.quote; return true;
    }

    async function copyQuote() { if (!savedQuote) return; await navigator.clipboard.writeText(quoteText(savedQuote)); await setStatus('shared'); status.textContent = 'Quote copied. Marked shared.'; }
    async function shareQuote() {
      if (!savedQuote) return; const text = quoteText(savedQuote);
      if (navigator.share) { try { await navigator.share({ title: 'Quote', text }); await setStatus('shared'); status.textContent = 'Quote shared.'; return; } catch { return; } }
      await navigator.clipboard.writeText(text); await setStatus('shared'); status.textContent = 'Quote copied for sharing.';
    }
    async function markAccepted() { if (await setStatus('accepted')) status.textContent = 'Accepted. Ready to create the job.'; }
    function goToJob() {
      if (!savedQuote) return;
      const params = new URLSearchParams();
      if (savedQuote.service_type) params.set('title', savedQuote.service_type);
      params.set('client_income', String(savedQuote.price || 0));
      params.set('notes', `Quote ${savedQuote.id}\nStatus: ${savedQuote.status}\nCreated from Quotes.`);
      params.set('source', 'quotes'); params.set('quote_id', savedQuote.id);
      params.set('quote_context', JSON.stringify({ serviceType: savedQuote.service_type, sizeValue: savedQuote.size_value, sizeUnit: savedQuote.size_unit, primaryUnits: savedQuote.primary_units, extraUnits: savedQuote.extra_units, condition: savedQuote.condition, frequency: savedQuote.frequency, addOns: savedQuote.add_ons || [], laborHours: savedQuote.labor_hours, price: savedQuote.price, currency: savedQuote.currency, sourceRequest: savedQuote.source_request }));
      router.push(`/jobs/new?${params.toString()}`);
    }

    save.addEventListener('click', saveQuote); copy.addEventListener('click', copyQuote); share.addEventListener('click', shareQuote); accept.addEventListener('click', markAccepted); createJob.addEventListener('click', goToJob);
    cleanup.push(() => save.removeEventListener('click', saveQuote), () => copy.removeEventListener('click', copyQuote), () => share.removeEventListener('click', shareQuote), () => accept.removeEventListener('click', markAccepted), () => createJob.removeEventListener('click', goToJob), () => actions.remove(), () => status.remove());

    const handleFocus = (event: Event) => { const target = event.target; if (target instanceof HTMLInputElement && target.type === 'number' && target.value === '0') requestAnimationFrame(() => target.select()); };
    root.addEventListener('focusin', handleFocus); cleanup.push(() => root.removeEventListener('focusin', handleFocus));

    void fetch('/api/pricing-helper').then(async (response) => response.ok ? response.json() : null).then((data) => {
      if (!data || disposed) return; pricingData = data;
      const paid = Boolean(data.paidIntelligence); const inputCard = root.querySelector('.pricing-helper-inputs'); const pasteTextarea = inputCard?.querySelector<HTMLTextAreaElement>('textarea'); const pasteContainer = pasteTextarea?.closest('div');
      if (!paid && pasteTextarea && pasteContainer) {
        pasteTextarea.disabled = true; const pasteButton = pasteContainer.querySelector<HTMLButtonElement>('.btn-primary'); if (pasteButton) pasteButton.disabled = true;
        const lock = document.createElement('div'); lock.className = 'quotes-pro-lock'; lock.innerHTML = '<p class="muted">Paste Request and pricing intelligence are included with Pro and higher.</p><a class="btn" href="/settings/billing?upgrade=pro">View Pro</a>'; pasteContainer.appendChild(lock); cleanup.push(() => lock.remove());
      }
      const market = root.querySelector('.pricing-market'); const marketBody = market?.querySelector('.pricing-market-body');
      if (!paid && market && marketBody) { const locked = document.createElement('p'); locked.className = 'muted'; locked.textContent = 'Local market intelligence is available with Pro and higher.'; marketBody.replaceChildren(locked); }
    }).catch(() => undefined);

    return () => { disposed = true; cleanup.forEach((fn) => fn()); };
  }, [router]);
  return null;
}
