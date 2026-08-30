'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Quote = {
  service_type: string | null;
  price: number;
  currency: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  notes: string | null;
  source_request: string | null;
  frequency: string | null;
  created_at: string | null;
};

export default function QuotePrintPage() {
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/quotes/${params.id}`, { cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json.error || 'Could not load quote.');
        setQuote(json.quote);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load quote.'));
  }, [params.id]);

  if (error) return <main className="quote-print-page"><p>{error}</p></main>;
  if (!quote) return <main className="quote-print-page"><p>Loading quote...</p></main>;

  const price = new Intl.NumberFormat(undefined, { style: 'currency', currency: quote.currency || 'USD' }).format(Number(quote.price || 0));
  return (
    <main className="quote-print-page">
      <div className="quote-print-toolbar"><button type="button" onClick={() => window.print()}>Print / Save PDF</button></div>
      <article className="quote-print-letter">
        <header><p className="quote-print-brand">EverittOS</p><p>QUOTE</p></header>
        <section className="quote-print-intro">
          <div><span>Prepared for</span><strong>{quote.customer_name || 'Customer'}</strong>{quote.customer_email ? <p>{quote.customer_email}</p> : null}{quote.customer_phone ? <p>{quote.customer_phone}</p> : null}</div>
          <div><span>Date</span><strong>{quote.created_at ? new Date(quote.created_at).toLocaleDateString() : new Date().toLocaleDateString()}</strong></div>
        </section>
        <div className="quote-print-rule" />
        <section><p className="quote-print-label">Service</p><h1>{quote.service_type || 'Service'}</h1>{quote.frequency ? <p>{quote.frequency}</p> : null}</section>
        <section className="quote-print-price"><p className="quote-print-label">Quoted price</p><strong>{price}</strong></section>
        {quote.notes || quote.source_request ? <section><p className="quote-print-label">Details</p><p>{quote.notes || quote.source_request}</p></section> : null}
        <footer><p>Thank you for the opportunity to help with your property.</p></footer>
      </article>
    </main>
  );
}
