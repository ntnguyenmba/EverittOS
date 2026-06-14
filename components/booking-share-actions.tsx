'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { publicBookingUrl } from '@/lib/booking/public-url';

type BookingShareActionsProps = {
  bookingSlug: string | null;
  onSlugLoaded?: (slug: string) => void;
  compact?: boolean;
};

export function BookingShareActions({ bookingSlug, onSlugLoaded, compact = false }: BookingShareActionsProps) {
  const feedback = useAppFeedback();
  const [slug, setSlug] = useState(bookingSlug);
  const [loadingSlug, setLoadingSlug] = useState(!bookingSlug);

  const ensureSlug = useCallback(async () => {
    if (slug) return slug;
    setLoadingSlug(true);
    const res = await fetch('/api/services');
    const json = await res.json();
    setLoadingSlug(false);
    if (res.ok && json.bookingSlug) {
      setSlug(json.bookingSlug);
      onSlugLoaded?.(json.bookingSlug);
      return json.bookingSlug as string;
    }
    return null;
  }, [slug, onSlugLoaded]);

  useEffect(() => {
    if (bookingSlug) {
      setSlug(bookingSlug);
      setLoadingSlug(false);
    }
  }, [bookingSlug]);

  async function copyLink() {
    const activeSlug = slug || (await ensureSlug());
    if (!activeSlug) {
      feedback.error('Booking link is not ready yet. Try again in a moment.');
      return;
    }
    const url = publicBookingUrl(activeSlug);
    try {
      await navigator.clipboard.writeText(url);
      feedback.success('Booking link copied.');
    } catch {
      feedback.error('Unable to copy the booking link.');
    }
  }

  async function openPage() {
    const activeSlug = slug || (await ensureSlug());
    if (!activeSlug) {
      feedback.error('Booking link is not ready yet. Try again in a moment.');
      return;
    }
    window.open(publicBookingUrl(activeSlug), '_blank', 'noopener,noreferrer');
  }

  return (
    <div className={compact ? 'inline-actions' : 'inline-actions'} style={{ flexWrap: 'wrap' }}>
      <button type="button" className="btn" disabled={loadingSlug} onClick={() => void copyLink()}>
        Copy booking link
      </button>
      <button type="button" className="btn btn-primary" disabled={loadingSlug} onClick={() => void openPage()}>
        Open booking page
      </button>
    </div>
  );
}

export function BookingShareCard({ bookingSlug }: { bookingSlug: string | null }) {
  const [slug, setSlug] = useState(bookingSlug);

  return (
    <div className="settings-card" style={{ marginBottom: 18 }}>
      <h3>Share your booking page</h3>
      <p className="muted">Send this link to customers so they can book from your public page.</p>
      {slug ? (
        <p className="muted" style={{ wordBreak: 'break-all' }}>
          {publicBookingUrl(slug)}
        </p>
      ) : null}
      <BookingShareActions bookingSlug={slug} onSlugLoaded={setSlug} />
    </div>
  );
}
