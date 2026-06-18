'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { WorkspaceDeleteSection } from '@/components/settings/workspace-delete-section';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageOrganizationSettings, isOwner, normalizeRole } from '@/lib/roles';
import { useTranslation } from '@/components/locale-provider';
import { onboardingDismissStorageKey } from '@/lib/onboarding/constants';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { formatSupabaseError } from '@/lib/action-messages';
import { supabase } from '@/lib/supabase';
import { ensureOrganizationForUser } from '@/lib/workspace-client';

export default function SettingsPage() {
  const router = useRouter();
  const { busy: saving, runResponse, buttonLabel } = useAsyncAction({
    successMessage: 'saved',
    errorFallback: 'Unable to save settings.'
  });
  const { busy: logoUploading, run: runLogoUpload } = useAsyncAction({ successMessage: 'uploadComplete' });
  const { busy: restartBusy, runResponse: runRestart } = useAsyncAction({
    errorFallback: 'Unable to restart onboarding.'
  });
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState(normalizeRole('owner'));
  const [businessName, setBusinessName] = useState('');
  const [legalBusinessName, setLegalBusinessName] = useState('');
  const [teamDisplayName, setTeamDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [invoiceFooter, setInvoiceFooter] = useState('');
  const [defaultCustomerMessage, setDefaultCustomerMessage] = useState('');
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('');
  const [brandAccentColor, setBrandAccentColor] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');
  const [notifyAssignments, setNotifyAssignments] = useState(true);
  const [notifyDueDates, setNotifyDueDates] = useState(true);
  const [notifyCompletions, setNotifyCompletions] = useState(true);
  const [notifyReports, setNotifyReports] = useState(true);
  const [timezone, setTimezone] = useState('America/New_York');
  const [teamSize, setTeamSize] = useState('');
  const [industry, setIndustry] = useState('');
  const { t } = useTranslation();

  async function restartOnboarding() {
    if (!window.confirm(t('onboarding.settings.restartConfirm'))) return;
    const res = await runRestart(
      () => fetch('/api/onboarding/restart', { method: 'POST' }),
      t('onboarding.settings.restartSuccess')
    );
    if (!res) return;
    try {
      if (orgId) localStorage.removeItem(onboardingDismissStorageKey(orgId));
    } catch {
      /* ignore */
    }
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
      setRole(normalizeRole(profile?.role));
      setBusinessName(biz?.business_name || profile?.business_name || '');
      setPhone(biz?.phone || '');
      setServiceType(biz?.service_type || '');
      setBookingUrl(biz?.booking_url || '');
      setEmail(user.email || '');

      const org = await ensureOrganizationForUser(user.id);
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
          setBusinessEmail(settings.company_email || user.email || '');
          setLegalBusinessName(settings.legal_business_name || '');
          setTeamDisplayName(settings.team_display_name || '');
          setTaxId(settings.tax_id || '');
          setInvoiceFooter(settings.invoice_footer || '');
          setDefaultCustomerMessage(settings.default_customer_message || '');
          setBrandPrimaryColor(settings.brand_primary_color || '');
          setBrandAccentColor(settings.brand_accent_color || '');
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
    if (!user) {
      router.push('/login?next=/settings');
      return;
    }

    const res = await runResponse(() =>
      fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          legalBusinessName,
          teamDisplayName,
          phone,
          businessEmail,
          serviceType,
          bookingUrl,
          website,
          companyAddress,
          taxId,
          invoiceFooter,
          defaultCustomerMessage,
          brandPrimaryColor,
          brandAccentColor,
          email,
          notifyAssignments,
          notifyDueDates,
          notifyCompletions,
          notifyReports,
          timezone,
          teamSize,
          industry
        })
      })
    );
    if (!res) return;

    const org = await ensureOrganizationForUser(user.id);
    if (org?.organizationId) setOrgId(org.organizationId);
  }

  async function uploadLogo(file: File | null) {
    if (!file || !orgId || logoUploading) return;
    await runLogoUpload(async () => {
      const path = `${orgId}/logo-${Date.now()}.${file.name.split('.').pop() || 'png'}`;
      const { error } = await supabase.storage.from('org-logos').upload(path, file, { upsert: true });
      if (error) throw new Error(formatSupabaseError(error));
      const { error: settingsError } = await supabase
        .from('organization_settings')
        .upsert({ organization_id: orgId, logo_path: path });
      if (settingsError) throw new Error(formatSupabaseError(settingsError));
    });
  }

  async function logout() {
    const { performClientLogout } = await import('@/lib/client-logout');
    await performClientLogout(router);
  }

  if (loading) {
    return (
      <SettingsShell plan={plan} role={role} title="Workspace settings">
        <p className="loading-state" role="status">
          Loading settings...
        </p>
      </SettingsShell>
    );
  }

  const canDeleteWorkspace = isOwner(role);

  return (
    <SettingsShell
      plan={plan}
      role={role}
      title="Workspace settings"
      description="Business profile, branding, and workspace preferences for owners and admins."
    >
      <div className="settings-card form settings-form-grid">
        <p className="muted">
          Manage subscription on <Link href="/settings/billing">Plans & billing</Link> or personal details on{' '}
          <Link href="/settings/account">Account</Link>.
        </p>
          <label htmlFor="org-name">Business name</label>
          <input id="org-name" className="input" placeholder="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <label htmlFor="org-legal-name">Legal business name</label>
          <input id="org-legal-name" className="input" placeholder="Legal business name" value={legalBusinessName} onChange={(e) => setLegalBusinessName(e.target.value)} />
          <label htmlFor="org-team-display">Team display name</label>
          <input id="org-team-display" className="input" placeholder="How your team appears in the app" value={teamDisplayName} onChange={(e) => setTeamDisplayName(e.target.value)} />
          <label htmlFor="org-phone">Business phone</label>
          <input id="org-phone" className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label htmlFor="org-business-email">Business email</label>
          <input id="org-business-email" className="input" type="email" placeholder="Business email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} />
          <label htmlFor="org-website">Website</label>
          <input id="org-website" className="input" placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <label htmlFor="org-address">Address</label>
          <input id="org-address" className="input" placeholder="Business address" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
          <label htmlFor="org-tax-id">Tax ID</label>
          <input id="org-tax-id" className="input" placeholder="Tax ID (optional)" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          <label htmlFor="org-industry">Business type</label>
          <input id="org-industry" className="input" placeholder="e.g. Landscaping, HVAC" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          <label htmlFor="org-team-size">Employee count</label>
          <select id="org-team-size" className="input" value={teamSize} onChange={(e) => setTeamSize(e.target.value)}>
            <option value="">Select…</option>
            <option value="1-5">1-5</option>
            <option value="6-15">6-15</option>
            <option value="16-50">16-50</option>
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
          <label htmlFor="org-invoice-footer">Invoice footer</label>
          <textarea id="org-invoice-footer" className="input" rows={3} placeholder="Footer text for invoices" value={invoiceFooter} onChange={(e) => setInvoiceFooter(e.target.value)} />
          <label htmlFor="org-default-message">Default customer message</label>
          <textarea id="org-default-message" className="input" rows={3} placeholder="Default message for customer communications" value={defaultCustomerMessage} onChange={(e) => setDefaultCustomerMessage(e.target.value)} />
          <label htmlFor="org-brand-primary">Brand primary color</label>
          <input id="org-brand-primary" className="input" placeholder="#2f5f8f" value={brandPrimaryColor} onChange={(e) => setBrandPrimaryColor(e.target.value)} />
          <label htmlFor="org-brand-accent">Brand accent color</label>
          <input id="org-brand-accent" className="input" placeholder="#4A6354" value={brandAccentColor} onChange={(e) => setBrandAccentColor(e.target.value)} />
          <label htmlFor="org-email">Your sign-in email</label>
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
          <button className="btn btn-primary" type="button" onClick={() => void saveProfile()} disabled={saving}>
            {buttonLabel('Save settings', FEEDBACK.loading)}
          </button>
          <button className="btn" type="button" onClick={logout}>
            Log out
          </button>
          <div className="settings-card" style={{ marginTop: 18 }}>
            <h3>{t('language.title')}</h3>
            <p className="muted">{t('language.note')}</p>
            <LanguageSwitcher />
          </div>
          <div className="settings-card" style={{ marginTop: 18 }}>
            <h3>{t('onboarding.settings.restart')}</h3>
            <p className="muted">{t('onboarding.settings.restartDescription')}</p>
            <button type="button" className="btn" onClick={() => void restartOnboarding()} disabled={restartBusy}>
              {restartBusy ? FEEDBACK.loading : t('onboarding.settings.restart')}
            </button>
          </div>
          <p style={{ marginTop: 16 }}>
            <Link href="/onboarding">{t('onboarding.checklist.continue')}</Link>
          </p>
          <p style={{ marginTop: 16 }}>
            <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> ·{' '}
            <Link href="/refund-policy">No Refund Policy</Link> · <Link href="/cookies">Cookies</Link> ·{' '}
            <Link href="/disclaimer">Disclaimer</Link>
          </p>
        </div>

      <WorkspaceDeleteSection canManage={canDeleteWorkspace} />
    </SettingsShell>
  );
}
