'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';

const reportSections = [
  {
    title: 'Job reports',
    body: 'Open a job to review its photos, work details, customer summary, and shareable report.',
    href: '/jobs',
    action: 'View jobs'
  },
  {
    title: 'Customers',
    body: 'Find completed work and related job history by customer.',
    href: '/customers',
    action: 'View customers'
  },
  {
    title: 'Business performance',
    body: 'Review revenue, costs, outstanding balances, and operating results from the dashboard.',
    href: '/dashboard',
    action: 'View dashboard'
  }
];

export default function ReportsPage() {
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
        router.replace('/login?next=/reports');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, role')
        .eq('id', user.id)
        .maybeSingle();

      setPlan(normalizePlan(profile?.plan));
      setRole(normalizeRole(profile?.role));
      setLoading(false);
    }

    void load();
  }, [router]);

  return (
    <AppShell plan={plan} role={role} showBackButton={false}>
      <section className="today-page">
        <header className="page-head">
          <div>
            <p className="eyebrow">Operations</p>
            <h1>Reports</h1>
            <p className="page-subtitle">Review completed work, customer records, photos, and business performance.</p>
          </div>
        </header>

        {loading ? (
          <section className="card">
            <p className="loading-state" role="status">Loading reports...</p>
          </section>
        ) : (
          <div className="settings-grid">
            {reportSections.map((section) => (
              <section className="settings-card" key={section.title}>
                <h2>{section.title}</h2>
                <p className="muted">{section.body}</p>
                <Link className="btn" href={section.href}>
                  {section.action}
                </Link>
              </section>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
