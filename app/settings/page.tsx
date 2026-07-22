'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { WorkspaceDeleteSection } from '@/components/settings/workspace-delete-section';
import { AccountDeleteSection } from '@/components/settings/account-delete-section';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isOwner, normalizeRole } from '@/lib/roles';
import { useTranslation } from '@/components/locale-provider';
import { onboardingDismissStorageKey } from '@/lib/onboarding/constants';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { formatSupabaseError } from '@/lib/action-messages';
import { supabase } from '@/lib/supabase';
import { ensureOrganizationForUser } from '@/lib/workspace-client';
import { subscriptionBlocksAccountDeletion } from '@/lib/account-deletion-server';
import { useWorkspacePlan } from '@/hooks/use-workspace-plan';

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
  const {
    profilePlan,
    billingPlan,
    organizationPlan,
    plan: workspacePlan,
    subscriptionStatus: workspaceSubscriptionStatus,
    loading: planLoading
  } = useWorkspacePlan();

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
          setServiceType(settings.service_type || '');
          setBookingUrl(settings.booking_url || '');
          setWebsite(settings.website || '');
          setCompanyAddress(settings.company_address || '');
          setPhone(settings.company_phone || biz?.phone || '');
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

    void load();
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

  if (loading || planLoading) {
    return (
      <SettingsShell plan={plan} role={role} title="Settings">
        <p className="loading-state" role="status">Loading...</p>
      </SettingsShell>
    );
  }

  const effectivePlan = billingPlan ?? profilePlan ?? workspacePlan ?? organizationPlan ?? plan;
  const hasActiveSubscription = subscriptionBlocksAccountDeletion(effectivePlan, workspaceSubscriptionStatus);
  const canDeleteWorkspace = isOwner(role);

  return (
    <SettingsShell plan={plan} role={role} title="Settings">
      <section className="settings-card form settings-form-grid">
        <h3>Business</h3>
        <label htmlFor="org-name">Business name</label>
        <input id="org-name" className="input" value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
        <label htmlFor="org-phone">Phone</label>
        <input id="org-phone" className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <label htmlFor="org-business-email">Email</label>
        <input id="org-business-email" className="input" type="email" value={businessEmail} onChange={(event) => setBusinessEmail(event.target.value)} />
        <label htmlFor="org-address">Address</label>
        <input id="org-address" className="input" value={companyAddress} onChange={(event) => setCompanyAddress(event.target.value)} />
        <label htmlFor="org-service">Service</label>
        <input id="org-service" className="input" value={serviceType} onChange={(event) => setServiceType(event.target.value)} />
        <label htmlFor="org-timezone">Timezone</label>
        <select id="org-timezone" className="input" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          <option value="America/New_York">Eastern (US)</option>
          <option value="America/Chicago">Central (US)</option>
          <option value="America/Denver">Mountain (US)</option>
          <option value="America/Los_Angeles">Pacific (US)</option>
          <option value="UTC">UTC</option>
        </select>
        <button className="btn btn-primary" type="button" onClick={() => void saveProfile()} disabled={saving}>
          {buttonLabel('Save', FEEDBACK.loading)}
        </button>
      </section>

      <details className="settings-card" style={{ marginTop: 18 }}>
        <summary><strong>Business details</strong></summary>
        <div className="form settings-form-grid" style={{ marginTop: 16 }}>
          <label htmlFor="org-legal-name">Legal name</label>
          <input id="org-legal-name" className="input" value={legalBusinessName} onChange={(event) => setLegalBusinessName(event.target.value)} />
          <label htmlFor="org-team-display">Team name</label>
          <input id="org-team-display" className="input" value={teamDisplayName} onChange={(event) => setTeamDisplayName(event.target.value)} />
          <label htmlFor="org-website">Website</label>
          <input id="org-website" className="input" value={website} onChange={(event) => setWebsite(event.target.value)} />
          <label htmlFor="org-booking">Booking link</label>
          <input id="org-booking" className="input" value={bookingUrl} onChange={(event) => setBookingUrl(event.target.value)} />
          <label htmlFor="org-tax-id">Tax ID</label>
          <input id="org-tax-id" className="input" value={taxId} onChange={(event) => setTaxId(event.target.value)} />
          <label htmlFor="org-industry">Business type</label>
          <input id="org-industry" className="input" value={industry} onChange={(event) => setIndustry(event.target.value)} />
          <label htmlFor="org-team-size">Team size</label>
          <select id="org-team-size" className="input" value={teamSize} onChange={(event) => setTeamSize(event.target.value)}>
            <option value="">Select</option>
            <option value="1-5">1-5</option>
            <option value="6-15">6-15</option>
            <option value="16-50">16-50</option>
            <option value="51+">51+</option>
          </select>
        </div>
      </details>

      <details className="settings-card" style={{ marginTop: 18 }}>
        <summary><strong>Customer messages & invoices</strong></summary>
        <div className="form settings-form-grid" style={{ marginTop: 16 }}>
          <label htmlFor="org-default-message">Default message</label>
          <textarea id="org-default-message" className="input" rows={3} value={defaultCustomerMessage} onChange={(event) => setDefaultCustomerMessage(event.target.value)} />
          <label htmlFor="org-invoice-footer">Invoice footer</label>
          <textarea id="org-invoice-footer" className="input" rows={3} value={invoiceFooter} onChange={(event) => setInvoiceFooter(event.target.value)} />
        </div>
      </details>

      <details className="settings-card" style={{ marginTop: 18 }}>
        <summary><strong>Branding</strong></summary>
        <div className="form settings-form-grid" style={{ marginTop: 16 }}>
          <label htmlFor="org-brand-primary">Main color</label>
          <input id="org-brand-primary" className="input" placeholder="#2f5f8f" value={brandPrimaryColor} onChange={(event) => setBrandPrimaryColor(event.target.value)} />
          <label htmlFor="org-brand-accent">Accent color</label>
          <input id="org-brand-accent" className="input" placeholder="#4A6354" value={brandAccentColor} onChange={(event) => setBrandAccentColor(event.target.value)} />
          <label>Logo</label>
          <input type="file" accept="image/*" aria-label="Upload organization logo" disabled={!orgId || logoUploading} onChange={(event) => uploadLogo(event.target.files?.[0] || null)} />
          {logoUploading ? <p className="loading-state">Uploading...</p> : null}
        </div>
      </details>

      <details className="settings-card" style={{ marginTop: 18 }}>
        <summary><strong>Notifications</strong></summary>
        <div className="form" style={{ marginTop: 16 }}>
          <label><input type="checkbox" checked={notifyAssignments} onChange={(event) => setNotifyAssignments(event.target.checked)} /> Job assignments</label>
          <label><input type="checkbox" checked={notifyDueDates} onChange={(event) => setNotifyDueDates(event.target.checked)} /> Due dates</label>
          <label><input type="checkbox" checked={notifyCompletions} onChange={(event) => setNotifyCompletions(event.target.checked)} /> Completed jobs</label>
          <label><input type="checkbox" checked={notifyReports} onChange={(event) => setNotifyReports(event.target.checked)} /> Reports</label>
        </div>
      </details>

      <details className="settings-card" style={{ marginTop: 18 }}>
        <summary><strong>Language & setup</strong></summary>
        <div style={{ marginTop: 16 }}>
          <LanguageSwitcher />
          <div className="button-row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => void restartOnboarding()} disabled={restartBusy}>
              {restartBusy ? FEEDBACK.loading : 'Restart setup'}
            </button>
            <Link className="btn" href="/onboarding">Setup checklist</Link>
          </div>
        </div>
      </details>

      <section className="settings-card" style={{ marginTop: 18 }}>
        <h3>Account</h3>
        <p className="muted">Signed in as {email}</p>
        <div className="button-row" style={{ flexWrap: 'wrap' }}>
          <Link className="btn" href="/settings/account">Account details</Link>
          <Link className="btn" href="/settings/billing">Plans & billing</Link>
          <button className="btn" type="button" onClick={logout}>Log out</button>
        </div>
      </section>

      <details className="settings-card" style={{ marginTop: 18 }}>
        <summary><strong>Legal & advanced</strong></summary>
        <div className="button-row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          <Link className="btn" href="/terms">Terms</Link>
          <Link className="btn" href="/privacy">Privacy</Link>
          <Link className="btn" href="/cookies">Cookies</Link>
          <Link className="btn" href="/disclaimer">Disclaimer</Link>
        </div>
      </details>

      <WorkspaceDeleteSection canManage={canDeleteWorkspace} />
      <AccountDeleteSection hasActiveSubscription={hasActiveSubscription} busy={saving} />
    </SettingsShell>
  );
}
