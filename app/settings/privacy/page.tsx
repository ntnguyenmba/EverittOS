'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTranslation } from '@/components/locale-provider';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

type PrivacyState = {
  marketing_emails: boolean;
  product_updates: boolean;
  operational_notifications: boolean;
  do_not_sell: boolean;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
};

export default function PrivacySettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('owner'));
  const [prefs, setPrefs] = useState<PrivacyState>({
    marketing_emails: false,
    product_updates: true,
    operational_notifications: true,
    do_not_sell: false,
    terms_accepted_at: null,
    privacy_accepted_at: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/privacy');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));

      const res = await fetch('/api/account/privacy');
      if (res.ok) {
        const json = await res.json();
        setPrefs({
          marketing_emails: Boolean(json.marketing_emails),
          product_updates: json.product_updates !== false,
          operational_notifications: json.operational_notifications !== false,
          do_not_sell: Boolean(json.do_not_sell),
          terms_accepted_at: json.terms_accepted_at || null,
          privacy_accepted_at: json.privacy_accepted_at || null
        });
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function save() {
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/account/privacy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketing_emails: prefs.marketing_emails,
        product_updates: prefs.product_updates,
        operational_notifications: prefs.operational_notifications,
        do_not_sell: prefs.do_not_sell
      })
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json();
      setMessage(json.error || t('settings.privacy.saveError'));
      return;
    }
    setMessage(t('settings.privacy.saved'));
  }

  async function exportData() {
    setExporting(true);
    setMessage('');
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) {
        const json = await res.json();
        setMessage(json.error || t('settings.privacy.exportError'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `everittos-export-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(t('settings.privacy.exportSuccess'));
    } catch {
      setMessage(t('settings.privacy.exportError'));
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <SettingsShell plan={plan} role={role} title={t('settings.privacy.title')} description={t('settings.privacy.description')}>
        <p className="loading-state" role="status">
          {t('common.loading')}
        </p>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell plan={plan} role={role} title={t('settings.privacy.title')} description={t('settings.privacy.description')}>
      <div className="settings-card">
        <h3>{t('settings.privacy.disclosureTitle')}</h3>
        <p className="muted">{t('settings.privacy.disclosureBody')}</p>
        <ul className="privacy-list muted">
          <li>{t('settings.privacy.collectProfile')}</li>
          <li>{t('settings.privacy.collectOperations')}</li>
          <li>{t('settings.privacy.collectActivity')}</li>
          <li>{t('settings.privacy.retention')}</li>
        </ul>
      </div>

      <div className="settings-card" style={{ marginTop: 18 }}>
        <h3>{t('settings.privacy.preferencesTitle')}</h3>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={prefs.marketing_emails}
            onChange={(e) => setPrefs((p) => ({ ...p, marketing_emails: e.target.checked }))}
          />
          {t('settings.privacy.marketingEmails')}
        </label>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={prefs.product_updates}
            onChange={(e) => setPrefs((p) => ({ ...p, product_updates: e.target.checked }))}
          />
          {t('settings.privacy.productUpdates')}
        </label>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={prefs.operational_notifications}
            onChange={(e) => setPrefs((p) => ({ ...p, operational_notifications: e.target.checked }))}
          />
          {t('settings.privacy.operationalNotifications')}
        </label>
        <label className="settings-toggle ccpa-toggle">
          <input
            type="checkbox"
            checked={prefs.do_not_sell}
            onChange={(e) => setPrefs((p) => ({ ...p, do_not_sell: e.target.checked }))}
          />
          <span>
            <strong>{t('settings.privacy.doNotSell')}</strong>
            <span className="muted">{t('settings.privacy.doNotSellDesc')}</span>
          </span>
        </label>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? t('common.loading') : t('settings.privacy.save')}
        </button>
      </div>

      <div className="settings-card" style={{ marginTop: 18 }}>
        <h3>{t('settings.privacy.languageTitle')}</h3>
        <LanguageSwitcher />
      </div>

      <div className="settings-card" style={{ marginTop: 18 }}>
        <h3>{t('settings.privacy.exportTitle')}</h3>
        <p className="muted">{t('settings.privacy.exportDescription')}</p>
        <button type="button" className="btn" onClick={exportData} disabled={exporting}>
          {exporting ? t('common.loading') : t('settings.privacy.exportButton')}
        </button>
      </div>

      <div className="settings-card" style={{ marginTop: 18 }}>
        <h3>{t('settings.privacy.consentTitle')}</h3>
        <p className="muted">
          {prefs.terms_accepted_at
            ? `${t('settings.privacy.termsAccepted')}: ${new Date(prefs.terms_accepted_at).toLocaleString()}`
            : t('settings.privacy.termsNotRecorded')}
        </p>
        <p className="muted">
          {prefs.privacy_accepted_at
            ? `${t('settings.privacy.privacyAccepted')}: ${new Date(prefs.privacy_accepted_at).toLocaleString()}`
            : t('settings.privacy.privacyNotRecorded')}
        </p>
        <p className="muted">
          <Link href="/privacy">{t('legal.privacy')}</Link> · <Link href="/terms">{t('legal.terms')}</Link> ·{' '}
          <Link href="/cookies">{t('legal.cookies')}</Link>
        </p>
      </div>

      {message ? <p className="auth-message auth-message-success" role="status">{message}</p> : null}
    </SettingsShell>
  );
}
