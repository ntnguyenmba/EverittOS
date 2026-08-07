'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { PlanLockedMessage } from '@/components/plan-locked-message';
import { useTranslation } from '@/components/locale-provider';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { canAccessFeature } from '@/lib/plan-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageOrganizationSettings, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

const copy = {
  en: {
    shortDescription: 'Company context for Ask Everitt.',
    description: 'Company profile, services, and preferences used by Ask Everitt. Stored per company.',
    loading: 'Loading...',
    ownersOnly: 'Only company owners and admins can edit AI memory.',
    companyProfile: 'Company profile',
    services: 'Services',
    serviceAreas: 'Service areas',
    pricingRules: 'Pricing rules',
    brandVoice: 'Brand voice',
    save: 'Save AI memory'
  },
  es: {
    shortDescription: 'Contexto de la empresa para Ask Everitt.',
    description: 'Perfil de la empresa, servicios y preferencias usados por Ask Everitt. Se guarda por empresa.',
    loading: 'Cargando...',
    ownersOnly: 'Solo los propietarios y administradores de la empresa pueden editar la memoria de IA.',
    companyProfile: 'Perfil de la empresa',
    services: 'Servicios',
    serviceAreas: 'Áreas de servicio',
    pricingRules: 'Reglas de precios',
    brandVoice: 'Tono de marca',
    save: 'Guardar memoria de IA'
  },
  vi: {
    shortDescription: 'Ngữ cảnh công ty cho Ask Everitt.',
    description: 'Hồ sơ công ty, dịch vụ và tùy chọn được Ask Everitt sử dụng. Lưu theo từng công ty.',
    loading: 'Đang tải...',
    ownersOnly: 'Chỉ chủ sở hữu và quản trị viên công ty mới có thể chỉnh sửa bộ nhớ AI.',
    companyProfile: 'Hồ sơ công ty',
    services: 'Dịch vụ',
    serviceAreas: 'Khu vực phục vụ',
    pricingRules: 'Quy tắc giá',
    brandVoice: 'Giọng điệu thương hiệu',
    save: 'Lưu bộ nhớ AI'
  }
} as const;

export default function AiMemorySettingsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const c = copy[locale] || copy.en;
  const { busy: saving, run, buttonLabel } = useAsyncAction({ successMessage: 'saved' });
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [orgId, setOrgId] = useState('');
  const [companyProfile, setCompanyProfile] = useState('');
  const [services, setServices] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [pricingRules, setPricingRules] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?next=/settings/ai-memory');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      const p = normalizePlan(profile?.plan);
      const r = normalizeRole(profile?.role);
      setPlan(p);
      setRole(r);

      const org = await fetchOrganizationContext(user.id);
      if (!org) {
        setLoading(false);
        return;
      }
      setOrgId(org.organizationId);

      const { data } = await supabase
        .from('organization_ai_memory')
        .select('*')
        .eq('organization_id', org.organizationId)
        .maybeSingle();

      if (data) {
        setCompanyProfile(data.company_profile || '');
        setServices(data.services || '');
        setBrandVoice(data.brand_voice || '');
        setPricingRules(data.pricing_rules || '');
        setServiceAreas(data.service_areas || '');
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!orgId || saving) return;

    await run(async () => {
      const { error } = await supabase.from('organization_ai_memory').upsert({
        organization_id: orgId,
        company_profile: companyProfile.trim() || null,
        services: services.trim() || null,
        brand_voice: brandVoice.trim() || null,
        pricing_rules: pricingRules.trim() || null,
        service_areas: serviceAreas.trim() || null,
        updated_at: new Date().toISOString()
      });
      if (error) throw new Error(error.message);
    });
  }

  const title = t('settingsNav.aiMemory');

  if (loading) {
    return (
      <SettingsShell plan={plan} role={role} title={title} description={c.shortDescription}>
        <p>{c.loading}</p>
      </SettingsShell>
    );
  }

  if (!canAccessFeature(plan, 'aiAccess')) {
    return (
      <SettingsShell plan={plan} role={role} title={title} description={c.shortDescription}>
        <PlanLockedMessage feature={title} requiredPlan="Business" />
      </SettingsShell>
    );
  }

  if (!canManageOrganizationSettings(role)) {
    return (
      <SettingsShell plan={plan} role={role} title={title} description={c.shortDescription}>
        <div className="settings-card">
          <p>{c.ownersOnly}</p>
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell plan={plan} role={role} title={title} description={c.description}>
      <form className="settings-card form" onSubmit={save}>
        <label>
          {c.companyProfile}
          <textarea className="input" rows={4} value={companyProfile} onChange={(e) => setCompanyProfile(e.target.value)} />
        </label>
        <label>
          {c.services}
          <textarea className="input" rows={3} value={services} onChange={(e) => setServices(e.target.value)} />
        </label>
        <label>
          {c.serviceAreas}
          <input className="input" value={serviceAreas} onChange={(e) => setServiceAreas(e.target.value)} />
        </label>
        <label>
          {c.pricingRules}
          <textarea className="input" rows={3} value={pricingRules} onChange={(e) => setPricingRules(e.target.value)} />
        </label>
        <label>
          {c.brandVoice}
          <textarea className="input" rows={3} value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {buttonLabel(c.save, FEEDBACK.loading)}
        </button>
      </form>
    </SettingsShell>
  );
}
