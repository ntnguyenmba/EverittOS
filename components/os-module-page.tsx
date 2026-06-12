'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { PlanLockedMessage } from '@/components/plan-locked-message';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type OsModulePageProps = {
  title: string;
  description: string;
  requiredPlan?: EverittosPlan;
  requiredFeature?: string;
  featureCheck?: (plan: EverittosPlan) => boolean;
  children?: React.ReactNode;
  actions?: { label: string; href: string }[];
};

export function OsModulePage({
  title,
  description,
  requiredPlan,
  requiredFeature,
  featureCheck,
  children,
  actions = []
}: OsModulePageProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('plan, role').eq('id', user.id).maybeSingle();
      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));
      setLoading(false);
    }
    void load();
  }, [router]);

  const locked = featureCheck ? !featureCheck(plan) : false;

  if (loading) {
    return (
      <AppShell plan={plan} role={role}>
        <p>Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>{title}</h1>
        <p className="page-subtitle">{description}</p>
        {actions.length > 0 ? (
          <div className="settings-actions" style={{ marginTop: 12 }}>
            {actions.map((a) => (
              <Link key={a.href} href={a.href} className="btn">
                {a.label}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      {locked && requiredPlan ? (
        <PlanLockedMessage feature={requiredFeature || title} requiredPlan={requiredPlan} />
      ) : (
        children
      )}
    </AppShell>
  );
}
