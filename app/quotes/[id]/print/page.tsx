'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from '@/components/locale-provider';
import { getQuotePrintCopy } from '@/lib/i18n/public-booking-quote-copy';

type Quote = { service_type:string|null; price:number; currency:string|null; customer_name:string|null; customer_email:string|null; customer_phone:string|null; notes:string|null; source_request:string|null; frequency:string|null; created_at:string|null };

export default function QuotePrintPage() {
  const params = useParams<{ id: string }>();
  const { locale } = useTranslation();
  const c = getQuotePrintCopy(locale);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/quotes/${params.id}`, { cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error || c.loadError);
        setQuote(json.quote);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : c.loadError));
  }, [c.loadError, params.id]);

  if (error) return <main className="quote-print-page"><p>{error}</p></main>;
  if (!quote) return <main className="quote-print-page"><p>{c.loading}</p></main>;

  const price = new Intl.NumberFormat(locale, { style: 'currency', currency: quote.currency || 'USD' }).format(Number(quote.price || 0));
  const date = quote.created_at ? new Date(quote.created_at) : new Date();
  return (
    <main className="quote-print-page">
      <div className="quote-print-toolbar"><button type="button" onClick={() => window.print()}>{c.print}</button></div>
      <article className="quote-print-letter">
        <header><p className="quote-print-brand">EverittOS</p><p>{c.quote}</p></header>
        <section className="quote-print-intro">
          <div><span>{c.preparedFor}</span><strong>{quote.customer_name || c.customer}</strong>{quote.customer_email ? <p>{quote.customer_email}</p> : null}{quote.customer_phone ? <p>{quote.customer_phone}</p> : null}</div>
          <div><span>{c.date}</span><strong>{date.toLocaleDateString(locale)}</strong></div>
        </section>
        <div className="quote-print-rule" />
        <section><p className="quote-print-label">{c.service}</p><h1>{quote.service_type || c.service}</h1>{quote.frequency ? <p>{quote.frequency}</p> : null}</section>
        <section className="quote-print-price"><p className="quote-print-label">{c.quotedPrice}</p><strong>{price}</strong></section>
        {quote.notes || quote.source_request ? <section><p className="quote-print-label">{c.details}</p><p>{quote.notes || quote.source_request}</p></section> : null}
        <footer><p>{c.thanks}</p></footer>
      </article>
    </main>
  );
}
