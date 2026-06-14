'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import type { StaffAvailabilityRecord } from '@/lib/booking/types';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ServicesAvailabilityPage() {
  const router = useRouter();
  const feedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StaffAvailabilityRecord[]>([]);
  const [workers, setWorkers] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    worker_id: '',
    day_of_week: '1',
    starts_at: '09:00',
    ends_at: '17:00',
    buffer_minutes: '0',
    max_bookings: '20'
  });

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

    const res = await fetch('/api/services/availability');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to load availability.');
      return;
    }
    setRows(json.availability || []);
    setWorkers(json.workers || []);
  }, [feedback, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addAvailability() {
    if (!canManage || saving || !form.worker_id) {
      if (!form.worker_id) feedback.error('Select a staff member.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/services/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worker_id: form.worker_id,
        day_of_week: Number(form.day_of_week),
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        buffer_minutes: Number(form.buffer_minutes),
        max_bookings: Number(form.max_bookings)
      })
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to save availability.');
      return;
    }
    feedback.saved();
    void load();
  }

  async function toggleRow(row: StaffAvailabilityRecord) {
    if (!canManage || saving) return;
    setSaving(true);
    const res = await fetch(`/api/services/availability/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !row.is_active })
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to update availability.');
      return;
    }
    feedback.saved();
    void load();
  }

  async function removeRow(id: string) {
    if (!canManage || saving) return;
    if (!window.confirm('Remove this availability block?')) return;
    setSaving(true);
    const res = await fetch(`/api/services/availability/${id}`, { method: 'DELETE' });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to remove availability.');
      return;
    }
    feedback.deleted();
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <div className="page-header-text">
          <h1>Staff availability</h1>
          <p className="page-subtitle">Set when each team member can accept bookings.</p>
        </div>
        <Link className="btn" href="/services">
          Back to services
        </Link>
      </header>

      {canManage ? (
        <div className="card form" style={{ marginBottom: 18 }}>
          <h3>Add availability</h3>
          <select className="input" value={form.worker_id} onChange={(e) => setForm({ ...form, worker_id: e.target.value })}>
            <option value="">Staff member</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <select className="input" value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
            {DAYS.map((label, index) => (
              <option key={label} value={String(index)}>
                {label}
              </option>
            ))}
          </select>
          <div className="grid-2">
            <label>
              Start
              <input className="input" type="time" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </label>
            <label>
              End
              <input className="input" type="time" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </label>
          </div>
          <div className="grid-2">
            <label>
              Buffer (minutes)
              <input className="input" type="number" min={0} value={form.buffer_minutes} onChange={(e) => setForm({ ...form, buffer_minutes: e.target.value })} />
            </label>
            <label>
              Max bookings / day
              <input className="input" type="number" min={1} value={form.max_bookings} onChange={(e) => setForm({ ...form, max_bookings: e.target.value })} />
            </label>
          </div>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void addAvailability()}>
            {saving ? FEEDBACK.loading : 'Save availability'}
          </button>
        </div>
      ) : null}

      <div className="card">
        <h3>Schedule blocks</h3>
        {loading ? <p>Loading…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="muted">No availability set yet. Add hours for each stylist or staff member.</p>
        ) : null}
        {rows.map((row) => {
          const worker = workers.find((w) => w.id === row.worker_id);
          return (
            <div key={row.id} className="list-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>{worker?.name || 'Staff'}</strong>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {DAYS[row.day_of_week]} · {String(row.starts_at).slice(0, 5)} – {String(row.ends_at).slice(0, 5)} · buffer{' '}
                  {row.buffer_minutes}m · max {row.max_bookings}
                  {!row.is_active ? ' · Inactive' : ''}
                </p>
              </div>
              {canManage ? (
                <div className="inline-actions">
                  <button type="button" className="btn btn-sm" disabled={saving} onClick={() => void toggleRow(row)}>
                    {row.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" disabled={saving} onClick={() => void removeRow(row.id)}>
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
