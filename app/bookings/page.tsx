'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import {
  BOOKING_STATUS_LABELS,
  formatBookingWhen,
  formatServicePrice,
  googleCalendarEventUrl,
  type BookingRecord
} from '@/lib/booking';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type BookingRow = BookingRecord & {
  services?: { name: string; duration_minutes: number; price_cents: number } | null;
  workers?: { name: string } | null;
};

export default function BookingsPage() {
  const router = useRouter();
  const feedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesEditId, setNotesEditId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

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
      feedback.error(json.error || 'Unable to load bookings.');
      return;
    }
    setBookings(json.bookings || []);
  }, [feedback, router]);

  useEffect(() => {
    void load();
  }, [load]);

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
    setNotesEditId(null);
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <div className="page-header-text">
          <h1>Bookings</h1>
          <p className="page-subtitle">Upcoming appointments from your public booking page and manual entries.</p>
        </div>
        <Link className="btn" href="/services">
          Manage services
        </Link>
      </header>

      <div className="card">
        {loading ? <p>Loading bookings…</p> : null}
        {!loading && bookings.length === 0 ? (
          <p className="muted">No bookings yet. Add services and share your booking page.</p>
        ) : null}

        {bookings.map((booking) => {
          const calendarUrl = googleCalendarEventUrl(booking.google_calendar_event_id);
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
                {notesEditId === booking.id ? (
                  <div className="form" style={{ marginTop: 8 }}>
                    <textarea className="input" rows={2} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} />
                    <button type="button" className="btn btn-primary btn-sm" disabled={busyId === booking.id} onClick={() => void patchBooking(booking.id, { notes: notesDraft }, 'Notes saved.')}>
                      Save notes
                    </button>
                  </div>
                ) : booking.notes ? (
                  <p className="muted">{booking.notes}</p>
                ) : null}
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
                    <button type="button" className="btn btn-sm" disabled={busyId === booking.id} onClick={() => { setNotesEditId(booking.id); setNotesDraft(booking.notes || ''); }}>
                      Edit notes
                    </button>
                    {booking.status !== 'completed' ? (
                      <button type="button" className="btn btn-sm" disabled={busyId === booking.id} onClick={() => void patchBooking(booking.id, { status: 'completed' }, 'Marked completed.')}>
                        Mark completed
                      </button>
                    ) : null}
                    {booking.status !== 'cancelled' ? (
                      <button type="button" className="btn btn-sm btn-danger" disabled={busyId === booking.id} onClick={() => void patchBooking(booking.id, { status: 'cancelled' }, 'Booking cancelled.')}>
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
