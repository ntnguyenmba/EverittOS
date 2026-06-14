'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { formatServicePrice, formatBookingWhen, generateBookingIcs, bookingIcsFilename, type PublicBookingPayload } from '@/lib/booking';

type Slot = { starts_at: string; ends_at: string; worker_id: string };

type PublicBookPageProps = {
  workspaceSlug: string;
};

type Step = 1 | 2 | 3 | 4 | 5;

export function PublicBookingWizard({ workspaceSlug }: PublicBookPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<PublicBookingPayload | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [serviceId, setServiceId] = useState('');
  const [workerId, setWorkerId] = useState('any');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    client_name: string;
    starts_at: string;
    ends_at: string;
    id?: string;
  } | null>(null);
  const [confirmationMeta, setConfirmationMeta] = useState<{
    serviceName: string | null;
    organizationName: string;
    confirmationSent: boolean;
    warnings: string[];
  } | null>(null);

  const loadPayload = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/book/${encodeURIComponent(workspaceSlug)}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error || 'Booking page not found.');
      return;
    }
    setPayload(json);
    if (json.services?.[0]?.id) setServiceId(json.services[0].id);
  }, [workspaceSlug]);

  useEffect(() => {
    void loadPayload();
  }, [loadPayload]);

  const selectedService = useMemo(
    () => payload?.services.find((s) => s.id === serviceId) || null,
    [payload, serviceId]
  );

  const eligibleWorkers = useMemo(() => {
    if (!payload || !serviceId) return [];
    return payload.workers.filter((w) => w.service_ids.includes(serviceId));
  }, [payload, serviceId]);

  async function loadSlots(nextDate: string) {
    if (!serviceId || !nextDate) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    const params = new URLSearchParams({
      serviceId,
      workerId: workerId || 'any',
      date: nextDate
    });
    const res = await fetch(`/api/book/${encodeURIComponent(workspaceSlug)}/availability?${params}`);
    const json = await res.json();
    setSlotsLoading(false);
    if (!res.ok) {
      setError(json.error || 'Unable to load times.');
      setSlots([]);
      return;
    }
    setError('');
    setSlots(json.slots || []);
  }

  async function confirmBooking() {
    if (!selectedService || !selectedSlot || !clientName.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    const res = await fetch(`/api/book/${encodeURIComponent(workspaceSlug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        worker_id: selectedSlot.worker_id,
        starts_at: selectedSlot.starts_at,
        ends_at: selectedSlot.ends_at,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        notes
      })
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error || 'Unable to complete booking.');
      return;
    }
    setConfirmed(json.booking);
    setConfirmationMeta({
      serviceName: json.serviceName || selectedService?.name || null,
      organizationName: json.organizationName || payload?.organization_name || 'Your business',
      confirmationSent: Boolean(json.confirmationSent),
      warnings: Array.isArray(json.warnings) ? json.warnings : []
    });
    setStep(5);
  }

  function downloadCalendarFile() {
    if (!confirmed || !confirmationMeta) return;
    const ics = generateBookingIcs({
      uid: confirmed.id || `${confirmed.starts_at}-${confirmed.client_name}`,
      title: `${confirmationMeta.serviceName || 'Appointment'} — ${confirmationMeta.organizationName}`,
      description: `Booking for ${confirmed.client_name}`,
      startsAt: confirmed.starts_at,
      endsAt: confirmed.ends_at,
      organizerName: confirmationMeta.organizationName
    });
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = bookingIcsFilename(confirmed.id || 'booking');
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="public-booking-page">
        <div className="public-booking-card">
          <p className="muted">Loading booking…</p>
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="public-booking-page">
        <div className="public-booking-card">
          <p>{error || 'Booking page not found.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="public-booking-page">
      <div className="public-booking-shell">
        <header className="public-booking-header">
          <BrandLogo href="/" size={40} showName />
          <h1>{payload.organization_name}</h1>
          <p className="muted">Book an appointment online</p>
        </header>

        <div className="public-booking-card">
          {step === 1 ? (
            <>
              <h2>Choose a service</h2>
              <div className="public-booking-options">
                {payload.services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    className={`public-booking-option${serviceId === service.id ? ' is-selected' : ''}`}
                    onClick={() => setServiceId(service.id)}
                  >
                    <strong>{service.name}</strong>
                    <span className="muted">
                      {service.duration_minutes} min · {formatServicePrice(service.price_cents)}
                    </span>
                    {service.description ? <span className="muted">{service.description}</span> : null}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-primary" disabled={!serviceId} onClick={() => setStep(2)}>
                Continue
              </button>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h2>Choose staff</h2>
              <div className="public-booking-options">
                <button
                  type="button"
                  className={`public-booking-option${workerId === 'any' ? ' is-selected' : ''}`}
                  onClick={() => setWorkerId('any')}
                >
                  <strong>Any available</strong>
                  <span className="muted">We will assign the next open stylist</span>
                </button>
                {eligibleWorkers.map((worker) => (
                  <button
                    key={worker.id}
                    type="button"
                    className={`public-booking-option${workerId === worker.id ? ' is-selected' : ''}`}
                    onClick={() => setWorkerId(worker.id)}
                  >
                    <strong>{worker.name}</strong>
                  </button>
                ))}
              </div>
              <div className="public-booking-nav">
                <button type="button" className="btn" onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                  Continue
                </button>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h2>Choose date & time</h2>
              <label className="auth-field">
                <span>Date</span>
                <input
                  className="input"
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    setDate(e.target.value);
                    void loadSlots(e.target.value);
                  }}
                />
              </label>
              {slotsLoading ? <p className="muted">Loading available times…</p> : null}
              {!slotsLoading && date && slots.length === 0 ? (
                <p className="muted">No open times on this date. Try another day.</p>
              ) : null}
              <div className="public-booking-slot-grid">
                {slots.map((slot) => {
                  const label = new Date(slot.starts_at).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit'
                  });
                  const selected =
                    selectedSlot?.starts_at === slot.starts_at && selectedSlot.worker_id === slot.worker_id;
                  return (
                    <button
                      key={`${slot.worker_id}-${slot.starts_at}`}
                      type="button"
                      className={`public-booking-slot${selected ? ' is-selected' : ''}`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="public-booking-nav">
                <button type="button" className="btn" onClick={() => setStep(2)}>
                  Back
                </button>
                <button type="button" className="btn btn-primary" disabled={!selectedSlot} onClick={() => setStep(4)}>
                  Continue
                </button>
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <h2>Your details</h2>
              {selectedService && selectedSlot ? (
                <p className="muted" style={{ marginBottom: 16 }}>
                  {selectedService.name} · {formatBookingWhen(selectedSlot.starts_at, selectedSlot.ends_at)}
                </p>
              ) : null}
              <input className="input" placeholder="Full name *" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              <input className="input" placeholder="Phone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
              <input className="input" type="email" placeholder="Email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              <textarea className="input" rows={3} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              {error ? <p className="auth-message auth-message-error">{error}</p> : null}
              <div className="public-booking-nav">
                <button type="button" className="btn" onClick={() => setStep(3)}>
                  Back
                </button>
                <button type="button" className="btn btn-primary" disabled={submitting || !clientName.trim()} onClick={() => void confirmBooking()}>
                  {submitting ? 'Confirming…' : 'Confirm booking'}
                </button>
              </div>
            </>
          ) : null}

          {step === 5 && confirmed && confirmationMeta ? (
            <>
              <h2>Your booking request is confirmed.</h2>
              <div className="public-booking-confirmation">
                <p>
                  <strong>{confirmationMeta.serviceName || 'Appointment'}</strong>
                </p>
                <p>{formatBookingWhen(confirmed.starts_at, confirmed.ends_at)}</p>
                <p>{confirmationMeta.organizationName}</p>
                <p>{confirmed.client_name}</p>
              </div>
              <button type="button" className="btn" onClick={downloadCalendarFile}>
                Add to calendar
              </button>
              {confirmationMeta.confirmationSent ? (
                <p className="muted">We sent a confirmation email.</p>
              ) : null}
              {confirmationMeta.warnings.map((warning) => (
                <p key={warning} className="auth-message auth-message-warning">
                  {warning}
                </p>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
