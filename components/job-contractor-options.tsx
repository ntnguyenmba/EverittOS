'use client';

import { useEffect } from 'react';

type Contractor = {
  id: string;
  name: string;
  company_name?: string | null;
  auth_user_id?: string | null;
  active?: boolean | null;
};

export function JobContractorOptions() {
  useEffect(() => {
    let cancelled = false;

    async function loadContractors() {
      const select = document.querySelector<HTMLSelectElement>('#assigned-to');
      if (!select || select.dataset.contractorsLoaded === 'true') return;

      const response = await fetch('/api/contractors', { cache: 'no-store' });
      const json = (await response.json().catch(() => ({}))) as { contractors?: Contractor[] };
      if (!response.ok || cancelled) return;

      const existingValues = new Set(Array.from(select.options).map((option) => option.value));
      for (const contractor of json.contractors || []) {
        if (contractor.active === false || !contractor.auth_user_id || existingValues.has(contractor.auth_user_id)) continue;
        const option = document.createElement('option');
        option.value = contractor.auth_user_id;
        option.textContent = contractor.company_name
          ? `${contractor.name} · Contractor · ${contractor.company_name}`
          : `${contractor.name} · Contractor`;
        select.appendChild(option);
        existingValues.add(contractor.auth_user_id);
      }

      select.dataset.contractorsLoaded = 'true';
    }

    void loadContractors();
    const observer = new MutationObserver(() => void loadContractors());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
