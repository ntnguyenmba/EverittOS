'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { useTranslation } from '@/components/locale-provider';
import { ActionFeedbackBanner } from '@/components/action-feedback';
import { errorFeedback, successFeedback, type ActionFeedback } from '@/lib/action-messages';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { crewLimitReached, limitMessage } from '@/lib/everittos-usage';
import { filterDemoSeedWorkers } from '@/lib/demo-seed-filter';
import { fetchOrganizationContext } from '@/lib/organization';
import { fetchOrganizationIsDemo } from '@/lib/organization-is-demo';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { ensureOrganizationForUser } from '@/lib/workspace-client';

type Worker = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
};

export default function WorkersPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [canManage, setCanManage] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  async function loadWorkers() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    setPlan(normalizePlan(profile?.plan));
    setCanManage(isManagerRole(normalizeRole(profile?.role)));

    const org = await fetchOrganizationContext(user.id);
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

  async function addWorker() {
    if (!name.trim() || saving) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?next=/workers');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    const userPlan = normalizePlan(profile?.plan);
    if (!limitsForPlan(userPlan).crewAssignment) {
      setFeedback(errorFeedback('Workers and crew assignment require the Business plan.'));
      return;
    }
    if (crewLimitReached(userPlan, workers.length)) {
      setFeedback(errorFeedback(limitMessage('crewMembers', userPlan)));
      return;
    }

    setSaving(true);
    setFeedback(null);

    const org = await ensureOrganizationForUser(user.id);
    if (!org?.organizationId) {
      setSaving(false);
      setFeedback(errorFeedback('Workspace setup is still finishing. Refresh and try again.'));
      return;
    }
    const res = await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), role: role.trim() || null, phone: phone.trim() || null })
    });

    setSaving(false);

    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setFeedback(errorFeedback(json.error || 'Unable to save worker.'));
      return;
    }

    setFeedback(successFeedback('Worker saved.'));
    setName('');
    setRole('');
    setPhone('');
    loadWorkers();
  }

  useEffect(() => {
    loadWorkers();
  }, []);

  const crewEnabled = limitsForPlan(plan).crewAssignment;

  return (
    <AppShell plan={plan}>
      <h1>{t('nav.workers')}</h1>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {canManage && crewEnabled && (
        <div className="card form" style={{ marginTop: 20 }}>
          <h3 className="card-title-sm">Add worker</h3>
          <label htmlFor="worker-name">Name</label>
          <input id="worker-name" className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="worker-role">Role</label>
          <input id="worker-role" className="input" placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} />
          <label htmlFor="worker-phone">Phone</label>
          <input id="worker-phone" className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="btn btn-primary" type="button" onClick={addWorker} disabled={saving}>
            {saving ? 'Saving...' : 'Save worker'}
          </button>
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
            </div>
          ))}
      </div>
    </AppShell>
  );
}
