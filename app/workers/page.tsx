'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LocalizedEmptyState } from '@/components/localized-empty-state';
import { friendlyErrorMessage } from '@/lib/user-errors';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { crewLimitReached, limitMessage } from '@/lib/everittos-usage';
import { isManagerRole, normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Worker = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
};

export default function WorkersPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [canManage, setCanManage] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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

    const { data } = await supabase.from('workers').select('id, name, role, phone').order('created_at', { ascending: false });
    setWorkers(data || []);
    setLoading(false);
  }

  async function addWorker() {
    if (!name.trim() || saving) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    const userPlan = normalizePlan(profile?.plan);
    if (!limitsForPlan(userPlan).crewAssignment) {
      setMessage('Workers and crew assignment require the Business plan.');
      return;
    }
    if (crewLimitReached(userPlan, workers.length)) {
      setMessage(limitMessage('crewMembers', userPlan));
      return;
    }

    setSaving(true);
    setMessage('');

    const { error } = await supabase.from('workers').insert({
      user_id: user.id,
      name: name.trim(),
      role: role.trim() || null,
      phone: phone.trim() || null
    });

    setSaving(false);

    if (error) {
      if (error.message.includes('PLAN_LIMIT_CREW')) {
        setMessage('Workers and crew assignment require the Business plan.');
      } else {
        setMessage(error.message);
      }
      return;
    }

    setName('');
    setRole('');
    setPhone('');
    loadWorkers();
  }

  useEffect(() => {
    loadWorkers();
  }, []);

  return (
    <AppShell plan={plan}>
        <h1>Workers</h1>
        <p className="muted">Crew members linked to your operation.</p>

        {message ? (
          <p className="auth-message auth-message-error" role="alert">
            {friendlyErrorMessage(message)}
          </p>
        ) : null}

        {canManage && limitsForPlan(plan).crewAssignment && (
          <div className="card form" style={{ marginTop: 20 }}>
            <h3>Add worker</h3>
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

        {canManage && !limitsForPlan(plan).crewAssignment && (
          <div className="card" style={{ marginTop: 20 }}>
            <p>Workers and crew assignment are available on the Business plan.</p>
          </div>
        )}

        <div className="grid-3" style={{ marginTop: 20 }}>
          {loading ? <p className="loading-state" role="status">Loading workers…</p> : null}
          {!loading && workers.length === 0 ? (
            <LocalizedEmptyState emptyKey="workers" />
          ) : null}
          {!loading &&
            workers.map((worker) => (
              <div className="card" key={worker.id}>
                <h3>{worker.name}</h3>
                <p>{worker.role || 'Crew member'}</p>
                <p>{worker.phone || 'No phone'}</p>
              </div>
            ))}
        </div>
    </AppShell>
  );
}
