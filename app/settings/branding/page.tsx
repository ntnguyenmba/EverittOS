'use client';

import { AppShell } from '@/components/app-shell';
import { SettingsShell } from '@/components/settings/settings-shell';
import { useTranslation } from '@/components/locale-provider';
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

const copy = {
  en: {
    loading: 'Loading branding...',
    description: 'Company logo, colors, and support contact for client-facing surfaces.',
    ownersOnly: 'Only company owners and admins can edit branding.',
    planWarning: 'Custom branding on reports and the customer dashboard requires Growth or higher.',
    companyBranding: 'Company branding',
    companyName: 'Company name',
    supportEmail: 'Support email',
    primaryColor: 'Primary color',
    secondaryColor: 'Secondary color',
    companyLogo: 'Company logo',
    logoPreviewAlt: 'Company logo preview',
    logoSaved: 'Logo saved. Refresh if preview does not appear.',
    appliesNote: 'Branding applies to the customer dashboard, PDF reports, invite emails, and the dashboard header.',
    save: 'Save branding',
    companyPreview: 'Company preview',
    supportLabel: 'Support:',
    brandedButton: 'Branded button'
  },
  es: {
    loading: 'Cargando marca...',
    description: 'Logotipo, colores y contacto de soporte de la empresa para superficies orientadas al cliente.',
    ownersOnly: 'Solo los propietarios y administradores de la empresa pueden editar la marca.',
    planWarning: 'La marca personalizada en informes y el panel del cliente requiere Growth o superior.',
    companyBranding: 'Marca de la empresa',
    companyName: 'Nombre de la empresa',
    supportEmail: 'Correo de soporte',
    primaryColor: 'Color principal',
    secondaryColor: 'Color secundario',
    companyLogo: 'Logotipo de la empresa',
    logoPreviewAlt: 'Vista previa del logotipo de la empresa',
    logoSaved: 'Logotipo guardado. Actualice si la vista previa no aparece.',
    appliesNote: 'La marca se aplica al panel del cliente, informes PDF, correos de invitación y el encabezado del panel.',
    save: 'Guardar marca',
    companyPreview: 'Vista previa de la empresa',
    supportLabel: 'Soporte:',
    brandedButton: 'Botón con marca'
  },
  vi: {
    loading: 'Đang tải thương hiệu...',
    description: 'Logo công ty, màu sắc và email hỗ trợ cho các bề mặt hướng tới khách hàng.',
    ownersOnly: 'Chỉ chủ sở hữu và quản trị viên công ty mới có thể chỉnh sửa thương hiệu.',
    planWarning: 'Thương hiệu tùy chỉnh trên báo cáo và bảng điều khiển khách hàng yêu cầu gói Growth trở lên.',
    companyBranding: 'Thương hiệu công ty',
    companyName: 'Tên công ty',
    supportEmail: 'Email hỗ trợ',
    primaryColor: 'Màu chính',
    secondaryColor: 'Màu phụ',
    companyLogo: 'Logo công ty',
    logoPreviewAlt: 'Xem trước logo công ty',
    logoSaved: 'Đã lưu logo. Làm mới nếu bản xem trước không xuất hiện.',
    appliesNote: 'Thương hiệu áp dụng cho bảng điều khiển khách hàng, báo cáo PDF, email mời và tiêu đề bảng điều khiển.',
    save: 'Lưu thương hiệu',
    companyPreview: 'Xem trước công ty',
    supportLabel: 'Hỗ trợ:',
    brandedButton: 'Nút mang thương hiệu'
  }
} as const;

export default function BrandingSettingsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = copy[locale] || copy.en;
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
        <p>{c.loading}</p>
      </AppShell>
    );
  }

  return (
    <SettingsShell plan={plan} role={role} title={t('settingsNav.branding')} description={c.description}>
      {!canManageOrganizationSettings(role) ? (
        <div className="settings-card">
          <p>{c.ownersOnly}</p>
        </div>
      ) : null}

      {!brandingEnabled ? (
        <div className="settings-warning">{c.planWarning}</div>
      ) : null}

      <form className="settings-card" onSubmit={saveBranding}>
        <h3>{c.companyBranding}</h3>
        <label className="auth-field">
          <span>{c.companyName}</span>
          <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </label>
        <label className="auth-field">
          <span>{c.supportEmail}</span>
          <input className="input" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
        </label>
        <div className="settings-row">
          <label className="auth-field">
            <span>{c.primaryColor}</span>
            <input className="input" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
          </label>
          <label className="auth-field">
            <span>{c.secondaryColor}</span>
            <input className="input" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
          </label>
        </div>
        <label className="auth-field">
          <span>{c.companyLogo}</span>
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
          <img src={logoPreviewUrl} alt={c.logoPreviewAlt} className="customer-logo-preview" width={96} height={96} />
        ) : logoPath ? (
          <p className="muted">{c.logoSaved}</p>
        ) : null}
        <p className="muted">{c.appliesNote}</p>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {buttonLabel(c.save, FEEDBACK.loading)}
        </button>
      </form>

      <div className="settings-card brand-preview" style={{ ['--brand-primary' as string]: primaryColor, ['--brand-secondary' as string]: secondaryColor }}>
        <h3 style={{ color: primaryColor }}>{companyName || c.companyPreview}</h3>
        <p className="muted">
          {c.supportLabel} {supportEmail || 'support@company.com'}
        </p>
        <button type="button" className="btn btn-primary" style={{ background: primaryColor, borderColor: primaryColor }}>
          {c.brandedButton}
        </button>
      </div>
    </SettingsShell>
  );
}
