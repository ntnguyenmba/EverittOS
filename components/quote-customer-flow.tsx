'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function textValue(selector: string) {
  const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  return element?.value?.trim() || '';
}

function quoteDataFromPage() {
  const amount = textValue('.pricing-helper-summary .pricing-final input');
  const request = textValue('.pricing-helper-inputs textarea');
  const service = textValue('.pricing-helper-inputs .form-grid label:first-child input');
  return { amount, request, service };
}

const copy = {
  en: {
    customerQuote: 'Customer quote',
    customerQuoteHint: 'Save the price as a customer-ready quote, then send it or turn it into a job.',
    continueQuote: 'Continue to customer quote',
    quoteReady: 'Quote details added. Add the customer and email when you are ready to send.',
    createJob: 'Create job',
    creatingJob: 'Creating job...',
    createFailed: 'Could not create the job. Your quote is still saved.',
    backToQuotes: 'Back to Quotes'
  },
  es: {
    customerQuote: 'Cotización para cliente',
    customerQuoteHint: 'Guarda el precio como una cotización para el cliente, luego envíala o conviértela en trabajo.',
    continueQuote: 'Continuar a cotización',
    quoteReady: 'Se agregaron los datos. Añade el cliente y el correo cuando quieras enviarla.',
    createJob: 'Crear trabajo',
    creatingJob: 'Creando trabajo...',
    createFailed: 'No se pudo crear el trabajo. La cotización sigue guardada.',
    backToQuotes: 'Volver a Cotizaciones'
  },
  vi: {
    customerQuote: 'Báo giá cho khách',
    customerQuoteHint: 'Lưu giá thành báo giá cho khách, sau đó gửi hoặc chuyển thành công việc.',
    continueQuote: 'Tiếp tục báo giá',
    quoteReady: 'Đã thêm thông tin báo giá. Thêm khách hàng và email khi sẵn sàng gửi.',
    createJob: 'Tạo công việc',
    creatingJob: 'Đang tạo công việc...',
    createFailed: 'Không thể tạo công việc. Báo giá vẫn được lưu.',
    backToQuotes: 'Quay lại Báo giá'
  }
} as const;

export function QuoteCustomerFlow() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useTranslation();
  const c = copy[locale] || copy.en;
  const [quoteReady, setQuoteReady] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (pathname !== '/estimates' || searchParams.get('from') !== 'quotes') {
      setQuoteReady(false);
      setCreateError('');
      return;
    }

    const amount = searchParams.get('amount') || '';
    const service = searchParams.get('service') || '';
    const request = searchParams.get('request') || '';
    const body = [service ? `Service: ${service}` : '', request ? `Request: ${request}` : ''].filter(Boolean).join('\n\n');
    const subject = service ? `Quote for ${service}` : 'Your service quote';

    let attempts = 0;
    const apply = () => {
      attempts += 1;
      const amountControl = document.getElementById('estimate-amount');
      const bodyControl = document.getElementById('estimate-body');
      const subjectControl = document.getElementById('estimate-subject');

      if (amountControl instanceof HTMLInputElement && amount && !amountControl.value) setControlValue(amountControl, amount);
      if (bodyControl instanceof HTMLTextAreaElement && body && !bodyControl.value.includes(request)) setControlValue(bodyControl, body);
      if (subjectControl instanceof HTMLInputElement && service && !subjectControl.value.includes(service)) setControlValue(subjectControl, subject);

      const complete = amountControl instanceof HTMLInputElement && bodyControl instanceof HTMLTextAreaElement;
      if (complete) {
        setQuoteReady(true);
        return;
      }
      if (attempts < 24) window.setTimeout(apply, 120);
    };

    apply();
  }, [pathname, searchParams]);

  async function createJobFromQuote() {
    if (creatingJob) return;
    setCreatingJob(true);
    setCreateError('');

    const amountText = textValue('#estimate-amount') || searchParams.get('amount') || '';
    const amount = Number(amountText);
    const customerName = textValue('#estimate-recipient-name');
    const customerEmail = textValue('#estimate-recipient-email');
    const notes = textValue('#estimate-body') || searchParams.get('request') || '';
    const service = searchParams.get('service') || 'Service job';

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: service,
          customer_name: customerName || null,
          customer_email: customerEmail || null,
          notes: notes || null,
          status: 'new',
          revenue_amount: Number.isFinite(amount) && amount >= 0 ? amount : null
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || c.createFailed);

      const jobId = json?.job?.id || json?.id || json?.data?.id || '';
      router.push(jobId ? `/jobs/${jobId}` : '/jobs');
      router.refresh();
    } catch (error) {
      setCreateError(error instanceof Error && error.message ? error.message : c.createFailed);
      setCreatingJob(false);
    }
  }

  if (pathname === '/pricing-helper') {
    return (
      <div className="quote-flow-card" role="region" aria-label={c.customerQuote}>
        <div>
          <strong>{c.customerQuote}</strong>
          <p>{c.customerQuoteHint}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary quote-flow-primary"
          onClick={() => {
            const quote = quoteDataFromPage();
            if (!quote.amount) return;
            const params = new URLSearchParams({ from: 'quotes', amount: quote.amount });
            if (quote.service) params.set('service', quote.service);
            if (quote.request) params.set('request', quote.request);
            router.push(`/estimates?${params.toString()}`);
          }}
        >
          {c.continueQuote}
        </button>
      </div>
    );
  }

  if (pathname === '/estimates' && searchParams.get('from') === 'quotes') {
    return (
      <div className="quote-flow-card quote-flow-estimate" role="region" aria-label={c.customerQuote}>
        <div>
          <strong>{c.customerQuote}</strong>
          <p>{quoteReady ? c.quoteReady : c.customerQuoteHint}</p>
          {createError ? <p className="quote-flow-error" role="alert">{createError}</p> : null}
        </div>
        <div className="quote-flow-actions">
          <button type="button" className="btn" disabled={creatingJob} onClick={() => router.push('/pricing-helper')}>
            {c.backToQuotes}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={creatingJob || !quoteReady}
            onClick={() => void createJobFromQuote()}
          >
            {creatingJob ? c.creatingJob : c.createJob}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
