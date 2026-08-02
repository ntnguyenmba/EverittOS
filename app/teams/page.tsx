'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type Team = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  active: boolean;
  created_at: string | null;
};

export default function TeamsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [canManage, setCanManage] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?next=/teams');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
    const userRole = normalizeRole(profile?.role);
    setPlan(normalizePlan(profile?.plan));
    setRole(userRole);
    setCanManage(isManagerRole(userRole));

    const res = await fetch('/api/teams');
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(json.error || 'Unable to load teams.');
      return;
    }
    setTeams(json.teams || []);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTeam() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, color })
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(json.error || 'Unable to create team.');
      return;
    }
    setName('');
    setDescription('');
    setColor('');
    setMessage('Team created.');
    void load();
  }

  return (
    <AppShell plan={plan} role={role}>
      <div className="page-head">
        <div>
          <h1>Teams</h1>
          <p className="muted">Create departments and crews such as Office, Sales, Exterior Crew, Interior Crew, Estimating, or Subcontractors.</p>
        </div>
      </div>

      {canManage ? (
        <div className="card form" style={{ marginTop: 18 }}>
          <h3>Create team</h3>
          <input className="input" placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="input" placeholder="Color label, optional" value={color} onChange={(e) => setColor(e.target.value)} />
          <button className="btn btn-primary" type="button" disabled={saving || !name.trim()} onClick={() => void createTeam()}>
            {saving ? 'Saving...' : 'Create team'}
          </button>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 18 }}>
          <p className="muted">Only owners, admins, and managers can create or manage teams.</p>
        </div>
      )}

      {message ? <p className="auth-message" style={{ marginTop: 18 }}>{message}</p> : null}

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Active teams</h3>
        {loading ? <p className="loading-state">Loading teams...</p> : null}
        {!loading && teams.length === 0 ? <p className="muted">No teams yet.</p> : null}
        {teams.map((team) => (
          <div key={team.id} className="list-row">
            <div>
              <strong>{team.name}</strong>
              <p className="muted">{team.description || 'No description'}</p>
              <p className="muted">{team.active ? 'Active' : 'Inactive'}{team.color ? ` · ${team.color}` : ''}</p>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
