'use client';

const STORAGE_KEY = 'everittos.offline-request-queue.v1';

export type QueuedRequest = {
  id: string;
  dedupeKey: string;
  url: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  body: string | null;
  createdAt: string;
  attempts: number;
};

export type QueueableRequestResult = {
  ok: boolean;
  queued: boolean;
  status: number;
  json: Record<string, unknown>;
};

function canRetry(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function readQueue(): QueuedRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedRequest[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('everittos:offline-queue-changed', { detail: { count: items.length } }));
  } catch {
    // If storage is unavailable, normal online requests still continue to work.
  }
}

export function offlineQueueCount() {
  return readQueue().length;
}

export function queueJsonRequest(input: {
  dedupeKey: string;
  url: string;
  method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}) {
  const items = readQueue();
  const next: QueuedRequest = {
    id: crypto.randomUUID(),
    dedupeKey: input.dedupeKey,
    url: input.url,
    method: input.method || 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(input.headers || {}) },
    body: input.body === undefined ? null : JSON.stringify(input.body),
    createdAt: new Date().toISOString(),
    attempts: 0
  };
  const existingIndex = items.findIndex((item) => item.dedupeKey === input.dedupeKey);
  if (existingIndex >= 0) items[existingIndex] = next;
  else items.push(next);
  writeQueue(items);
  return next;
}

export async function sendQueueableJson(input: {
  dedupeKey: string;
  url: string;
  method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}): Promise<QueueableRequestResult> {
  const method = input.method || 'PATCH';
  const headers = { 'Content-Type': 'application/json', ...(input.headers || {}) };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    queueJsonRequest({ ...input, method, headers });
    return { ok: true, queued: true, status: 202, json: {} };
  }

  try {
    const response = await fetch(input.url, {
      method,
      headers,
      body: input.body === undefined ? undefined : JSON.stringify(input.body)
    });
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok && canRetry(response.status)) {
      queueJsonRequest({ ...input, method, headers });
      return { ok: true, queued: true, status: 202, json };
    }
    return { ok: response.ok, queued: false, status: response.status, json };
  } catch {
    queueJsonRequest({ ...input, method, headers });
    return { ok: true, queued: true, status: 202, json: {} };
  }
}

export async function drainOfflineRequestQueue(): Promise<{ drained: number; remaining: number }> {
  if (typeof window === 'undefined' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    const remaining = readQueue().length;
    return { drained: 0, remaining };
  }

  const items = readQueue();
  const remaining: QueuedRequest[] = [];
  let drained = 0;

  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { ...item.headers, 'Idempotency-Key': `offline-${item.id}` },
        body: item.body || undefined
      });
      if (response.ok) {
        drained += 1;
        continue;
      }
      if (canRetry(response.status)) {
        remaining.push({ ...item, attempts: item.attempts + 1 });
        continue;
      }
      // Permanent 4xx failures are removed so one bad request cannot block the field outbox.
    } catch {
      remaining.push({ ...item, attempts: item.attempts + 1 });
      remaining.push(...items.slice(items.indexOf(item) + 1));
      break;
    }
  }

  writeQueue(remaining);
  if (drained > 0) window.dispatchEvent(new CustomEvent('everittos:offline-sync-complete', { detail: { drained } }));
  return { drained, remaining: remaining.length };
}
