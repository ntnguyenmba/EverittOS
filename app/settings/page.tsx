'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContext } from '@/lib/organization';
import { useTranslation } from '@/components/locale-provider';
import { onboardingDismissStorageKey } from '@/lib/onboarding/constants';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [notifyAssignments, setNotifyAssignments] = useState(true);
  const [notifyDueDates, setNotifyDueDates] = useState(true);
  const [notifyCompletions, setNotifyCompletions] = useState(true);
  const [notifyReports, setNotifyReports] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [timezone, setTimezone] = useState('America/New_York');
  const [teamSize, setTeamSize] = useState('');
  const [industry, setIndustry] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [restartBusy, setRestartBusy] = useState(false);
  const { t } = useTranslation();

  async function restartOnboarding() {
    if (!window.confirm(t('onboarding.settings.restartConfirm'))) return;
    setRestartBusy(true);
    setMessage('');
    const res = await fetch('/api/onboarding/restart', { method: 'POST' });
    setRestartBusy(false);
    if (!res.ok) {
      const json = await res.json();
      setMessage(json.error || 'Unable to restart onboarding.');
      setSaveSuccess(false);
      return;
    }
    try {
      if (orgId) localStorage.removeItem(onboardingDismissStorageKey(orgId));
    } catch {
      /* ignore */
    }
    setMessage(t('onboarding.settings.restartSuccess'));
    setSaveSuccess(true);
    router.push('/onboarding');
  }

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      const { data: biz } = await supabase.from('business_profiles').select('*').eq('user_id', user.id).maybeSingle();

      setPlan(normalizePlan(profile?.plan));
      setBusinessName(biz?.business_name || profile?.business_name || '');
      setPhone(biz?.phone || '');
      setServiceType(biz?.service_type || '');
      setBookingUrl(biz?.booking_url || '');
      setEmail(user.email || '');

      const org = await fetchOrganizationContext(user.id);
      if (org) {
        setOrgId(org.organizationId);
        const { data: settings } = await supabase
          .from('organization_settings')
          .select('*')
          .eq('organization_id', org.organizationId)
          .maybeSingle();
        if (settings) {
          setServiceType(settings.service_type || serviceType);
          setBookingUrl(settings.booking_url || bookingUrl);
          setWebsite(settings.website || '');
          setCompanyAddress(settings.company_address || '');
          setPhone(settings.company_phone || phone);
          setNotifyAssignments(settings.notification_assignments ?? true);
          setNotifyDueDates(settings.notification_due_dates ?? true);
          setNotifyCompletions(settings.notification_completions ?? true);
          setNotifyReports(settings.notification_reports ?? true);
          setTimezone(settings.timezone || 'America/New_York');
          setTeamSize(settings.team_size || '');
          setIndustry(settings.industry || '');
        }
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function saveProfile() {
    if (saving) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    setMessage('');
    setSaveSuccess(false);

    const { error } = await supabase
      .from('profiles')
      .update({ business_name: businessName.trim() || null })
      .eq('id', user.id);

    if (error) {
      setSaving(false);
      setMessage(error.message);
      return;
    }

    await supabase.from('business_profiles').upsert({
      user_id: user.id,
      business_name: businessName.trim() || null,
      phone: phone.trim() || null,
      service_type: serviceType.trim() || null,
      booking_url: bookingUrl.trim() || null,
      email
    });

    if (orgId) {
      await supabase.from('organization_settings').upsert({
        organization_id: orgId,
        company_phone: phone.trim() || null,
        company_email: email,
        website: website.trim() || null,
        company_address: companyAddress.trim() || null,
        service_type: serviceType.trim() || null,
        booking_url: bookingUrl.trim() || null,
        notification_assignments: notifyAssignments,
        notification_due_dates: notifyDueDates,
        notification_completions: notifyCompletions,
        notification_reports: notifyReports,
        timezone: timezone || 'UTC',
        team_size: teamSize.trim() || null,
        industry: industry.trim() || null
      });
      await supabase.from('organizations').update({ name: businessName.trim() || 'My Business' }).eq('id', orgId);
    }

    setSaving(false);
    setSaveSuccess(true);
    setMessage('Settings saved successfully.');
  }

  async function uploadLogo(file: File | null) {
    if (!file || !orgId) return;
    setLogoUploading(true);
    const path = `${orgId}/logo-${Date.now()}.${file.name.split('.').pop() || 'png'}`;
    const { error } = await supabase.storage.from('org-logos').upload(path, file, { upsert: true });
    if (error) {
      setMessage(error.message);
      setLogoUploading(false);
      return;
    }
    await supabase.from('organization_settings').upsert({ organization_id: orgId, logo_path: path });
    setLogoUploading(false);
    setMessage('Logo uploaded.');
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (loading) {
    return (
      <AppShell plan={plan}>
        <p>Loading settings...</p>
      </AppShell>
    );
  }

  return (
    <SettingsShell
      plan={plan}
      title="Workspace settings"
      description="Optional business profile, logo, and notifications. Add details when you are ready. Solo operators can keep it simple."
    >
      <div className="settings-card form">
        <p>
          Plan: <strong>{plan}</strong>. Manage subscription on{' '}
          <Link href="/settings/billing">billing settings</Link> or{' '}
          <Link href="/settings/account">account settings</Link>.
        </p>
          <label htmlFor="org-name">Organization name</label>
          <input id="org-name" className="input" placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <label htmlFor="org-phone">Phone</label>
          <input id="org-phone" className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label htmlFor="org-website">Website</label>
          <input id="org-website" className="input" placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <label htmlFor="org-address">Address</label>
          <input id="org-address" className="input" placeholder="Business address" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
          <label htmlFor="org-industry">Business type</label>
          <input id="org-industry" className="input" placeholder="e.g. Landscaping, HVAC" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          <label htmlFor="org-team-size">Employee count</label>
          <select id="org-team-size" className="input" value={teamSize} onChange={(e) => setTeamSize(e.target.value)}>
            <option value="">Select…</option>
            <option value="1-5">1–5</option>
            <option value="6-15">6–15</option>
            <option value="16-50">16–50</option>
            <option value="51+">51+</option>
          </select>
          <label htmlFor="org-timezone">Timezone</label>
          <select id="org-timezone" className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            <option value="America/New_York">Eastern (US)</option>
            <option value="America/Chicago">Central (US)</option>
            <option value="America/Denver">Mountain (US)</option>
            <option value="America/Los_Angeles">Pacific (US)</option>
            <option value="UTC">UTC</option>
          </select>
          <label htmlFor="org-service">Service type</label>
          <input id="org-service" className="input" placeholder="Service type" value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
          <input
            className="input"
            placeholder="External booking URL"
            value={bookingUrl}
            onChange={(e) => setBookingUrl(e.target.value)}
          />
          <label htmlFor="org-email">Email</label>
          <input id="org-email" className="input" placeholder="Email" value={email} disabled />
          <h3>Logo</h3>
          <input type="file" accept="image/*" aria-label="Upload organization logo" disabled={!orgId || logoUploading} onChange={(e) => uploadLogo(e.target.files?.[0] || null)} />
          {logoUploading ? <p className="loading-state" role="status">Uploading logo…</p> : null}
          <h3>Notification preferences</h3>
          <label>
            <input type="checkbox" checked={notifyAssignments} onChange={(e) => setNotifyAssignments(e.target.checked)} /> Assignments
          </label>
          <label>
            <input type="checkbox" checked={notifyDueDates} onChange={(e) => setNotifyDueDates(e.target.checked)} /> Due dates
          </label>
          <label>
            <input type="checkbox" checked={notifyCompletions} onChange={(e) => setNotifyCompletions(e.target.checked)} /> Completions
          </label>
          <label>
            <input type="checkbox" checked={notifyReports} onChange={(e) => setNotifyReports(e.target.checked)} /> Reports
          </label>
          <button className="btn btn-primary" type="button" onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : 'Save settings'}
          </button>
          <button className="btn" type="button" onClick={logout}>
            Log out
          </button>
          <div className="settings-card" style={{ marginTop: 18 }}>
            <h3>{t('onboarding.settings.restart')}</h3>
            <p className="muted">{t('onboarding.settings.restartDescription')}</p>
            <button type="button" className="btn" onClick={restartOnboarding} disabled={restartBusy}>
              {t('onboarding.settings.restart')}
            </button>
          </div>
          <p style={{ marginTop: 16 }}>
            <Link href="/onboarding">{t('onboarding.checklist.continue')}</Link>
          </p>
          <p style={{ marginTop: 16 }}>
            <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/cookies">Cookies</Link> ·{' '}
            <Link href="/disclaimer">Disclaimer</Link>
          </p>
          {message && (
            <p className={saveSuccess ? 'auth-message auth-message-success' : 'auth-message auth-message-error'} role={saveSuccess ? 'status' : 'alert'}>
              {message}
            </p>
          )}
        </div>
    </SettingsShell>
  );
}
