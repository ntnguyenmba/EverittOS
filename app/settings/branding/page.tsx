'use client';

import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { limitsForPlan } from '@/lib/everittos-limits';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { fetchOrganizationContext } from '@/lib/organization';
import { canManageOrganizationSettings, normalizeRole, type UserRole } from '@/lib/roles';
import { resolveOrgLogoUrl } from '@/lib/customer-logo';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function BrandingSettingsPage() {
  const router = useRouter();
  const { busy: saving, run, buttonLabel } = useAsyncAction({ successMessage: 'saved' });
  const { busy: uploading, run: runUpload } = useAsyncAction({ successMessage: 'uploadComplete' });
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [orgId, setOrgId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2D3748');
  const [secondaryColor, setSecondaryColor] = useState('#3A4658');
  const [logoPath, setLogoPath] = useState('');
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/branding');
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const p = normalizePlan(profile?.plan);
      const r = normalizeRole(profile?.role);
      setPlan(p);
      setRole(r);

      if (!canManageOrganizationSettings(r)) {
        setLoading(false);
        return;
      }

      const org = await fetchOrganizationContext(user.id);
      if (!org) {
        setLoading(false);
        return;
      }

      setOrgId(org.organizationId);

      const [{ data: orgRow }, { data: settings }] = await Promise.all([
        supabase.from('organizations').select('name').eq('id', org.organizationId).maybeSingle(),
        supabase.from('organization_settings').select('*').eq('organization_id', org.organizationId).maybeSingle()
      ]);

      setCompanyName(orgRow?.name || '');
      setSupportEmail(settings?.company_email || user.email || '');
      setPrimaryColor(settings?.brand_primary_color || '#2D3748');
      setSecondaryColor(settings?.brand_accent_color || '#3A4658');
      const path = settings?.logo_path || '';
      setLogoPath(path);
      setLogoPreviewUrl(path ? await resolveOrgLogoUrl(supabase, path) : null);
      setLoading(false);
    }
    load();
  }, [router]);

  async function saveBranding(event: React.FormEvent) {
    event.preventDefault();
    if (!orgId || saving) return;

    await run(async () => {
      await supabase.from('organizations').update({ name: companyName.trim() || 'My company' }).eq('id', orgId);
      const { error } = await supabase.from('organization_settings').upsert({
        organization_id: orgId,
        company_email: supportEmail.trim(),
        brand_primary_color: primaryColor,
        brand_accent_color: secondaryColor,
        logo_path: logoPath || null
      });
      if (error) throw new Error(error.message);
    });
  }

  async function uploadLogo(file: File) {
    if (!orgId || uploading) return;

    await runUpload(async () => {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${orgId}/logo.${ext}`;
      const { error } = await supabase.storage.from('org-logos').upload(path, file, { upsert: true });
      if (error) throw new Error(error.message);
      setLogoPath(path);
      await supabase.from('organization_settings').upsert({ organization_id: orgId, logo_path: path });
      setLogoPreviewUrl(await resolveOrgLogoUrl(supabase, path));
    });
  }

  const brandingEnabled = limitsForPlan(plan).customBranding;
  const busy = saving || uploading;

  if (loading) {
    return (
      <AppShell plan={plan} role={role}>
        <p>Loading branding...</p>
      </AppShell>
    );
  }

  return (
    <SettingsShell plan={plan} role={role} title="Branding" description="Company logo, colors, and support contact for client-facing surfaces.">
      {!canManageOrganizationSettings(role) ? (
        <div className="settings-card">
          <p>Only workspace owners and admins can edit branding.</p>
        </div>
      ) : null}

      {!brandingEnabled ? (
        <div className="settings-warning">Custom branding on reports and the client portal requires Operations or higher.</div>
      ) : null}

      <form className="settings-card" onSubmit={saveBranding}>
        <h3>Organization branding</h3>
        <label className="auth-field">
          <span>Company name</span>
          <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </label>
        <label className="auth-field">
          <span>Support email</span>
          <input className="input" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
        </label>
        <div className="settings-row">
          <label className="auth-field">
            <span>Primary color</span>
            <input className="input" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
          </label>
          <label className="auth-field">
            <span>Secondary color</span>
            <input className="input" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
          </label>
        </div>
        <label className="auth-field">
          <span>Company logo</span>
          <input
            className="input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadLogo(file);
            }}
          />
        </label>
        {logoPreviewUrl ? (
          <img src={logoPreviewUrl} alt="Company logo preview" className="customer-logo-preview" width={96} height={96} />
        ) : logoPath ? (
          <p className="muted">Logo saved. Refresh if preview does not appear.</p>
        ) : null}
        <p className="muted">Branding applies to the client portal, PDF reports, invite emails, and the dashboard header.</p>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {buttonLabel('Save branding', FEEDBACK.loading)}
        </button>
      </form>

      <div className="settings-card brand-preview" style={{ ['--brand-primary' as string]: primaryColor, ['--brand-secondary' as string]: secondaryColor }}>
        <h3 style={{ color: primaryColor }}>{companyName || 'Company preview'}</h3>
        <p className="muted">Support: {supportEmail || 'support@company.com'}</p>
        <button type="button" className="btn btn-primary" style={{ background: primaryColor, borderColor: primaryColor }}>
          Branded button
        </button>
      </div>
    </SettingsShell>
  );
}
