'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTranslation } from '@/components/locale-provider';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { busy: saving, runResponse, buttonLabel } = useAsyncAction();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('owner'));
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(false);
  const [sms, setSms] = useState(false);
  const [operational, setOperational] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/notifications');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));

      const res = await fetch('/api/account/privacy');
      if (res.ok) {
        const json = await res.json();
        setEmail(json.email_notifications !== false);
        setPush(Boolean(json.push_notifications));
        setSms(Boolean(json.sms_notifications));
        setOperational(json.operational_notifications !== false);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function save() {
    await runResponse(
      () =>
        fetch('/api/account/privacy', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email_notifications: email,
            push_notifications: push,
            sms_notifications: sms,
            operational_notifications: operational
          })
        }),
      t('settings.notifications.saved')
    );
  }

  if (loading) {
    return (
      <SettingsShell plan={plan} role={role} title={t('settings.notifications.title')} description={t('settings.notifications.description')}>
        <p className="loading-state" role="status">
          {t('common.loading')}
        </p>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell plan={plan} role={role} title={t('settings.notifications.title')} description={t('settings.notifications.description')}>
      <div className="settings-card">
        <label className="settings-toggle">
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
          {t('settings.notifications.email')}
        </label>
        <label className="settings-toggle">
          <input type="checkbox" checked={operational} onChange={(e) => setOperational(e.target.checked)} />
          {t('settings.notifications.operational')}
        </label>
        <label className="settings-toggle">
          <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
          <span>
            {t('settings.notifications.push')}
            <span className="muted">{t('settings.notifications.pushFuture')}</span>
          </span>
        </label>
        <label className="settings-toggle">
          <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} />
          <span>
            {t('settings.notifications.sms')}
            <span className="muted">{t('settings.notifications.smsFuture')}</span>
          </span>
        </label>
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
          {buttonLabel(t('settings.notifications.save'), FEEDBACK.loading)}
        </button>
      </div>
    </SettingsShell>
  );
}
