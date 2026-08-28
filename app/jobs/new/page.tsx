'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { JobContractorOptions } from '@/components/job-contractor-options';
import { JobCreator } from '@/components/job-creator';
import { PageHeader } from '@/components/page-header';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isClientRole, isContractorRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/components/locale-provider';
import { JobPrefillBridge } from './job-prefill-bridge';
import styles from './job-form-simplify.module.css';

type MembershipResponse = { activeRole?: string | null; destination?: string | null };
const GATE_TIMEOUT_MS = 4000;

export default function NewJobPage() {
  const router = useRouter(); const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free'); const [role, setRole] = useState<UserRole>('owner'); const [gateWarning, setGateWarning] = useState('');

  useEffect(() => { let cancelled = false; async function load() {
    /* The protected route has already passed the server auth boundary. Paint the
       form immediately; browser auth/profile reads only refine plan and role. */
    let userId: string | null = null;
    try {
      const session = await supabase.auth.getSession();
      userId = session.data.session?.user?.id || null;
      if (!userId) {
        const auth = await supabase.auth.getUser();
        userId = auth.data.user?.id || null;
      }
    } catch {
      setGateWarning('Account details are still syncing. You can start entering this job now.');
    }
    if (cancelled || !userId) return;

    let fallbackRole: UserRole = 'owner';
    try {
      const profileResult = await supabase.from('profiles').select('plan, role').eq('id', userId).maybeSingle();
      if (cancelled) return;
      const profile = profileResult.data as { plan?: string | null; role?: string | null } | null;
      fallbackRole = normalizeRole(profile?.role || 'owner');
      setPlan(normalizePlan(profile?.plan)); setRole(fallbackRole);
    } catch {
      setGateWarning('Workspace details are still syncing. You can continue entering the job.');
    }

    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), GATE_TIMEOUT_MS);
    try {
      const membershipsResponse = await fetch('/api/org/memberships', { cache: 'no-store', signal: controller.signal });
      if (!membershipsResponse.ok) { setGateWarning('Could not verify workspace membership. You can continue using your profile role.'); return; }
      const memberships = (await membershipsResponse.json()) as MembershipResponse;
      if (cancelled) return;
      const activeRole = normalizeRole(memberships.activeRole || fallbackRole); setRole(activeRole);
      if (isContractorRole(activeRole) || isClientRole(activeRole)) router.replace(memberships.destination || '/dashboard');
    } catch { if (!cancelled) setGateWarning('Workspace verification is taking longer than expected. You can continue entering the job.'); }
    finally { window.clearTimeout(timer); }
  } void load(); return () => { cancelled = true; }; }, [router]);

  function finishJobCreation(jobId: string) {
    router.push(`/jobs/${jobId}`);
    const params = new URLSearchParams(window.location.search); if (params.get('source') !== 'quotes') return;
    void (async () => { try {
      const encoded = params.get('quote_context'); const parsed = encoded ? JSON.parse(encoded) : {};
      await fetch(`/api/jobs/${jobId}/quote-context`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceType: parsed.serviceType || params.get('service') || params.get('title') || null, sizeValue: parsed.sizeValue ?? null, sizeUnit: parsed.sizeUnit || null, primaryUnits: parsed.primaryUnits ?? null, extraUnits: parsed.extraUnits ?? null, condition: parsed.condition || null, frequency: parsed.frequency || null, addOns: Array.isArray(parsed.addOns) ? parsed.addOns : [], laborHours: parsed.laborHours ?? null, price: parsed.price ?? params.get('price') ?? params.get('client_income') ?? null, currency: parsed.currency || null, sourceRequest: parsed.sourceRequest || null }) });
      const quoteId = params.get('quote_id'); if (quoteId) await fetch(`/api/quotes/${quoteId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'converted', jobId }) });
    } catch {} })();
  }

  return <AppShell plan={plan} role={role}><PageHeader title={t('dashboard.newJob')} />{gateWarning ? <div className="card" role="status"><p className="muted" style={{ margin: 0 }}>{gateWarning}</p></div> : null}<div className={styles.formWrap}><Suspense fallback={<p className="loading-state">{t('common.loading')}</p>}><JobPrefillBridge /><JobCreator onJobCreated={finishJobCreation} /><JobContractorOptions /></Suspense></div></AppShell>;
}
