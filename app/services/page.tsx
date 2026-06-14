'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { formatServicePrice, type ServiceRecord } from '@/lib/booking';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type WorkerOption = { id: string; name: string };
type StaffServiceRow = { id: string; worker_id: string; service_id: string };

export default function ServicesPage() {
  const router = useRouter();
  const feedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [staffServices, setStaffServices] = useState<StaffServiceRow[]>([]);
  const [bookingSlug, setBookingSlug] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [assignWorkerId, setAssignWorkerId] = useState('');
  const [assignBusy, setAssignBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    category: '',
    description: '',
    duration_minutes: '60',
    price: '0'
  });
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

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

    const res = await fetch('/api/services');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to load services.');
      return;
    }
    setServices(json.services || []);
    setWorkers(json.workers || []);
    setStaffServices(json.staffServices || []);
    setBookingSlug(json.bookingSlug || null);
  }, [feedback, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createService() {
    if (!canManage || creating || !form.name.trim()) {
      if (!form.name.trim()) feedback.error('Service name is required.');
      return;
    }
    setCreating(true);
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        category: form.category,
        description: form.description,
        duration_minutes: Number(form.duration_minutes),
        price_cents: Math.round(Number(form.price || 0) * 100)
      })
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to save service.');
      return;
    }
    feedback.saved();
    setForm({ name: '', category: '', description: '', duration_minutes: '60', price: '0' });
    void load();
  }

  async function updateService(service: ServiceRecord) {
    if (!canManage || savingId) return;
    setSavingId(service.id);
    const res = await fetch(`/api/services/${service.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: service.name,
        category: service.category,
        description: service.description,
        duration_minutes: service.duration_minutes,
        price_cents: service.price_cents,
        is_active: service.is_active
      })
    });
    const json = await res.json();
    setSavingId(null);
    setEditId(null);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to update service.');
      return;
    }
    feedback.saved();
    void load();
  }

  async function toggleActive(service: ServiceRecord) {
    if (!canManage || savingId) return;
    setSavingId(service.id);
    const res = await fetch(`/api/services/${service.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !service.is_active })
    });
    const json = await res.json();
    setSavingId(null);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to update service.');
      return;
    }
    feedback.success(service.is_active ? 'Service deactivated.' : 'Service activated.');
    void load();
  }

  async function deleteService(id: string, name: string) {
    if (!canManage || savingId) return;
    if (!window.confirm(`Remove service "${name}"?`)) return;
    setSavingId(id);
    const res = await fetch(`/api/services/${id}`, { method: 'DELETE' });
    const json = await res.json();
    setSavingId(null);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to remove service.');
      return;
    }
    feedback.deleted();
    void load();
  }

  async function saveStaffAssignment() {
    if (!canManage || assignBusy || !assignWorkerId) return;
    const serviceIds = staffServices.filter((s) => s.worker_id === assignWorkerId).map((s) => s.service_id);
    setAssignBusy(true);
    const res = await fetch('/api/services/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_id: assignWorkerId, service_ids: serviceIds })
    });
    const json = await res.json();
    setAssignBusy(false);
    if (!res.ok) {
      feedback.error(json.error || 'Unable to save staff assignment.');
      return;
    }
    feedback.saved();
  }

  function toggleStaffService(workerId: string, serviceId: string) {
    if (!canManage) return;
    setAssignWorkerId(workerId);
    const exists = staffServices.some((s) => s.worker_id === workerId && s.service_id === serviceId);
    if (exists) {
      setStaffServices((prev) => prev.filter((s) => !(s.worker_id === workerId && s.service_id === serviceId)));
    } else {
      setStaffServices((prev) => [
        ...prev,
        { id: `temp-${workerId}-${serviceId}`, worker_id: workerId, service_id: serviceId }
      ]);
    }
  }

  const bookingUrl = bookingSlug ? `/book/${bookingSlug}` : null;

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <div className="page-header-text">
          <h1>Services</h1>
          <p className="page-subtitle">Manage bookable services, staff assignments, and your public booking page.</p>
        </div>
        <div className="page-header-action" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn" href="/services/availability">
            Availability
          </Link>
          {bookingUrl ? (
            <Link className="btn btn-primary" href={bookingUrl} target="_blank" rel="noopener noreferrer">
              Open booking page
            </Link>
          ) : null}
        </div>
      </header>

      {bookingUrl ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <p className="muted" style={{ margin: 0 }}>
            Public booking link:{' '}
            <Link href={bookingUrl} target="_blank" rel="noopener noreferrer">
              {typeof window !== 'undefined' ? `${window.location.origin}${bookingUrl}` : bookingUrl}
            </Link>
          </p>
        </div>
      ) : null}

      {canManage ? (
        <div className="card form" style={{ marginBottom: 18 }}>
          <h3>Add service</h3>
          <input className="input" placeholder="Service name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <textarea className="input" rows={2} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid-2">
            <label>
              Duration (minutes)
              <input className="input" type="number" min={5} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
            </label>
            <label>
              Price ($)
              <input className="input" type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
          </div>
          <button type="button" className="btn btn-primary" disabled={creating} onClick={() => void createService()}>
            {creating ? FEEDBACK.loading : 'Add service'}
          </button>
        </div>
      ) : null}

      <div className="card">
        <h3>Your services</h3>
        {loading ? <p>Loading services…</p> : null}
        {!loading && services.length === 0 ? (
          <p className="muted">No services yet. Add your first service to start accepting bookings.</p>
        ) : null}
        {!loading &&
          services.map((service) => (
            <div key={service.id} className="list-row" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              {editId === service.id ? (
                <div className="form" style={{ flex: 1, minWidth: 240 }}>
                  <input className="input" value={service.name} onChange={(e) => setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, name: e.target.value } : s)))} />
                  <input className="input" value={service.category || ''} onChange={(e) => setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, category: e.target.value } : s)))} />
                  <textarea className="input" rows={2} value={service.description || ''} onChange={(e) => setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, description: e.target.value } : s)))} />
                  <div className="grid-2">
                    <input className="input" type="number" value={service.duration_minutes} onChange={(e) => setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, duration_minutes: Number(e.target.value) } : s)))} />
                    <input className="input" type="number" step="0.01" value={(service.price_cents / 100).toFixed(2)} onChange={(e) => setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, price_cents: Math.round(Number(e.target.value) * 100) } : s)))} />
                  </div>
                  <button type="button" className="btn btn-primary" disabled={savingId === service.id} onClick={() => void updateService(service)}>
                    {savingId === service.id ? FEEDBACK.loading : 'Save'}
                  </button>
                  <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => setEditId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ flex: 1 }}>
                  <strong>{service.name}</strong>
                  {!service.is_active ? <span className="muted"> · Inactive</span> : null}
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {service.category || 'General'} · {service.duration_minutes} min · {formatServicePrice(service.price_cents)}
                  </p>
                  {service.description ? <p className="muted">{service.description}</p> : null}
                </div>
              )}
              {canManage && editId !== service.id ? (
                <div className="inline-actions">
                  <button type="button" className="btn btn-sm" onClick={() => setEditId(service.id)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-sm" disabled={savingId === service.id} onClick={() => void toggleActive(service)}>
                    {service.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" disabled={savingId === service.id} onClick={() => void deleteService(service.id, service.name)}>
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          ))}
      </div>

      {canManage && workers.length > 0 && services.length > 0 ? (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>Staff service assignment</h3>
          <p className="muted">Choose a team member, tap services they can perform, then save.</p>
          <select className="input" value={assignWorkerId} onChange={(e) => setAssignWorkerId(e.target.value)}>
            <option value="">Select staff member</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          {assignWorkerId ? (
            <div className="booking-chip-row" style={{ marginTop: 12 }}>
              {services
                .filter((s) => s.is_active)
                .map((service) => {
                  const assigned = staffServices.some(
                    (row) => row.worker_id === assignWorkerId && row.service_id === service.id
                  );
                  return (
                    <button
                      key={service.id}
                      type="button"
                      className={`booking-chip${assigned ? ' booking-chip-active' : ''}`}
                      onClick={() => toggleStaffService(assignWorkerId, service.id)}
                    >
                      {service.name}
                    </button>
                  );
                })}
            </div>
          ) : null}
          {assignWorkerId ? (
            <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} disabled={assignBusy} onClick={() => void saveStaffAssignment()}>
              {assignBusy ? FEEDBACK.loading : 'Save staff services'}
            </button>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
