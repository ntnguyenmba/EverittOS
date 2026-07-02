'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { useTranslation } from '@/components/locale-provider';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { FEEDBACK } from '@/lib/feedback-labels';
import { limitsForPlan } from '@/lib/everittos-limits';
import { validatePlanAction } from '@/lib/plan-validate';
import { filterDemoSeedWorkers } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { RecordActions } from '@/components/record-actions';
import { useWorkspacePlan } from '@/hooks/use-workspace-plan';
import { supabase } from '@/lib/supabase';

type Worker = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
};

export default function WorkersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const appFeedback = useAppFeedback();
  const { plan: workspacePlan, role: workspaceRole, loading: planLoading } = useWorkspacePlan();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadWorkers() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const org = await fetchOrganizationContext(user.id);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    setCanManage(isManagerRole(normalizeRole(org?.role || workspaceRole || profile?.role)));
    let query = supabase.from('workers').select('id, name, role, phone').order('created_at', { ascending: false });
    if (org?.organizationId) {
      query = query.eq('organization_id', org.organizationId);
    } else {
      query = query.eq('user_id', user.id);
    }

    const [{ data }, orgIsDemo] = await Promise.all([
      query,
      fetchOrganizationIsDemo(supabase, org?.organizationId)
    ]);
    setWorkers(filterDemoSeedWorkers(data || [], orgIsDemo));
    setLoading(false);
  }

  async function saveWorker() {
    if (!name.trim() || saving) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?next=/workers');
      return;
    }

    const effectivePlan = workspacePlan ?? 'free';
    if (!editingId) {
      const preflight = validatePlanAction({
        plan: effectivePlan,
        resource: 'workers',
        currentCount: workers.length
      });
      if (!preflight.allowed) {
        appFeedback.error(preflight.message || 'Unable to save worker.');
        return;
      }
    }

    setSaving(true);

    const url = editingId ? `/api/workers/${editingId}` : '/api/workers';
    const method = editingId ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), role: role.trim() || null, phone: phone.trim() || null })
    });

    const json = (await res.json()) as { error?: string };
    setSaving(false);

    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to save worker.');
      return;
    }

    if (editingId) {
      appFeedback.updated();
    } else {
      appFeedback.created();
    }
    setName('');
    setRole('');
    setPhone('');
    setEditingId(null);
    loadWorkers();
  }

  function startEdit(worker: Worker) {
    setEditingId(worker.id);
    setName(worker.name);
    setRole(worker.role || '');
    setPhone(worker.phone || '');
  }

  async function removeWorker(worker: Worker) {
    if (removingId) return;
    if (!window.confirm(`Remove ${worker.name}?`)) return;
    setRemovingId(worker.id);
    const res = await fetch(`/api/workers/${worker.id}`, { method: 'DELETE' });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setRemovingId(null);
    if (!res.ok) {
      appFeedback.error(json.error || 'Unable to remove worker.');
      return;
    }
    appFeedback.label('removed');
    loadWorkers();
  }

  useEffect(() => {
    loadWorkers();
  }, []);

  const plan = workspacePlan ?? 'free';
  const crewEnabled = limitsForPlan(plan).crewAssignment;

  return (
    <AppShell>
      <h1>{t('nav.workers')}</h1>

      {canManage && crewEnabled && (
        <div className="card form" style={{ marginTop: 20 }}>
          <h3 className="card-title-sm">{editingId ? 'Edit worker' : 'Add worker'}</h3>
          <label htmlFor="worker-name">Name</label>
          <input id="worker-name" className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="worker-role">Role</label>
          <input id="worker-role" className="input" placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} />
          <label htmlFor="worker-phone">Phone</label>
          <input id="worker-phone" className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="btn btn-primary" type="button" onClick={() => void saveWorker()} disabled={saving}>
            {saving ? FEEDBACK.loading : editingId ? 'Save changes' : 'Save worker'}
          </button>
          {editingId ? (
            <button
              type="button"
              className="btn"
              style={{ marginLeft: 8 }}
              onClick={() => {
                setEditingId(null);
                setName('');
                setRole('');
                setPhone('');
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      )}

      {canManage && !crewEnabled && (
        <div className="card plan-gate-card" style={{ marginTop: 20 }}>
          <p>{t('empty.workers.description')}</p>
          <Link href="/settings/billing?upgrade=business" className="btn btn-primary">
            Upgrade to Business
          </Link>
        </div>
      )}

      <div className="workers-grid" style={{ marginTop: 20 }}>
        {loading ? <p className="loading-state" role="status">Loading workers…</p> : null}
        {!loading && workers.length === 0 ? (
          <LocalizedEmptyState emptyKey="workers" href={crewEnabled ? '/team' : '/settings/billing?upgrade=business'} />
        ) : null}
        {!loading &&
          workers.map((worker) => (
            <div className="card worker-card" key={worker.id}>
              <h3 className="card-title-sm">{worker.name}</h3>
              <p className="muted">{worker.role || 'Crew member'}</p>
              <p className="muted">{worker.phone || 'No phone'}</p>
              {canManage && crewEnabled ? (
                <RecordActions
                  onEdit={() => startEdit(worker)}
                  onRemove={() => void removeWorker(worker)}
                />
              ) : null}
            </div>
          ))}
      </div>
    </AppShell>
  );
}
