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
    body: 'Open a job to review photos, work details, the customer summary, and its shareable report.',
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
    body: 'Review revenue, costs, balances due, and operating results from the dashboard.',
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
      <section className="today-page reports-page">
        <header className="page-head" style={{ marginBottom: 18 }}>
          <div>
            <p className="eyebrow">Operations</p>
            <h1>Reports</h1>
            <p className="page-subtitle">Review completed work, customer history, photos, and business performance.</p>
          </div>
        </header>

        {loading ? (
          <section className="card">
            <p className="loading-state" role="status">Loading reports...</p>
          </section>
        ) : (
          <div className="reports-card-list">
            {reportSections.map((section) => (
              <article className="list-row reports-card" key={section.title}>
                <div className="reports-card-copy">
                  <h2>{section.title}</h2>
                  <p className="muted">{section.body}</p>
                </div>
                <Link className="btn" href={section.href}>
                  {section.action}
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <style jsx global>{`
        .reports-page {
          width: 100% !important;
          max-width: none !important;
        }

        .reports-card-list {
          display: grid;
          gap: 12px;
          width: 100%;
        }

        .reports-card {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 20px !important;
          width: 100% !important;
          min-width: 0 !important;
          padding: 22px 24px !important;
          border-radius: 18px !important;
          background: #ffffff !important;
          box-shadow: 0 9px 26px rgba(37, 54, 74, 0.08) !important;
        }

        .reports-card-copy {
          flex: 1;
          min-width: 0;
        }

        .reports-card h2,
        .reports-card p {
          margin: 0;
        }

        .reports-card h2 {
          margin-bottom: 5px;
          font-size: 1.05rem;
        }

        @media (max-width: 640px) {
          .reports-card {
            align-items: flex-start !important;
            flex-direction: column !important;
          }
        }
      `}</style>
    </AppShell>
  );
}
