'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsShell } from '@/components/settings/settings-shell';
import { PlanLockedMessage } from '@/components/plan-locked-message';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FEEDBACK } from '@/lib/feedback-labels';
import { canAccessFeature } from '@/lib/plan-access';
import { fetchOrganizationContext } from '@/lib/organization';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { canManageOrganizationSettings, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

export default function AiMemorySettingsPage() {
  const router = useRouter();
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

  if (loading) {
    return (
      <SettingsShell plan={plan} role={role} title="AI Memory" description="Organization context for Ask Everitt.">
        <p>Loading...</p>
      </SettingsShell>
    );
  }

  if (!canAccessFeature(plan, 'aiAccess')) {
    return (
      <SettingsShell plan={plan} role={role} title="AI Memory" description="Organization context for Ask Everitt.">
        <PlanLockedMessage feature="AI Memory" requiredPlan="Business" />
      </SettingsShell>
    );
  }

  if (!canManageOrganizationSettings(role)) {
    return (
      <SettingsShell plan={plan} role={role} title="AI Memory" description="Organization context for Ask Everitt.">
        <div className="settings-card">
          <p>Only workspace owners and admins can edit AI memory.</p>
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell
      plan={plan}
      role={role}
      title="AI Memory"
      description="Company profile, services, and preferences used by Ask Everitt. Stored per organization."
    >
      <form className="settings-card form" onSubmit={save}>
        <label>
          Company profile
          <textarea className="input" rows={4} value={companyProfile} onChange={(e) => setCompanyProfile(e.target.value)} />
        </label>
        <label>
          Services
          <textarea className="input" rows={3} value={services} onChange={(e) => setServices(e.target.value)} />
        </label>
        <label>
          Service areas
          <input className="input" value={serviceAreas} onChange={(e) => setServiceAreas(e.target.value)} />
        </label>
        <label>
          Pricing rules
          <textarea className="input" rows={3} value={pricingRules} onChange={(e) => setPricingRules(e.target.value)} />
        </label>
        <label>
          Brand voice
          <textarea className="input" rows={3} value={brandVoice} onChange={(e) => setBrandVoice(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {buttonLabel('Save AI memory', FEEDBACK.loading)}
        </button>
      </form>
    </SettingsShell>
  );
}
