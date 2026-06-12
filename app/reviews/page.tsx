'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { OutboundHub } from '@/components/outbound/outbound-hub';
import { normalizePlan, type EverittosPlan } from '@/lib/everittos-plans';
import { isManagerRole, normalizeRole, type UserRole } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { CustomerReview } from '@/lib/os-types';

export default function ReviewsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<EverittosPlan>('free');
  const [role, setRole] = useState<UserRole>('owner');
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [canManage, setCanManage] = useState(false);

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
      const userRole = normalizeRole(profile?.role);
      setPlan(normalizePlan(profile?.plan));
      setRole(userRole);
      setCanManage(isManagerRole(userRole));

      const res = await fetch('/api/reviews');
      const json = await res.json();
      if (res.ok) {
        setReviews(json.reviews || []);
      }
    }
    void load();
  }, [router]);

  return (
    <AppShell plan={plan} role={role}>
      <header className="page-header">
        <h1>Review Center</h1>
        <p className="page-subtitle">
          Compose a review request, send it to your customer, and track sent history. Your work saves automatically
          while you type.
        </p>
      </header>

      <OutboundHub
        docType="review"
        canManage={canManage}
        footer={
          <div className="card">
            <h3>Submitted reviews</h3>
            {reviews.length === 0 ? <p className="muted">No reviews recorded yet.</p> : null}
            {reviews.map((r) => (
              <div key={r.id} className="dashboard-today-row">
                <span>{'★'.repeat(r.rating || 0)}</span>
                <span className="muted">{r.body || 'No comment'}</span>
              </div>
            ))}
          </div>
        }
      />
    </AppShell>
  );
}
