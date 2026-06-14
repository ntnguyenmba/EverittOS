'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import {
  BOOKING_STATUS_LABELS,
  bookingSchemaUnavailableMessage,
  formatBookingWhen,
  formatServicePrice,
  googleCalendarEventUrl,
  type BookingRecord,
  type BookingStatus,
  type ServiceRecord
} from '@/lib/booking';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type BookingRow = BookingRecord & {
  services?: { name: string; duration_minutes: number; price_cents: number } | null;
  workers?: { name: string } | null;
};

type WorkerOption = { id: string; name: string };

type BookingFormState = {
  service_id: string;
  worker_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  starts_at: string;
  ends_at: string;
  notes: string;
  status: BookingStatus;
};

const EMPTY_FORM: BookingFormState = {
  service_id: '',
  worker_id: '',
  client_name: '',
  client_email: '',
  client_phone: '',
  starts_at: '',
  ends_at: '',
  notes: '',
  status: 'confirmed'
};

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

function addMinutesToLocalInput(startValue: string, minutes: number): string {
  const iso = fromLocalInputValue(startValue);
  if (!iso) return '';
  const end = new Date(iso);
  end.setMinutes(end.getMinutes() + minutes);
  return toLocalInputValue(end.toISOString());
}

export default function BookingsPage() {
  const router = useRouter();
  const feedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editBookingId, setEditBookingId] = useState<string | null>(null);
  const [form, setForm] = useState<BookingFormState>(EMPTY_FORM);

  const activeServices = useMemo(
    () => services.filter((service) => service.is_active !== false),
    [services]
  );

  const loadCatalog = useCallback(async () => {
    const res = await fetch('/api/services');
    const json = await res.json();
    if (!res.ok) {
      if (json.code === 'schema_missing') {
        setSchemaMissing(true);
      }
      return;
    }
    setServices(json.services || []);
    setWorkers(json.workers || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const userRole = normalizeRole(profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(userRole);
    setCanManage(isManagerRole(userRole));

    const res = await fetch('/api/bookings?upcoming=1');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      if (json.code === 'schema_missing') {
        setSchemaMissing(true);
        return;
      }
      feedback.error(json.error || 'Unable to load bookings.');
      return;
    }
    setSchemaMissing(false);
    setBookings(json.bookings || []);
  }, [feedback, router]);

  useEffect(() => {
    void load();
    void loadCatalog();
  }, [load, loadCatalog]);

  function openCreateForm() {
    setEditBookingId(null);
    setForm(EMPTY_FORM);
    setShowCreateForm(true);
  }

  function openEditForm(booking: BookingRow) {
    setShowCreateForm(false);
    setEditBookingId(booking.id);
    setForm({
      service_id: booking.service_id,
      worker_id: booking.worker_id || '',
      client_name: booking.client_name,
      client_email: booking.client_email || '',
      client_phone: booking.client_phone || '',
      starts_at: toLocalInputValue(booking.starts_at),
      ends_at: toLocalInputValue(booking.ends_at),
      notes: booking.notes || '',
      status: booking.status
    });
  }

  function closeForms() {
    setShowCreateForm(false);
    setEditBookingId(null);
    setForm(EMPTY_FORM);
  }

  function updateFormField<K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'service_id' && typeof value === 'string') {
        const service = activeServices.find((item) => item.id === value);
        if (service && prev.starts_at) {
          next.ends_at = addMinutesToLocalInput(prev.starts_at, service.duration_minutes);
        }
      }
      if (key === 'starts_at' && typeof value === 'string') {
        const service = activeServices.find((item) => item.id === prev.service_id);
        if (service) {
          next.ends_at = addMinutesToLocalInput(value, service.duration_minutes);
        }
      }
      return next;
    });
  }

  async function saveBooking() {
    if (busyId) return;
    if (!form.service_id || !form.client_name.trim() || !form.starts_at || !form.ends_at) {
      feedback.error('Service, client name, and time are required.');
      return;
    }

    const payload = {
      service_id: form.service_id,
      worker_id: form.worker_id || null,
      client_name: form.client_name.trim(),
      client_email: form.client_email.trim() || undefined,
      client_phone: form.client_phone.trim() || undefined,
      starts_at: fromLocalInputValue(form.starts_at),
      ends_at: fromLocalInputValue(form.ends_at),
      notes: form.notes.trim() || undefined,
      status: form.status
    };

    setBusyId(editBookingId || 'create');
    const res = await fetch(editBookingId ? `/api/bookings/${editBookingId}` : '/api/bookings', {
      method: editBookingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    setBusyId(null);

    if (!res.ok) {
      feedback.error(json.error || 'Unable to save booking.');
      return;
    }

    feedback.success(json.message || 'Booking saved.');
    closeForms();
    void load();
  }

  async function patchBooking(id: string, payload: Record<string, unknown>, successMessage: string) {
    if (busyId) return;
    setBusyId(id);
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to update booking.');
      return;
    }
    feedback.success(successMessage);
    void load();
  }

  async function deleteBooking(id: string, clientName: string) {
    if (busyId) return;
    if (!window.confirm(`Cancel booking for ${clientName}?`)) return;
    setBusyId(id);
    const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to cancel booking.');
      return;
    }
    feedback.success(json.message || 'Booking cancelled.');
    if (editBookingId === id) closeForms();
    void load();
  }

  function renderBookingForm(title: string) {
    return (
      <div className="form booking-form" style={{ marginBottom: 18 }}>
        <h3>{title}</h3>
        <label>
          Service
          <select
            className="input"
            value={form.service_id}
            onChange={(e) => updateFormField('service_id', e.target.value)}
          >
            <option value="">Select service</option>
            {activeServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} ({service.duration_minutes} min)
              </option>
            ))}
          </select>
        </label>
        <label>
          Staff
          <select className="input" value={form.worker_id} onChange={(e) => updateFormField('worker_id', e.target.value)}>
            <option value="">Any staff</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Client name
          <input className="input" value={form.client_name} onChange={(e) => updateFormField('client_name', e.target.value)} />
        </label>
        <label>
          Client email
          <input className="input" type="email" value={form.client_email} onChange={(e) => updateFormField('client_email', e.target.value)} />
        </label>
        <label>
          Client phone
          <input className="input" value={form.client_phone} onChange={(e) => updateFormField('client_phone', e.target.value)} />
        </label>
        <label>
          Starts
          <input
            className="input"
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) => updateFormField('starts_at', e.target.value)}
          />
        </label>
        <label>
          Ends
          <input
            className="input"
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) => updateFormField('ends_at', e.target.value)}
          />
        </label>
        <label>
          Status
          <select className="input" value={form.status} onChange={(e) => updateFormField('status', e.target.value as BookingStatus)}>
            {Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notes
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => updateFormField('notes', e.target.value)} />
        </label>
        <div className="inline-actions">
          <button type="button" className="btn btn-primary" disabled={Boolean(busyId)} onClick={() => void saveBooking()}>
            {busyId ? 'Saving…' : 'Save booking'}
          </button>
          <button type="button" className="btn" disabled={Boolean(busyId)} onClick={closeForms}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <div className="page-header-text">
          <h1>Bookings</h1>
          <p className="page-subtitle">Upcoming appointments from your public booking page and manual entries.</p>
        </div>
        <div className="inline-actions">
          {canManage && !schemaMissing ? (
            <button type="button" className="btn btn-primary" onClick={openCreateForm}>
              New booking
            </button>
          ) : null}
          <Link className="btn" href="/services">
            Manage services
          </Link>
        </div>
      </header>

      {schemaMissing ? (
        <div className="settings-warning" style={{ marginBottom: 18 }}>
          {bookingSchemaUnavailableMessage()}
        </div>
      ) : null}

      <div className="card">
        {showCreateForm && canManage ? renderBookingForm('New booking') : null}
        {loading ? <p>Loading bookings…</p> : null}
        {!loading && !schemaMissing && bookings.length === 0 && !showCreateForm ? (
          <p className="muted">No bookings yet. Add services and share your booking page.</p>
        ) : null}

        {bookings.map((booking) => {
          const calendarUrl = googleCalendarEventUrl(booking.google_calendar_event_id);
          if (editBookingId === booking.id) {
            return (
              <div key={booking.id} className="list-row booking-row">
                {renderBookingForm('Edit booking')}
              </div>
            );
          }

          return (
            <div key={booking.id} className="list-row booking-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{booking.client_name}</strong>
                  <span className={`status-pill status-${booking.status}`}>{BOOKING_STATUS_LABELS[booking.status] || booking.status}</span>
                </div>
                <p className="muted" style={{ margin: '6px 0 0' }}>
                  {booking.services?.name || 'Service'} · {booking.workers?.name || 'Any staff'} ·{' '}
                  {formatBookingWhen(booking.starts_at, booking.ends_at)}
                </p>
                {booking.services?.price_cents != null ? (
                  <p className="muted">{formatServicePrice(booking.services.price_cents)}</p>
                ) : null}
                {booking.notes ? <p className="muted">{booking.notes}</p> : null}
              </div>
              <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                {booking.customer_id ? (
                  <Link className="btn btn-sm" href={`/customers/${booking.customer_id}`}>
                    Open customer
                  </Link>
                ) : null}
                {calendarUrl ? (
                  <a className="btn btn-sm" href={calendarUrl} target="_blank" rel="noopener noreferrer">
                    Calendar
                  </a>
                ) : null}
                {canManage ? (
                  <>
                    <button type="button" className="btn btn-sm" disabled={busyId === booking.id} onClick={() => openEditForm(booking)}>
                      Edit
                    </button>
                    {booking.status !== 'completed' ? (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busyId === booking.id}
                        onClick={() => void patchBooking(booking.id, { status: 'completed' }, 'Marked completed.')}
                      >
                        Mark completed
                      </button>
                    ) : null}
                    {booking.status !== 'cancelled' ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        disabled={busyId === booking.id}
                        onClick={() => void deleteBooking(booking.id, booking.client_name)}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
