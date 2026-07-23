import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  chooseCanonicalWorkers,
  normalizeWorkerEmail,
  scoreWorkerCandidate,
  type WorkerIdentityCandidate
} from '@/lib/worker-identity-repair';

function worker(partial: Partial<WorkerIdentityCandidate> & Pick<WorkerIdentityCandidate, 'id'>): WorkerIdentityCandidate {
  return {
    organizationId: 'org-1',
    email: 'thuy@everittventures.com',
    authUserId: null,
    active: true,
    name: 'Thuy',
    assignedJobCount: 0,
    assignmentCount: 0,
    laborCount: 0,
    laborTotal: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...partial
  };
}

describe('worker identity repair helpers', () => {
  it('normalizes emails', () => {
    assert.equal(normalizeWorkerEmail(' Thuy@EverittVentures.com '), 'thuy@everittventures.com');
  });

  it('prefers the worker with historical jobs/pay over a fresh auth-linked empty row', () => {
    const historical = worker({
      id: 'worker-old',
      authUserId: null,
      assignedJobCount: 12,
      laborCount: 8,
      laborTotal: 2400,
      createdAt: '2025-01-01T00:00:00Z'
    });
    const linkedEmpty = worker({
      id: 'worker-new',
      authUserId: 'auth-thuy',
      assignedJobCount: 0,
      laborCount: 0,
      createdAt: '2026-07-01T00:00:00Z'
    });

    assert.ok(scoreWorkerCandidate(historical, 'auth-thuy') > scoreWorkerCandidate(linkedEmpty, 'auth-thuy'));

    const choices = chooseCanonicalWorkers([historical, linkedEmpty], 'auth-thuy');
    assert.equal(choices[0]?.canonicalId, 'worker-old');
    assert.deepEqual(choices[0]?.duplicateIds, ['worker-new']);
  });

  it('when preferred auth is set, prefers auth-linked worker that also holds history', () => {
    const choices = chooseCanonicalWorkers(
      [
        worker({
          id: 'worker-old',
          authUserId: null,
          assignedJobCount: 12,
          laborCount: 8,
          laborTotal: 2400
        }),
        worker({
          id: 'worker-linked',
          authUserId: 'auth-thuy',
          assignedJobCount: 12,
          laborCount: 8,
          laborTotal: 2400
        })
      ],
      'auth-thuy'
    );

    assert.equal(choices.length, 1);
    assert.equal(choices[0]?.canonicalId, 'worker-linked');
    assert.deepEqual(choices[0]?.duplicateIds, ['worker-old']);
  });

  it('keeps separate organizations independent', () => {
    const choices = chooseCanonicalWorkers(
      [
        worker({ id: 'a1', organizationId: 'org-a', authUserId: 'auth-thuy' }),
        worker({ id: 'b1', organizationId: 'org-b', authUserId: 'auth-thuy', assignedJobCount: 3 })
      ],
      'auth-thuy'
    );
    assert.equal(choices.length, 2);
    assert.deepEqual(
      choices.map((c) => c.organizationId).sort(),
      ['org-a', 'org-b']
    );
  });
});
