'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { BookingShareCard } from '@/components/booking-share-actions';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import {
  BOOKING_STATUS_LABELS,
  bookingAppointmentName,
  bookingCalendarSyncLabel,
  bookingSchemaUnavailableMessage,
  bookingStaffLabel,
  formatBookingDetailsText,
  formatBookingWhen,
  formatServicePrice,
  googleCalendarEventUrl,
  type BookingRecord,
  type BookingStatus
} from '@/lib/booking';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type BookingRow = BookingRecord & {
  services?: { name: string; duration_minutes: number; price_cents: number } | null;
  workers?: { name: string } | null;
};

type BookingFormState = {
  manual_service_name: string;
  staff_name: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  starts_at: string;
  ends_at: string;
  notes: string;
  status: BookingStatus;
  send_confirmation: boolean;
};

const EMPTY_FORM: BookingFormState = {
  manual_service_name: '',
  staff_name: '',
  client_name: '',
  client_email: '',
  client_phone: '',
  starts_at: '',
  ends_at: '',
  notes: '',
  status: 'confirmed',
  send_confirmation: false
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
  const [bookingSlug, setBookingSlug] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editBookingId, setEditBookingId] = useState<string | null>(null);
  const [form, setForm] = useState<BookingFormState>(EMPTY_FORM);

  const loadMeta = useCallback(async () => {
    const res = await fetch('/api/services');
    const json = await res.json();
    if (!res.ok) {
      if (json.code === 'schema_missing') setSchemaMissing(true);
      return;
    }
    setBookingSlug(json.bookingSlug || null);
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
    void loadMeta();
  }, [load, loadMeta]);

  function openCreateForm() {
    setEditBookingId(null);
    setForm(EMPTY_FORM);
    setShowCreateForm(true);
  }

  function openEditForm(booking: BookingRow) {
    setShowCreateForm(false);
    setEditBookingId(booking.id);
    setForm({
      manual_service_name: booking.manual_service_name || booking.services?.name || '',
      staff_name: booking.staff_name || booking.workers?.name || '',
      client_name: booking.client_name,
      client_email: booking.client_email || '',
      client_phone: booking.client_phone || '',
      starts_at: toLocalInputValue(booking.starts_at),
      ends_at: toLocalInputValue(booking.ends_at),
      notes: booking.notes || '',
      status: booking.status,
      send_confirmation: false
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
      if (key === 'starts_at' && typeof value === 'string' && value && !prev.ends_at) {
        next.ends_at = addMinutesToLocalInput(value, 60);
      }
      if (key === 'client_email' && typeof value === 'string' && !editBookingId) {
        next.send_confirmation = Boolean(value.trim());
      }
      return next;
    });
  }

  async function saveBooking() {
    if (busyId) return;
    if (!form.manual_service_name.trim() || !form.client_name.trim() || !form.starts_at) {
      feedback.error('Add an appointment name, client name, and start time.');
      return;
    }

    const payload = {
      manual_service_name: form.manual_service_name.trim(),
      staff_name: form.staff_name.trim() || undefined,
      client_name: form.client_name.trim(),
      client_email: form.client_email.trim() || undefined,
      client_phone: form.client_phone.trim() || undefined,
      starts_at: fromLocalInputValue(form.starts_at),
      ends_at: form.ends_at ? fromLocalInputValue(form.ends_at) : undefined,
      notes: form.notes.trim() || undefined,
      status: editBookingId ? form.status : 'confirmed',
      send_confirmation: !editBookingId ? form.send_confirmation : undefined
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

    if (json.warnings?.length) {
      json.warnings.forEach((warning: string) => feedback.error(warning));
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

  async function resendConfirmation(id: string) {
    if (busyId) return;
    setBusyId(id);
    const res = await fetch(`/api/bookings/${id}/resend-confirmation`, { method: 'POST' });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to resend confirmation.');
      return;
    }
    feedback.success(json.message || 'Confirmation email sent.');
  }

  async function copyDetails(booking: BookingRow) {
    try {
      await navigator.clipboard.writeText(formatBookingDetailsText(booking));
      feedback.success('Booking details copied.');
    } catch {
      feedback.error('Unable to copy booking details.');
    }
  }

  function renderBookingForm(title: string, isEdit: boolean) {
    return (
      <div className="form booking-form" style={{ marginBottom: 18 }}>
        <h3>{title}</h3>
        <label>
          Service or appointment
          <input
            className="input"
            placeholder="Example: Haircut, house cleaning, consultation, estimate visit"
            value={form.manual_service_name}
            onChange={(e) => updateFormField('manual_service_name', e.target.value)}
          />
        </label>
        <label>
          Staff
          <input
            className="input"
            placeholder="Optional"
            value={form.staff_name}
            onChange={(e) => updateFormField('staff_name', e.target.value)}
          />
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
        {isEdit ? (
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
        ) : null}
        <label>
          Notes
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => updateFormField('notes', e.target.value)} />
        </label>
        {!isEdit ? (
          <label className="settings-checkbox-row">
            <input
              type="checkbox"
              checked={form.send_confirmation}
              onChange={(e) => updateFormField('send_confirmation', e.target.checked)}
            />
            Send confirmation to customer
          </label>
        ) : null}
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

      {!schemaMissing ? <BookingShareCard bookingSlug={bookingSlug} /> : null}

      <div className="card">
        {showCreateForm && canManage ? renderBookingForm('New booking', false) : null}
        {loading ? <p>Loading bookings…</p> : null}
        {!loading && !schemaMissing && bookings.length === 0 && !showCreateForm ? (
          <p className="muted">No bookings yet. Create a manual booking or share your public booking page.</p>
        ) : null}

        {bookings.map((booking) => {
          const calendarUrl = googleCalendarEventUrl(booking.google_calendar_event_id);
          const appointmentName = bookingAppointmentName(booking);
          const staffLabel = bookingStaffLabel(booking);
          const calendarLabel = bookingCalendarSyncLabel(booking);

          if (editBookingId === booking.id) {
            return (
              <div key={booking.id} className="list-row booking-row">
                {renderBookingForm('Edit booking', true)}
              </div>
            );
          }

          return (
            <div key={booking.id} className="list-row booking-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{appointmentName}</strong>
                  <span className={`status-pill status-${booking.status}`}>{BOOKING_STATUS_LABELS[booking.status] || booking.status}</span>
                </div>
                <p className="muted" style={{ margin: '6px 0 0' }}>
                  {booking.client_name} · {formatBookingWhen(booking.starts_at, booking.ends_at)}
                </p>
                <p className="muted">
                  Staff: {staffLabel} · {calendarLabel}
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
                <button type="button" className="btn btn-sm" disabled={busyId === booking.id} onClick={() => void copyDetails(booking)}>
                  Copy details
                </button>
                {canManage ? (
                  <>
                    <button type="button" className="btn btn-sm" disabled={busyId === booking.id} onClick={() => openEditForm(booking)}>
                      Edit
                    </button>
                    {booking.client_email ? (
                      <button type="button" className="btn btn-sm" disabled={busyId === booking.id} onClick={() => void resendConfirmation(booking.id)}>
                        Resend confirmation
                      </button>
                    ) : null}
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
