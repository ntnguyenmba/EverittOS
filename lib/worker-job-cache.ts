export type CachedWorkerJob = {
  id: string;
  title: string | null;
  customerName: string | null;
  address: string | null;
  status: string | null;
  startDate: string | null;
  dueDate: string | null;
  scheduledStart: string | null;
  completedAt: string | null;
  payAmount: number | null;
  paymentStatus: 'paid' | 'pending' | 'unpaid' | null;
};

export type CachedWorkerTotals = {
  assigned: number;
  upcoming: number;
  completed: number;
  total: number;
  paid: number;
  owed: number;
};

type WorkerJobCache = {
  version: 1;
  savedAt: string;
  workerName: string;
  jobs: CachedWorkerJob[];
  totals: CachedWorkerTotals;
};

const PREFIX = 'everittos.worker-jobs.v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function cacheKey(userId: string) {
  return `${PREFIX}.${userId}`;
}

export function saveWorkerJobCache(userId: string, payload: Omit<WorkerJobCache, 'version' | 'savedAt'>) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const cache: WorkerJobCache = {
      version: 1,
      savedAt: new Date().toISOString(),
      workerName: payload.workerName,
      jobs: payload.jobs,
      totals: payload.totals
    };
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(cache));
  } catch {
    // Device storage can be unavailable in private browsing or restricted webviews.
  }
}

export function readWorkerJobCache(userId: string): WorkerJobCache | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkerJobCache;
    if (parsed?.version !== 1 || !Array.isArray(parsed.jobs) || !parsed.totals) return null;
    const savedAt = new Date(parsed.savedAt).getTime();
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(cacheKey(userId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearWorkerJobCache(userId: string) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.removeItem(cacheKey(userId));
  } catch {
    // Ignore storage cleanup failures.
  }
}
