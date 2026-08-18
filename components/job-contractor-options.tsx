'use client';

import { useEffect } from 'react';
import { saveJobAssignment } from '@/lib/job-assignment-write';
import { supabase } from '@/lib/supabase';
import { ensureWorkspaceForSave } from '@/lib/workspace-client';

type Contractor = {
  id: string;
  name: string;
  company_name?: string | null;
  auth_user_id?: string | null;
  active?: boolean | null;
};

type CreateResponse = {
  job?: { id?: string };
  firstJobId?: string | null;
  jobs?: Array<{ id?: string }>;
  series?: { id?: string };
};

const MANUAL_WORKER_PREFIX = 'worker:';

function contractorLabel(contractor: Contractor) {
  return contractor.company_name
    ? `${contractor.name} · Contractor · ${contractor.company_name}`
    : `${contractor.name} · Contractor`;
}

function surfaceWorkerPay() {
  const assignedSelect = document.querySelector<HTMLSelectElement>('#assigned-to');
  const contractorSection = assignedSelect?.closest<HTMLElement>('section');
  const form = assignedSelect?.closest<HTMLFormElement>('form');
  if (!contractorSection || !form) return;

  const moreDetails = Array.from(form.querySelectorAll<HTMLDetailsElement>('details')).find((item) =>
    item.querySelector('summary')?.textContent?.trim().toLowerCase().includes('more options')
  );
  if (!moreDetails) return;

  const paySection = Array.from(moreDetails.querySelectorAll<HTMLElement>('section')).find((section) => {
    const text = section.textContent?.toLowerCase() || '';
    return (
      text.includes('how the contractor is paid') ||
      text.includes('what the contractor earns') ||
      text.includes('contractor hourly rate') ||
      text.includes('worker pay')
    );
  });
  if (!paySection) return;

  if (paySection.dataset.workerPayReady !== 'true') {
    paySection.dataset.workerPayReady = 'true';

    const heading = document.createElement('h4');
    heading.textContent = 'Worker pay';
    heading.style.marginBottom = '12px';
    paySection.prepend(heading);

    for (const node of Array.from(paySection.querySelectorAll<HTMLElement>('label, .finance-metric-label, p'))) {
      if (!node.textContent) continue;
      node.textContent = node.textContent
        .replaceAll('contractor', 'worker')
        .replaceAll('Contractor', 'Worker');
    }

    for (const label of Array.from(paySection.querySelectorAll<HTMLLabelElement>('label'))) {
      const text = label.textContent?.trim().toLowerCase() || '';
      if (text.includes('additional expected expenses') || text.includes('expense description')) {
        const input = label.nextElementSibling as HTMLElement | null;
        label.style.display = 'none';
        if (input) input.style.display = 'none';
      }
    }

    for (const grid of Array.from(paySection.querySelectorAll<HTMLElement>('.financials-summary-grid'))) {
      grid.style.display = 'none';
    }

    for (const paragraph of Array.from(paySection.querySelectorAll<HTMLParagraphElement>('p.muted'))) {
      if (paragraph.textContent?.toLowerCase().includes('expected profit')) {
        paragraph.style.display = 'none';
      }
    }
  }

  if (paySection.parentElement !== form || paySection.previousElementSibling !== contractorSection) {
    contractorSection.insertAdjacentElement('afterend', paySection);
  }
}

export function JobContractorOptions() {
  useEffect(() => {
    let cancelled = false;
    let contractors: Contractor[] = [];
    const originalFetch = window.fetch.bind(window);

    function applyOptions() {
      surfaceWorkerPay();
      const select = document.querySelector<HTMLSelectElement>('#assigned-to');
      if (!select || contractors.length === 0) return;

      const existingValues = new Set(Array.from(select.options).map((option) => option.value));
      for (const contractor of contractors) {
        if (contractor.active === false) continue;
        const value = contractor.auth_user_id || `${MANUAL_WORKER_PREFIX}${contractor.id}`;
        if (existingValues.has(value)) continue;

        const option = document.createElement('option');
        option.value = value;
        option.textContent = contractorLabel(contractor);
        option.dataset.workerId = contractor.id;
        option.dataset.contractorName = contractor.name;
        option.dataset.manualContractor = contractor.auth_user_id ? 'false' : 'true';
        select.appendChild(option);
        existingValues.add(value);
      }
    }

    async function loadContractors() {
      const response = await originalFetch('/api/contractors', { cache: 'no-store' });
      const json = (await response.json().catch(() => ({}))) as { contractors?: Contractor[] };
      if (!response.ok || cancelled) return;
      contractors = json.contractors || [];
      applyOptions();
    }

    async function attachManualContractor(response: Response, workerId: string, requestUrl: string) {
      if (!response.ok) return;
      const json = (await response.clone().json().catch(() => ({}))) as CreateResponse;
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      const workspace = await ensureWorkspaceForSave(user.id);
      if (!workspace.ok) return;

      const jobIds = new Set<string>();
      if (json.job?.id) jobIds.add(json.job.id);
      if (json.firstJobId) jobIds.add(json.firstJobId);
      for (const job of json.jobs || []) {
        if (job.id) jobIds.add(job.id);
      }

      for (const jobId of jobIds) {
        await saveJobAssignment(supabase, {
          organizationId: workspace.workspace.organizationId,
          userId: user.id,
          jobId,
          workerId
        });
      }

      if (requestUrl.includes('/api/recurring-jobs') && json.series?.id) {
        await supabase
          .from('recurring_job_series')
          .update({ preferred_contractor_id: workerId, updated_at: new Date().toISOString() })
          .eq('id', json.series.id)
          .eq('organization_id', workspace.workspace.organizationId);
      }
    }

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const isJobCreate =
        init?.method?.toUpperCase() === 'POST' &&
        (requestUrl.endsWith('/api/jobs') || requestUrl.endsWith('/api/recurring-jobs'));

      if (!isJobCreate || typeof init?.body !== 'string') {
        return originalFetch(input, init);
      }

      const select = document.querySelector<HTMLSelectElement>('#assigned-to');
      const selectedOption = select?.selectedOptions[0];
      const selectedValue = selectedOption?.value || '';
      if (!selectedValue.startsWith(MANUAL_WORKER_PREFIX)) {
        return originalFetch(input, init);
      }

      const workerId = selectedValue.slice(MANUAL_WORKER_PREFIX.length);
      if (!workerId) return originalFetch(input, init);

      const body = JSON.parse(init.body) as Record<string, unknown>;
      body.assigned_to = null;
      if (selectedOption?.dataset.contractorName) {
        body.contractor_name = selectedOption.dataset.contractorName;
      }

      const response = await originalFetch(input, { ...init, body: JSON.stringify(body) });
      await attachManualContractor(response, workerId, requestUrl);
      return response;
    };

    void loadContractors();
    surfaceWorkerPay();

    const observer = new MutationObserver(() => {
      applyOptions();
      surfaceWorkerPay();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
