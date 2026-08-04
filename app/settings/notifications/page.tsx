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
            // Push and SMS delivery are not active yet; keep stored prefs off.
            push_notifications: false,
            sms_notifications: false,
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

  const toggleStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    width: '100%',
    minWidth: 0,
    writingMode: 'horizontal-tb' as const,
    textOrientation: 'mixed' as const
  };

  const toggleTextStyle = {
    display: 'block',
    flex: '1 1 auto',
    minWidth: 0,
    whiteSpace: 'normal' as const,
    wordBreak: 'normal' as const,
    overflowWrap: 'break-word' as const,
    writingMode: 'horizontal-tb' as const,
    textOrientation: 'mixed' as const
  };

  return (
    <SettingsShell plan={plan} role={role} title={t('settings.notifications.title')} description={t('settings.notifications.description')}>
      <div className="settings-card" style={{ display: 'grid', gap: 18, width: '100%', minWidth: 0 }}>
        <label className="settings-toggle" style={toggleStyle}>
          <input
            type="checkbox"
            checked={email}
            onChange={(e) => setEmail(e.target.checked)}
            style={{ flex: '0 0 auto', marginTop: 3 }}
          />
          <span style={toggleTextStyle}>{t('settings.notifications.email')}</span>
        </label>
        <label className="settings-toggle" style={toggleStyle}>
          <input
            type="checkbox"
            checked={operational}
            onChange={(e) => setOperational(e.target.checked)}
            style={{ flex: '0 0 auto', marginTop: 3 }}
          />
          <span style={toggleTextStyle}>{t('settings.notifications.operational')}</span>
        </label>
        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <p className="muted" style={{ margin: 0, whiteSpace: 'normal', overflowWrap: 'break-word' }}>
            {t('settings.notifications.push')}: {t('settings.notifications.pushFuture')}
          </p>
          <p className="muted" style={{ margin: 0, whiteSpace: 'normal', overflowWrap: 'break-word' }}>
            {t('settings.notifications.sms')}: {t('settings.notifications.smsFuture')}
          </p>
        </div>
        <div>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            {buttonLabel(t('settings.notifications.save'), FEEDBACK.loading)}
          </button>
        </div>
      </div>
    </SettingsShell>
  );
}
