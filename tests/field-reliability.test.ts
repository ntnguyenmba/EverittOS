import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path: string) { return readFileSync(path, 'utf8'); }

test('shared shell runs offline sync recovery', () => {
  const shell = read('components/app-shell.tsx');
  assert.match(shell, /OfflineSyncManager/);
});

test('offline request queue dedupes saves and retries transient failures', () => {
  const source = read('lib/offline-request-queue.ts');
  assert.match(source, /dedupeKey/);
  assert.match(source, /navigator\.onLine/);
  assert.match(source, /Idempotency-Key/);
  assert.match(source, /status >= 500/);
});

test('contractor field flow keeps offline status and photo outbox', () => {
  const source = read('lib/contractor-offline.ts');
  assert.match(source, /queueContractorStatus/);
  assert.match(source, /queueContractorPhoto/);
  assert.match(source, /drainContractorOutbox/);
  assert.match(source, /Idempotency-Key/);
});

test('field photo capture remains tagged before and after', () => {
  const source = read('app/portal/contractor/jobs/[id]/page.tsx');
  assert.match(source, /takePhoto\('before'\)/);
  assert.match(source, /takePhoto\('after'\)/);
  assert.match(source, /capture="environment"/);
});

test('calendar job sync retries transient failures without blocking job saves', () => {
  const source = read('lib/google-calendar-sync-job.ts');
  assert.match(source, /RETRY_DELAYS_MS/);
  assert.match(source, /isRetryableCalendarError/);
  assert.match(source, /syncJobToGoogleCalendar/);
});
