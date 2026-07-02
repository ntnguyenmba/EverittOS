'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { PageHeader } from '@/components/page-header';
import { isLowStock } from '@/lib/inventory';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canSeeOrgWideData } from '@/lib/permissions';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type InventoryRow = {
  id: string;
  name: string;
  category: string | null;
  item_type: string;
  quantity: number;
  unit: string | null;
  reorder_level: number | null;
  location: string | null;
  vendor: string | null;
  notes: string | null;
};

const EMPTY_FORM = {
  name: '',
  category: '',
  quantity: '0',
  unit: '',
  reorder_level: '',
  location: '',
  vendor: '',
  notes: ''
};

export default function InventoryPage() {
  const router = useRouter();
  const appFeedback = useAppFeedback();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [adjustingId, setAdjustingId] = useState('');
  const [adjustQty, setAdjustQty] = useState('');

  const canManage = isManagerRole(role);
  const hasAccess = canSeeOrgWideData(role);

  const load = useCallback(async () => {
    const res = await fetch('/api/inventory');
    const json = await res.json();
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to load inventory.');
      return;
    }
    if (json.schemaReady === false) {
      setSchemaReady(false);
      setItems([]);
      return;
    }
    setSchemaReady(true);
    setItems(json.items || []);
  }, [appFeedback]);

  useEffect(() => {
    async function init() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/inventory');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const org = await fetchOrganizationContext(user.id);
      const workspaceRole = normalizeRole(org?.role || profile?.role);
      setPlan(normalizePlan(profile?.plan));
      setRole(workspaceRole);
      if (!canSeeOrgWideData(workspaceRole)) {
        router.push('/dashboard');
        return;
      }
      setLoading(false);
      await load();
    }
    void init();
  }, [router, load]);

  async function createItem() {
    setSaving(true);
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to create item.');
      return;
    }
    appFeedback.saved();
    setShowForm(false);
    setForm(EMPTY_FORM);
    void load();
  }

  async function adjustItem(itemId: string) {
    const delta = Number(adjustQty);
    if (!Number.isFinite(delta) || delta === 0) return;
    setAdjustingId(itemId);
    const res = await fetch(`/api/inventory/${itemId}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustment_type: delta > 0 ? 'purchase' : 'used', quantity_delta: delta })
    });
    const json = await res.json();
    setAdjustingId('');
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to adjust quantity.');
      return;
    }
    setAdjustQty('');
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <PageHeader
        title="Inventory"
        subtitle="Track supplies and equipment. Adjustments update quantity and keep an audit trail."
      />

      {!hasAccess ? <p className="muted">You do not have access to inventory.</p> : null}
      {!schemaReady ? (
        <div className="card">
          <p className="muted">Inventory tables are not set up yet. Run the latest Supabase migrations, then refresh.</p>
        </div>
      ) : null}

      {hasAccess && schemaReady ? (
        <div className="card">
          {canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)} style={{ marginBottom: 12 }}>
              {showForm ? 'Close' : 'Add item'}
            </button>
          ) : null}

          {showForm && canManage ? (
            <div style={{ marginBottom: 16 }}>
              <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ marginTop: 8 }} />
              <input className="input" type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} style={{ marginTop: 8 }} />
              <input className="input" placeholder="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} style={{ marginTop: 8 }} />
              <input className="input" type="number" placeholder="Reorder level" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} style={{ marginTop: 8 }} />
              <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} disabled={saving} onClick={() => void createItem()}>
                {saving ? 'Saving…' : 'Save item'}
              </button>
            </div>
          ) : null}

          {loading ? <p className="muted">Loading inventory…</p> : null}
          {!loading && items.length === 0 ? <p className="muted">No inventory items yet.</p> : null}
          {!loading && items.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Reorder</th>
                  <th>Location</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.name}
                      {isLowStock(item) ? <span className="muted"> · Low stock</span> : null}
                    </td>
                    <td>
                      {item.quantity} {item.unit || ''}
                    </td>
                    <td>{item.reorder_level ?? '—'}</td>
                    <td>{item.location || '—'}</td>
                    <td>
                      {canManage ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input className="input" type="number" placeholder="+/-" value={adjustingId === item.id ? adjustQty : ''} onChange={(e) => { setAdjustingId(item.id); setAdjustQty(e.target.value); }} />
                          <button type="button" className="btn btn-sm" disabled={adjustingId === item.id && !adjustQty} onClick={() => void adjustItem(item.id)}>
                            Adjust
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
