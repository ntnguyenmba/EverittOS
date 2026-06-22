'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { PlanLockedMessage } from '@/components/plan-locked-message';
import type { EverittosPlan } from '@/lib/everittos-plans';
import { type UserRole } from '@/lib/roles';
import { useWorkspacePlan } from '@/components/workspace-plan-provider';

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
  const workspacePlan = useWorkspacePlan();
  const plan = workspacePlan.plan || 'free';
  const role: UserRole = workspacePlan.role || 'owner';
  const loading = workspacePlan.loading;

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
