'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlanLockedMessage } from '@/components/plan-locked-message';
import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useAppFeedback } from '@/components/feedback/use-app-feedback';
import { useTranslation } from '@/components/locale-provider';
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

const copy = {
  en: {
    loading: 'Loading departments...',
    description: 'Group people by department on Growth and Enterprise plans.',
    createTitle: 'Create department',
    namePlaceholder: 'Department name',
    createButton: 'Create department',
    noDescription: 'No description',
    members: 'Members:',
    memberEmail: 'Member email',
    addMember: 'Add member',
    userNotFound: 'No user found with that email in EverittOS.'
  },
  es: {
    loading: 'Cargando departamentos...',
    description: 'Agrupe personas por departamento en los planes Growth y Enterprise.',
    createTitle: 'Crear departamento',
    namePlaceholder: 'Nombre del departamento',
    createButton: 'Crear departamento',
    noDescription: 'Sin descripción',
    members: 'Miembros:',
    memberEmail: 'Correo del miembro',
    addMember: 'Agregar miembro',
    userNotFound: 'No se encontró un usuario con ese correo en EverittOS.'
  },
  vi: {
    loading: 'Đang tải phòng ban...',
    description: 'Nhóm người theo phòng ban trên các gói Growth và Enterprise.',
    createTitle: 'Tạo phòng ban',
    namePlaceholder: 'Tên phòng ban',
    createButton: 'Tạo phòng ban',
    noDescription: 'Không có mô tả',
    members: 'Thành viên:',
    memberEmail: 'Email thành viên',
    addMember: 'Thêm thành viên',
    userNotFound: 'Không tìm thấy người dùng với email đó trong EverittOS.'
  }
} as const;

export default function DepartmentsSettingsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = copy[locale] || copy.en;
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
      feedback.error(c.userNotFound);
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
        <p>{c.loading}</p>
      </AppShell>
    );
  }

  const title = t('settingsNav.departments');

  return (
    <SettingsShell plan={plan} title={title} description={c.description}>
      {!limitsForPlan(plan).multiLocation ? <PlanLockedMessage feature={title} requiredPlan="Growth" /> : null}

      {limitsForPlan(plan).multiLocation && canManage ? (
        <div className="settings-card form">
          <h3>{c.createTitle}</h3>
          <input className="input" placeholder={c.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void createDepartment()}>
            {buttonLabel(c.createButton, FEEDBACK.loading)}
          </button>
        </div>
      ) : null}

      {departments.map((dept) => (
        <div key={dept.id} className="settings-card">
          <h3>{dept.name}</h3>
          <p className="muted">{dept.description || c.noDescription}</p>
          <p className="muted">
            {c.members} {dept.department_memberships?.length || 0}
          </p>
          {canManage ? (
            <div className="inline-actions">
              <input
                className="input"
                placeholder={c.memberEmail}
                value={selectedDept === dept.id ? memberEmail : ''}
                onFocus={() => setSelectedDept(dept.id)}
                onChange={(e) => {
                  setSelectedDept(dept.id);
                  setMemberEmail(e.target.value);
                }}
              />
              <button type="button" className="btn" disabled={busy} onClick={() => void addMember(dept.id)}>
                {buttonLabel(c.addMember, FEEDBACK.loading)}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </SettingsShell>
  );
}
