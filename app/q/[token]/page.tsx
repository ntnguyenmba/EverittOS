'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { normalizeLocale, type Locale } from '@/lib/i18n/config';
import { getQuoteShareCopy } from '@/lib/i18n/quote-share-copy';
import { formatQuoteMoney, type PublicQuote } from '@/lib/quote-sharing';

export default function PublicQuotePage() {
  const params = useParams<{ token: string }>();
  const search = useSearchParams();
  const requestedLocale = normalizeLocale(search.get('lang'));
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [locale, setLocale] = useState<Locale>(requestedLocale);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [changed, setChanged] = useState(false);
  const c = useMemo(() => getQuoteShareCopy(locale), [locale]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/public/quotes/${encodeURIComponent(params.token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok || !json.quote) { setMissing(true); return; }
        setQuote(json.quote);
        setLocale(normalizeLocale(search.get('lang') || json.quote.public_locale));
      })
      .catch(() => { if (active) setMissing(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.token, search]);

  async function respond(status: 'accepted' | 'declined') {
    if (busy) return;
    const hadResponse = quote?.status === 'accepted' || quote?.status === 'declined';
    setBusy(true);
    const response = await fetch(`/api/public/quotes/${encodeURIComponent(params.token)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const json = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMissing(true); return; }
    setChanged(hadResponse);
    setQuote((current) => current ? { ...current, status, last_response_at: json.quote?.last_response_at || new Date().toISOString() } : current);
  }

  if (loading) return <main className="eo-public-quote"><div className="eo-card"><p>{c.loading}</p></div></main>;
  if (missing || !quote) return <main className="eo-public-quote"><div className="eo-card"><h1>{c.quote}</h1><p>{c.notFound}</p></div></main>;

  const responded = quote.status === 'accepted' || quote.status === 'declined';
  const statusLabel = quote.status === 'accepted' ? c.accepted : quote.status === 'declined' ? c.declined : c.pending;

  return <main className="eo-public-quote" id="main-content">
    <section className="eo-card eo-public-quote-card">
      <div className="eo-public-quote-brand">{quote.organization_name || 'EverittOS'}</div>
      <div className="eo-public-quote-kicker">{c.quote}</div>
      <h1>{quote.service_type || c.service}</h1>
      {quote.customer_name ? <p className="eo-public-quote-customer">{c.preparedFor}: <strong>{quote.customer_name}</strong></p> : null}
      <div className="eo-public-quote-price">{formatQuoteMoney(Number(quote.price || 0), quote.currency, locale)}</div>
      {quote.notes ? <div className="eo-public-quote-note"><span>{c.note}</span><p>{quote.notes}</p></div> : null}
      {quote.frequency ? <div className="eo-public-quote-meta"><span>{c.frequency}</span><strong>{quote.frequency}</strong></div> : null}
      <div className="eo-public-quote-status"><span className="eo-status">{statusLabel}</span></div>
      {responded ? <p className="eo-public-quote-feedback">{changed ? c.responseChanged : c.responseSaved}</p> : null}
      <div className="eo-action-grid eo-public-quote-actions">
        <button type="button" className="eo-btn btn" disabled={busy || quote.status === 'declined'} onClick={() => void respond('declined')}>{busy ? c.responding : c.decline}</button>
        <button type="button" className="eo-btn eo-btn-primary btn btn-primary" disabled={busy || quote.status === 'accepted'} onClick={() => void respond('accepted')}>{busy ? c.responding : c.accept}</button>
      </div>
      {responded ? <p className="eo-public-quote-change">{c.changeResponse}</p> : null}
    </section>
  </main>;
}
