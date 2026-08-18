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
const WORKER_PAY_FIELD_ID = 'visible-worker-pay';

function contractorLabel(contractor: Contractor) {
  return contractor.company_name
    ? `${contractor.name} · Contractor · ${contractor.company_name}`
    : `${contractor.name} · Contractor`;
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function JobContractorOptions() {
  useEffect(() => {
    let cancelled = false;
    let contractors: Contractor[] = [];
    const originalFetch = window.fetch.bind(window);

    function installWorkerPayField() {
      const form = document.querySelector<HTMLFormElement>('form.unified-job-form');
      const assignedSelect = document.querySelector<HTMLSelectElement>('#assigned-to');
      if (!form || !assignedSelect) return;

      const moreSummary = Array.from(form.querySelectorAll('summary')).find(
        (summary) => summary.textContent?.trim().toLowerCase() === 'more options'
      );
      const moreDetails = moreSummary?.closest('details') as HTMLDetailsElement | null;
      if (moreDetails) moreDetails.style.display = 'none';

      if (document.getElementById(WORKER_PAY_FIELD_ID)) return;

      const assignedSection = assignedSelect.closest('.job-create-section');
      if (!assignedSection) return;

      const section = document.createElement('section');
      section.className = 'job-create-section';
      section.dataset.visibleWorkerPay = 'true';

      const heading = document.createElement('h4');
      heading.textContent = 'Worker pay';

      const help = document.createElement('p');
      help.className = 'muted';
      help.textContent = 'Enter what you will pay the worker for this job.';

      const label = document.createElement('label');
      label.htmlFor = WORKER_PAY_FIELD_ID;
      label.textContent = 'Worker pay';

      const input = document.createElement('input');
      input.id = WORKER_PAY_FIELD_ID;
      input.className = 'input';
      input.type = 'number';
      input.min = '0';
      input.step = '0.01';
      input.placeholder = '0.00';
      input.inputMode = 'decimal';

      input.addEventListener('input', () => {
        if (moreDetails) moreDetails.open = true;
        const flatButton = Array.from(form.querySelectorAll<HTMLButtonElement>('button')).find(
          (button) => button.textContent?.trim().toLowerCase() === 'flat rate'
        );
        flatButton?.click();

        const hiddenPayInput = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="number"]')).find((candidate) => {
          const candidateLabel = candidate.closest('.form-group')?.querySelector('label')?.textContent?.toLowerCase() || '';
          return candidateLabel.includes('contractor earns') || candidateLabel === 'worker cost' || candidateLabel === 'worker pay';
        });
        if (hiddenPayInput) setReactInputValue(hiddenPayInput, input.value);
        if (moreDetails) moreDetails.open = false;
      });

      section.append(heading, help, label, input);
      assignedSection.insertAdjacentElement('afterend', section);
    }

    function applyOptions() {
      installWorkerPayField();
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
    installWorkerPayField();
    const observer = new MutationObserver(applyOptions);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
