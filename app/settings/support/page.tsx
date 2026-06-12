'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingSupportPromo } from '@/components/onboarding-support-promo';
import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTranslation } from '@/components/locale-provider';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole } from '@/lib/roles';
import { SUPPORT_EMAIL } from '@/lib/support';
import { supabase } from '@/lib/supabase';

export default function SupportTrainingSettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('owner'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/support');
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
      <AppShell plan={plan} role={role}>
        <p>{t('common.loading')}</p>
      </AppShell>
    );
  }

  return (
    <SettingsShell
      plan={plan}
      role={role}
      title={t('supportTraining.settingsTitle')}
      description={t('supportTraining.settingsDescription')}
    >
      <OnboardingSupportPromo variant="settings" />
      <p className="muted">
        {t('supportTraining.settingsEmailNote')}{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </SettingsShell>
  );
}
