'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlanLockedMessage } from '@/components/plan-locked-message';
import { SettingsShell } from '@/components/settings/settings-shell';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { supabase } from '@/lib/supabase';

type Department = {
  id: string;
  name: string;
  description: string | null;
  department_memberships?: { user_id: string }[];
};

export default function DepartmentsSettingsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [name, setName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?next=/settings/departments');
      return;
    }
    const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).maybeSingle();
    setPlan(normalizePlan(profile?.plan));
    const res = await fetch('/api/departments');
    const json = await res.json();
    setCanManage(Boolean(json.canManage));
    setDepartments(json.departments || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [router]);

  async function createDepartment() {
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || 'Unable to create department.');
      return;
    }
    setName('');
    load();
  }

  async function addMember(departmentId: string) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', memberEmail.trim()).maybeSingle();
    if (!profile?.id) {
      setMessage('No user found with that email in EverittOS.');
      return;
    }
    const res = await fetch(`/api/departments/${departmentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.id, action: 'add' })
    });
    const json = await res.json();
    if (!res.ok) setMessage(json.error || 'Unable to add member.');
    else {
      setMemberEmail('');
      load();
    }
  }

  if (loading) {
    return (
      <div className="dashboard-shell">
        <main className="main">
          <p>Loading departments...</p>
        </main>
      </div>
    );
  }

  return (
    <SettingsShell plan={plan} title="Departments" description="Organize teams and visibility for Growth and Enterprise.">
      {!limitsForPlan(plan).multiLocation ? <PlanLockedMessage feature="Departments" requiredPlan="Growth" /> : null}

      {limitsForPlan(plan).multiLocation && canManage ? (
        <div className="settings-card form">
          <h3>Create department</h3>
          <input className="input" placeholder="Department name" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" className="btn btn-primary" onClick={createDepartment}>
            Create department
          </button>
        </div>
      ) : null}

      {departments.map((dept) => (
        <div key={dept.id} className="settings-card">
          <h3>{dept.name}</h3>
          <p className="muted">{dept.description || 'No description'}</p>
          <p className="muted">Members: {dept.department_memberships?.length || 0}</p>
          {canManage ? (
            <div className="inline-actions">
              <input
                className="input"
                placeholder="Member email"
                value={selectedDept === dept.id ? memberEmail : ''}
                onFocus={() => setSelectedDept(dept.id)}
                onChange={(e) => {
                  setSelectedDept(dept.id);
                  setMemberEmail(e.target.value);
                }}
              />
              <button type="button" className="btn" onClick={() => addMember(dept.id)}>
                Add member
              </button>
            </div>
          ) : null}
        </div>
      ))}

      {message ? <p>{message}</p> : null}
    </SettingsShell>
  );
}
