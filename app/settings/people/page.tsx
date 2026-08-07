'use client';

import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { TeamManagementPanel } from '@/components/team/team-management-panel';
import { EverittteamAiUsagePanel } from '@/components/team/everittteam-ai-usage-panel';
import { useTranslation } from '@/components/locale-provider';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const copy = {
  en: {
    loading: 'Loading team settings...',
    description: 'Invite team members and manage roles.'
  },
  es: {
    loading: 'Cargando configuración del equipo...',
    description: 'Invite a miembros del equipo y administre roles.'
  },
  vi: {
    loading: 'Đang tải cài đặt nhóm...',
    description: 'Mời thành viên nhóm và quản lý vai trò.'
  }
} as const;

export default function SettingsPeoplePage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = copy[locale] || copy.en;
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/people');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const org = await fetchOrganizationContext(user.id);
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(org?.role || profile?.role));
      setLoading(false);
    }
    void load();
  }, [router]);

  if (loading) {
    return (
      <AppShell plan={plan} role={role}>
        <p>{c.loading}</p>
      </AppShell>
    );
  }

  return (
    <SettingsShell plan={plan} role={role} title={t('settingsNav.team')} description={c.description}>
      <EverittteamAiUsagePanel />
      <TeamManagementPanel showPermissionMatrix showAuditHistory={false} />
    </SettingsShell>
  );
}
