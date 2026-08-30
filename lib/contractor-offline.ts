'use client';

import { getFieldRecord, listFieldOutbox, putFieldRecord, queueFieldChange, removeFieldOutbox } from '@/lib/native-field-store';
import type { ContractorSafeJobView } from '@/lib/contractor-job-access';

export type CachedContractorDashboard = {
  savedAt: string;
  workerName: string;
  jobs: unknown[];
  totals: unknown;
};

function scopedKey(userId: string, key: string) {
  return `${userId}:${key}`;
}

export async function saveContractorDashboard(userId: string, payload: Omit<CachedContractorDashboard, 'savedAt'>) {
  if (!userId) return;
  await putFieldRecord('worker-dashboard', scopedKey(userId, 'dashboard'), {
    ...payload,
    savedAt: new Date().toISOString()
  });
}

export async function readContractorDashboard(userId: string): Promise<CachedContractorDashboard | null> {
  if (!userId) return null;
  return getFieldRecord<CachedContractorDashboard>('worker-dashboard', scopedKey(userId, 'dashboard'));
}

export async function saveContractorJob(userId: string, job: ContractorSafeJobView) {
  if (!userId || !job?.id) return;
  await putFieldRecord('job-detail', scopedKey(userId, job.id), {
    ...job,
    cachedAt: new Date().toISOString()
  });
}

export async function readContractorJob(userId: string, jobId: string): Promise<ContractorSafeJobView | null> {
  if (!userId || !jobId) return null;
  return getFieldRecord<ContractorSafeJobView>('job-detail', scopedKey(userId, jobId));
}

export async function queueContractorStatus(userId: string, jobId: string, status: 'active' | 'completed') {
  const type = status === 'completed' ? 'job.finish' : 'job.start';
  await queueFieldChange(type, scopedKey(userId, jobId), { userId, jobId, status });
}

export async function drainContractorOutbox(): Promise<number> {
  const items = await listFieldOutbox();
  let drained = 0;
  for (const item of items) {
    if (item.type !== 'job.start' && item.type !== 'job.finish') continue;
    try {
      const payload = JSON.parse(item.json) as { jobId?: string; status?: 'active' | 'completed' };
      if (!payload.jobId || !payload.status) continue;
      const response = await fetch(`/api/portal/contractor/jobs/${encodeURIComponent(payload.jobId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: payload.status })
      });
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
          await removeFieldOutbox(item.id);
        }
        continue;
      }
      await removeFieldOutbox(item.id);
      drained += 1;
    } catch {
      break;
    }
  }
  return drained;
}
