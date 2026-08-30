'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { WorkspaceDeleteSection } from '@/components/settings/workspace-delete-section';
import { AccountDeleteSection } from '@/components/settings/account-delete-section';
import { CalendarImportPanel } from '@/components/calendar-import-panel';
import { QuickBooksIntegrationPanel } from '@/components/quickbooks-integration-panel';
import { TimezonePicker, browserTimeZone } from '@/components/timezone-picker';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, isOwner, normalizeRole } from '@/lib/roles';
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
import { formatSettingsCopy, getSettingsWorkspaceCopy } from '@/lib/i18n/settings-copy';
import { normalizeTimeZone } from '@/lib/time-zones';

export default function SettingsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = getSettingsWorkspaceCopy(locale);
  const { busy: saving, runResponse, buttonLabel } = useAsyncAction({ successMessage: 'saved', errorFallback: c.saveError });
  const { busy: logoUploading, run: runLogoUpload } = useAsyncAction({ successMessage: 'uploadComplete' });
  const { busy: restartBusy, runResponse: runRestart } = useAsyncAction({ errorFallback: c.restartError });
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
  const [timezone, setTimezone] = useState('UTC');
  const [teamSize, setTeamSize] = useState('');
  const [industry, setIndustry] = useState('');
  const { profilePlan, billingPlan, organizationPlan, plan: workspacePlan, subscriptionStatus: workspaceSubscriptionStatus, loading: planLoading } = useWorkspacePlan();

  async function restartOnboarding() {
    if (!window.confirm(t('onboarding.settings.restartConfirm'))) return;
    const res = await runRestart(() => fetch('/api/onboarding/restart', { method: 'POST' }), t('onboarding.settings.restartSuccess'));
    if (!res) return;
    try { if (orgId) localStorage.removeItem(onboardingDismissStorageKey(orgId)); } catch { /* ignore */ }
    router.push('/onboarding');
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      const { data: biz } = await supabase.from('business_profiles').select('*').eq('user_id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan)); setRole(normalizeRole(profile?.role)); setBusinessName(biz?.business_name || profile?.business_name || ''); setPhone(biz?.phone || ''); setServiceType(biz?.service_type || ''); setBookingUrl(biz?.booking_url || ''); setEmail(user.email || '');
      const org = await ensureOrganizationForUser(user.id);
      if (org) {
        setOrgId(org.organizationId);
        const { data: settings } = await supabase.from('organization_settings').select('*').eq('organization_id', org.organizationId).maybeSingle();
        const detectedTimeZone = normalizeTimeZone(browserTimeZone(), 'UTC');
        if (settings) {
          setServiceType(settings.service_type || ''); setBookingUrl(settings.booking_url || ''); setWebsite(settings.website || ''); setCompanyAddress(settings.company_address || ''); setPhone(settings.company_phone || biz?.phone || ''); setBusinessEmail(settings.company_email || user.email || ''); setLegalBusinessName(settings.legal_business_name || ''); setTeamDisplayName(settings.team_display_name || ''); setTaxId(settings.tax_id || ''); setInvoiceFooter(settings.invoice_footer || ''); setDefaultCustomerMessage(settings.default_customer_message || ''); setBrandPrimaryColor(settings.brand_primary_color || ''); setBrandAccentColor(settings.brand_accent_color || ''); setNotifyAssignments(settings.notification_assignments ?? true); setNotifyDueDates(settings.notification_due_dates ?? true); setNotifyCompletions(settings.notification_completions ?? true); setNotifyReports(settings.notification_reports ?? true); setTimezone(normalizeTimeZone(settings.timezone, detectedTimeZone)); setTeamSize(settings.team_size || ''); setIndustry(settings.industry || '');
        } else {
          setTimezone(detectedTimeZone);
        }
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  async function saveProfile() {
    if (saving) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login?next=/settings'); return; }
    const validTimezone = normalizeTimeZone(timezone, browserTimeZone());
    setTimezone(validTimezone);
    const res = await runResponse(() => fetch('/api/settings/workspace', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessName, legalBusinessName, teamDisplayName, phone, businessEmail, serviceType, bookingUrl, website, companyAddress, taxId, invoiceFooter, defaultCustomerMessage, brandPrimaryColor, brandAccentColor, email, notifyAssignments, notifyDueDates, notifyCompletions, notifyReports, timezone: validTimezone, teamSize, industry }) }));
    if (!res) return;
    const org = await ensureOrganizationForUser(user.id); if (org?.organizationId) setOrgId(org.organizationId);
  }

  async function uploadLogo(file: File | null) {
    if (!file || !orgId || logoUploading) return;
    await runLogoUpload(async () => { const path = `${orgId}/logo-${Date.now()}.${file.name.split('.').pop() || 'png'}`; const { error } = await supabase.storage.from('org-logos').upload(path, file, { upsert: true }); if (error) throw new Error(formatSupabaseError(error)); const { error: settingsError } = await supabase.from('organization_settings').upsert({ organization_id: orgId, logo_path: path }); if (settingsError) throw new Error(formatSupabaseError(settingsError)); });
  }

  async function logout() { const { performClientLogout } = await import('@/lib/client-logout'); await performClientLogout(router); }
  if (loading || planLoading) return <SettingsShell plan={plan} role={role} title={c.title}><p className="loading-state" role="status">{c.loading}</p></SettingsShell>;
  const effectivePlan = billingPlan ?? profilePlan ?? workspacePlan ?? organizationPlan ?? plan;
  const hasActiveSubscription = subscriptionBlocksAccountDeletion(effectivePlan, workspaceSubscriptionStatus);
  const canDeleteWorkspace = isOwner(role);

  return <SettingsShell plan={plan} role={role} title={c.title}>
    <section className="settings-card form settings-form-grid">
      <h3>{c.business}</h3>
      <label htmlFor="org-name">{c.businessName}</label><input id="org-name" className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
      <label htmlFor="org-phone">{c.phone}</label><input id="org-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <label htmlFor="org-business-email">{c.email}</label><input id="org-business-email" className="input" type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} />
      <label htmlFor="org-address">{c.address}</label><input id="org-address" className="input" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
      <label htmlFor="org-service">{c.service}</label><input id="org-service" className="input" value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
      <label htmlFor="org-timezone">{c.timezone}</label><TimezonePicker value={timezone} onChange={setTimezone} /><p className="muted">Your workspace default for jobs, schedules, daylight-saving changes and calendar sync. New accounts start with the device timezone; each job can override it.</p>
      <button className="btn btn-primary" type="button" onClick={() => void saveProfile()} disabled={saving}>{buttonLabel(c.save, FEEDBACK.loading)}</button>
    </section>
    {isOwner(role) ? <details className="settings-card" style={{ marginTop: 18 }} open><summary><strong>{c.integrations}</strong></summary><div style={{ marginTop: 16 }}><CalendarImportPanel /><div style={{ marginTop: 28 }}><h3 style={{ marginBottom: 8 }}>{c.quickBooks}</h3><QuickBooksIntegrationPanel canManage /></div></div></details> : null}
    <details className="settings-card" style={{ marginTop: 18 }}><summary><strong>{c.businessDetails}</strong></summary><div className="form settings-form-grid" style={{ marginTop: 16 }}><label htmlFor="org-legal-name">{c.legalName}</label><input id="org-legal-name" className="input" value={legalBusinessName} onChange={(e) => setLegalBusinessName(e.target.value)} /><label htmlFor="org-team-display">{c.teamName}</label><input id="org-team-display" className="input" value={teamDisplayName} onChange={(e) => setTeamDisplayName(e.target.value)} /><label htmlFor="org-website">{c.website}</label><input id="org-website" className="input" value={website} onChange={(e) => setWebsite(e.target.value)} /><label htmlFor="org-booking">{c.bookingLink}</label><input id="org-booking" className="input" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} /><label htmlFor="org-tax-id">{c.taxId}</label><input id="org-tax-id" className="input" value={taxId} onChange={(e) => setTaxId(e.target.value)} /><label htmlFor="org-industry">{c.businessType}</label><input id="org-industry" className="input" value={industry} onChange={(e) => setIndustry(e.target.value)} /><label htmlFor="org-team-size">{c.teamSize}</label><select id="org-team-size" className="input" value={teamSize} onChange={(e) => setTeamSize(e.target.value)}><option value="">{c.select}</option><option value="1-5">1-5</option><option value="6-15">6-15</option><option value="16-50">16-50</option><option value="51+">51+</option></select></div></details>
    <details className="settings-card" style={{ marginTop: 18 }}><summary><strong>{c.customerMessages}</strong></summary><div className="form settings-form-grid" style={{ marginTop: 16 }}><label htmlFor="org-default-message">{c.defaultMessage}</label><textarea id="org-default-message" className="input" rows={3} value={defaultCustomerMessage} onChange={(e) => setDefaultCustomerMessage(e.target.value)} /><label htmlFor="org-invoice-footer">{c.invoiceFooter}</label><textarea id="org-invoice-footer" className="input" rows={3} value={invoiceFooter} onChange={(e) => setInvoiceFooter(e.target.value)} /></div></details>
    {isManagerRole(role) ? <section className="settings-card" style={{ marginTop: 18 }}><h3>Customer recommendations</h3><p className="muted">Ask for recommendation here after a finished job. Workers cannot change this link.</p><Link className="btn" href="/settings/reviews">Set recommendation link</Link></section> : null}
    <details className="settings-card" style={{ marginTop: 18 }}><summary><strong>{c.branding}</strong></summary><div className="form settings-form-grid" style={{ marginTop: 16 }}><label htmlFor="org-brand-primary">{c.mainColor}</label><input id="org-brand-primary" className="input" placeholder="#2f5f8f" value={brandPrimaryColor} onChange={(e) => setBrandPrimaryColor(e.target.value)} /><label htmlFor="org-brand-accent">{c.accentColor}</label><input id="org-brand-accent" className="input" placeholder="#4A6354" value={brandAccentColor} onChange={(e) => setBrandAccentColor(e.target.value)} /><label>{c.logo}</label><input type="file" accept="image/*" aria-label={c.uploadLogoAria} disabled={!orgId || logoUploading} onChange={(e) => uploadLogo(e.target.files?.[0] || null)} />{logoUploading ? <p className="loading-state">{c.uploading}</p> : null}</div></details>
    <details className="settings-card" style={{ marginTop: 18 }}><summary><strong>{c.notifications}</strong></summary><div className="form" style={{ marginTop: 16 }}><label><input type="checkbox" checked={notifyAssignments} onChange={(e) => setNotifyAssignments(e.target.checked)} /> {c.jobAssignments}</label><label><input type="checkbox" checked={notifyDueDates} onChange={(e) => setNotifyDueDates(e.target.checked)} /> {c.dueDates}</label><label><input type="checkbox" checked={notifyCompletions} onChange={(e) => setNotifyCompletions(e.target.checked)} /> {c.completedJobs}</label><label><input type="checkbox" checked={notifyReports} onChange={(e) => setNotifyReports(e.target.checked)} /> {c.reports}</label></div></details>
    <details className="settings-card" style={{ marginTop: 18 }}><summary><strong>{c.languageSetup}</strong></summary><div style={{ marginTop: 16 }}><LanguageSwitcher /><div className="button-row" style={{ marginTop: 14, flexWrap: 'wrap' }}><button type="button" className="btn" onClick={() => void restartOnboarding()} disabled={restartBusy}>{restartBusy ? FEEDBACK.loading : c.restartSetup}</button><Link className="btn" href="/onboarding">{c.setupChecklist}</Link></div></div></details>
    <section className="settings-card" style={{ marginTop: 18 }}><h3>{c.account}</h3><p className="muted">{formatSettingsCopy(c.signedInAs, { email })}</p><div className="button-row" style={{ flexWrap: 'wrap' }}><Link className="btn" href="/settings/account">{c.accountDetails}</Link><Link className="btn" href="/settings/billing">{c.plansBilling}</Link><button className="btn" type="button" onClick={logout}>{c.logOut}</button></div></section>
    <details className="settings-card" style={{ marginTop: 18 }}><summary><strong>{c.legalAdvanced}</strong></summary><div className="button-row" style={{ marginTop: 14, flexWrap: 'wrap' }}><Link className="btn" href="/terms">{c.terms}</Link><Link className="btn" href="/privacy">{c.privacy}</Link><Link className="btn" href="/cookies">{c.cookies}</Link><Link className="btn" href="/disclaimer">{c.disclaimer}</Link></div></details>
    <WorkspaceDeleteSection canManage={canDeleteWorkspace} /><AccountDeleteSection hasActiveSubscription={hasActiveSubscription} busy={saving} />
  </SettingsShell>;
}
