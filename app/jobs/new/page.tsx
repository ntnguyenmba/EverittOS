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

async function withTimeout<T>(task: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), GATE_TIMEOUT_MS); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function NewJobPage() {
  const router = useRouter(); const { t } = useTranslation();
  const [plan, setPlan] = useState<EverittosPlan>('free'); const [role, setRole] = useState<UserRole>('owner'); const [authorized, setAuthorized] = useState(false); const [gateWarning, setGateWarning] = useState('');

  useEffect(() => { async function load() {
    const auth = await withTimeout(supabase.auth.getUser(), { data: { user: null }, error: new Error('Authentication timed out') } as Awaited<ReturnType<typeof supabase.auth.getUser>>);
    const user = auth.data.user; if (!user) { router.replace('/login?next=/jobs/new'); return; }

    const profileResult = await withTimeout(
      supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle(),
      { data: null, error: new Error('Profile timed out') } as Awaited<ReturnType<typeof supabase.from<'profiles'>>>
    ).catch(() => ({ data: null, error: new Error('Profile timed out') }));

    const profile = (profileResult as { data?: { plan?: string | null; role?: string | null } | null }).data || null;
    const fallbackRole = normalizeRole(profile?.role || 'owner');
    setPlan(normalizePlan(profile?.plan)); setRole(fallbackRole); setAuthorized(true);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), GATE_TIMEOUT_MS);
    try {
      const membershipsResponse = await fetch('/api/org/memberships', { cache: 'no-store', signal: controller.signal });
      if (!membershipsResponse.ok) { setGateWarning('Could not verify workspace membership. You can still use this form with your profile role.'); return; }
      const memberships = (await membershipsResponse.json()) as MembershipResponse;
      const activeRole = normalizeRole(memberships.activeRole || fallbackRole); setRole(activeRole);
      if (isContractorRole(activeRole) || isClientRole(activeRole)) { router.replace(memberships.destination || '/dashboard'); return; }
    } catch {
      setGateWarning('Workspace verification timed out. The form is available using your profile role.');
    } finally {
      window.clearTimeout(timer);
    }
  } void load(); }, [router]);

  function finishJobCreation(jobId: string) {
    router.push(`/jobs/${jobId}`);

    const params = new URLSearchParams(window.location.search);
    if (params.get('source') !== 'quotes') return;

    void (async () => {
      try {
        const encoded = params.get('quote_context'); const parsed = encoded ? JSON.parse(encoded) : {};
        await fetch(`/api/jobs/${jobId}/quote-context`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          serviceType: parsed.serviceType || params.get('service') || params.get('title') || null, sizeValue: parsed.sizeValue ?? null, sizeUnit: parsed.sizeUnit || null,
          primaryUnits: parsed.primaryUnits ?? null, extraUnits: parsed.extraUnits ?? null, condition: parsed.condition || null, frequency: parsed.frequency || null,
          addOns: Array.isArray(parsed.addOns) ? parsed.addOns : [], laborHours: parsed.laborHours ?? null, price: parsed.price ?? params.get('price') ?? params.get('client_income') ?? null,
          currency: parsed.currency || null, sourceRequest: parsed.sourceRequest || null
        }) });
        const quoteId = params.get('quote_id');
        if (quoteId) await fetch(`/api/quotes/${quoteId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'converted', jobId }) });
      } catch { }
    })();
  }

  if (!authorized) return <p className="loading-state">{t('common.loading')}</p>;
  return <AppShell plan={plan} role={role}><PageHeader title={t('dashboard.newJob')} />{gateWarning ? <div className="card" role="status"><p className="muted" style={{ margin: 0 }}>{gateWarning}</p></div> : null}<div className={styles.formWrap}><Suspense fallback={<p className="loading-state">{t('common.loading')}</p>}><JobPrefillBridge /><JobCreator onJobCreated={finishJobCreation} /><JobContractorOptions /></Suspense></div></AppShell>;
}
