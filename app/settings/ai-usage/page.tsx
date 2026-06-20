'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AiUsagePanel } from '@/components/ai-usage-panel';
import { StaffAiUsagePanel } from '@/components/staff-ai-usage-panel';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTranslation } from '@/components/locale-provider';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageBilling, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

export default function AiUsageSettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/ai-usage');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));
      setLoading(false);
    }

    void load();
  }, [router]);

  if (loading) {
    return (
      <SettingsShell plan={plan} role={role} title={t('aiUsage.title')} description={t('aiUsage.description')}>
        <p>{t('billing.health.loading')}</p>
      </SettingsShell>
    );
  }

  if (!canManageBilling(role)) {
    return (
      <SettingsShell plan={plan} role={role} title={t('aiUsage.title')} description={t('aiUsage.description')}>
        <div className="settings-card">
          <p>{t('aiUsage.adminOnly')}</p>
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell plan={plan} role={role} title={t('aiUsage.title')} description={t('aiUsage.description')}>
      <div className="settings-card">
        <AiUsagePanel plan={plan} />
      </div>
      <div className="settings-card">
        <StaffAiUsagePanel />
      </div>
    </SettingsShell>
  );
}
