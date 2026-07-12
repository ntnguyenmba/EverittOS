'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlanLockedMessage } from '@/components/plan-locked-message';
import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
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
  const feedback = useAppFeedback();
  const { busy, runResponse, buttonLabel } = useAsyncAction();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [name, setName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
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
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDepartment() {
    const res = await runResponse(
      () =>
        fetch('/api/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        }),
      'created'
    );
    if (!res) return;
    setName('');
    void load();
  }

  async function addMember(departmentId: string) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', memberEmail.trim()).maybeSingle();
    if (!profile?.id) {
      feedback.error('No user found with that email in EverittOS.');
      return;
    }
    const res = await runResponse(
      () =>
        fetch(`/api/departments/${departmentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: profile.id, action: 'add' })
        }),
      'updated'
    );
    if (!res) return;
    setMemberEmail('');
    void load();
  }

  if (loading) {
    return (
      <AppShell plan={plan}>
        <p>Loading departments...</p>
      </AppShell>
    );
  }

  return (
    <SettingsShell plan={plan} title="Departments" description="Group people by department on Growth and Enterprise plans.">
      {!limitsForPlan(plan).multiLocation ? <PlanLockedMessage feature="Departments" requiredPlan="Growth" /> : null}

      {limitsForPlan(plan).multiLocation && canManage ? (
        <div className="settings-card form">
          <h3>Create department</h3>
          <input className="input" placeholder="Department name" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createDepartment()}>
            {buttonLabel('Create department', FEEDBACK.loading)}
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
              <button type="button" className="btn" disabled={busy} onClick={() => void addMember(dept.id)}>
                {buttonLabel('Add member', FEEDBACK.loading)}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </SettingsShell>
  );
}
