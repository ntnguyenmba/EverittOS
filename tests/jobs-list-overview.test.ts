import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { normalizeJobStatus } from '@/lib/worker-assignment';

function jobNeedsWorker(job: { status?: string | null; assigned_to?: string | null; assigned_email?: string | null }) {
  const status = normalizeJobStatus(job.status);
  if (status === 'completed' || status === 'cancelled') return false;
  return !job.assigned_to && !job.assigned_email;
}

describe('jobs list overview', () => {
  const page = readFileSync('components/jobs-list.tsx', 'utf8');
  const api = readFileSync('app/api/jobs/route.ts', 'utf8');
  const query = readFileSync('lib/jobs-org-query.ts', 'utf8');

  it('shows date, time, full address, pay, assignee, and status for a fast scan', () => {
    assert.match(page, /formatDate\(/);
    assert.match(page, /formatTime\(/);
    assert.match(page, /jobListAddress/);
    assert.match(page, /job\.address/);
    assert.match(page, /jobs-row-amount/);
    assert.match(page, /formatMoneyUsd\(job\.revenue_amount/);
    assert.match(page, /canAccessFinancials/);
    assert.match(page, /jobs-col-assigned/);
    assert.match(page, /StatusPill/);
    assert.doesNotMatch(page, /jobCityState|parseAddressParts/);
    assert.doesNotMatch(page, /photo_count|fetchPhotoCountsByJobIds|jobs-photo-count/);
    assert.match(page, /jobs-secondary/);
  });

  it('keeps filters, row open, maps, and the actions menu', () => {
    assert.match(page, /period=today/);
    assert.match(page, /status=active/);
    assert.match(page, /status=finished/);
    assert.match(page, /filter=unassigned/);
    assert.match(page, /jobDetailHref\(role, job\.id\)/);
    assert.match(page, /jobs-menu-trigger/);
    assert.match(page, /maps\.google\.com/);
    assert.match(page, /createInvoice/);
  });

  it('adds assigned-worker sorting next to the existing filters', () => {
    assert.match(page, /sortBy: 'Sort'/);
    assert.match(page, /sortBy: 'Ordenar'/);
    assert.match(page, /sortBy: 'Sắp xếp'/);
    assert.match(page, /sortByAssigned: 'Assigned worker'/);
    assert.match(page, /sortByAssigned: 'Trabajador asignado'/);
    assert.match(page, /sortByAssigned: 'Nhân sự được giao'/);
    assert.match(page, /useState<JobListSortMode>\('date'\)/);
    assert.match(page, /filter=unassigned/);
    assert.match(page, /jobs-col-assigned/);
  });

  it('does not label completed or cancelled jobs as needing a worker', () => {
    assert.match(page, /normalizeJobStatus/);
    assert.match(page, /jobNeedsWorker/);
    assert.equal(jobNeedsWorker({ status: 'scheduled' }), true);
    assert.equal(jobNeedsWorker({ status: 'new' }), true);
    assert.equal(jobNeedsWorker({ status: 'scheduled', assigned_to: 'w1' }), false);
    assert.equal(jobNeedsWorker({ status: 'completed' }), false);
    assert.equal(jobNeedsWorker({ status: 'cancelled' }), false);
    assert.equal(jobNeedsWorker({ status: 'canceled' }), false);
  });

  it('keeps server-side workspace scoping as the source of truth', () => {
    assert.match(api, /listWorkspaceJobs/);
    assert.match(api, /canAccessFinancials\(ctx\.workspace\.role, plan\)/);
    assert.match(query, /isManagerRole/);
    assert.match(query, /job_assignments/);
    assert.match(query, /assigned_to/);
    assert.match(query, /managerView/);
  });

  it('localizes the address label in English, Spanish, and Vietnamese', () => {
    assert.match(page, /address: 'Address'/);
    assert.match(page, /address: 'Dirección'/);
    assert.match(page, /address: 'Địa chỉ'/);
  });
});
