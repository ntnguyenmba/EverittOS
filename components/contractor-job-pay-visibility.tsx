'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function money(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(amount);
}

export function ContractorJobPayVisibility() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith('/portal/contractor')) return;

    let cancelled = false;
    let observer: MutationObserver | null = null;

    async function loadPay() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: workers } = await supabase
        .from('workers')
        .select('id')
        .or(`auth_user_id.eq.${user.id},email.ilike.${user.email || ''}`);

      const workerIds = (workers || []).map((row: { id?: string | null }) => String(row.id || '')).filter(Boolean);
      if (!workerIds.length || cancelled) return;

      const { data: assignments } = await supabase
        .from('job_assignments')
        .select('job_id')
        .in('worker_id', workerIds);

      const assignedJobIds = (assignments || []).map((row: { job_id?: string | null }) => String(row.job_id || '')).filter(Boolean);

      const direct = await supabase
        .from('jobs')
        .select('id, expected_contractor_cost')
        .or(`assigned_to.in.(${workerIds.join(',')}),assigned_to.eq.${user.id}`);

      const assigned = assignedJobIds.length
        ? await supabase.from('jobs').select('id, expected_contractor_cost').in('id', assignedJobIds)
        : { data: [] as Array<{ id: string; expected_contractor_cost: number | null }> };

      const payByJob = new Map<string, number>();
      for (const row of [...(direct.data || []), ...(assigned.data || [])]) {
        const amount = Number(row.expected_contractor_cost || 0);
        if (amount >= 0) payByJob.set(String(row.id), amount);
      }

      function apply() {
        document.querySelectorAll<HTMLButtonElement>('button[aria-controls^="contractor-job-"]').forEach((button) => {
          const jobId = button.getAttribute('aria-controls')?.replace('contractor-job-', '') || '';
          const amount = payByJob.get(jobId);
          if (amount == null) return;

          const existing = button.querySelector<HTMLElement>('[data-contractor-pay]');
          const label = `You'll earn ${money(amount)}`;
          if (existing) {
            existing.textContent = label;
            return;
          }

          const badge = document.createElement('div');
          badge.dataset.contractorPay = 'true';
          badge.textContent = label;
          badge.style.marginTop = '12px';
          badge.style.display = 'inline-flex';
          badge.style.alignItems = 'center';
          badge.style.padding = '8px 12px';
          badge.style.borderRadius = '999px';
          badge.style.background = 'rgba(36, 63, 83, 0.1)';
          badge.style.fontWeight = '700';
          badge.style.fontSize = '14px';
          badge.style.lineHeight = '1.2';
          button.appendChild(badge);
        });
      }

      apply();
      observer = new MutationObserver(apply);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    void loadPay();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
