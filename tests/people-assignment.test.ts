import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveAssignedUserId, type PersonAssignmentOption } from '@/lib/people-assignment';

const people: PersonAssignmentOption[] = [
  { userId: 'user-1', workerId: 'worker-1', name: 'Oliver', role: 'employee' },
  { userId: 'worker-legacy', workerId: 'worker-legacy', name: 'Legacy crew', role: 'crew' }
];

describe('people assignment helpers', () => {
  it('resolves assigned user id from member user id', () => {
    assert.equal(resolveAssignedUserId('user-1', people), 'user-1');
  });

  it('resolves assigned user id from legacy worker id', () => {
    assert.equal(resolveAssignedUserId('worker-1', people), 'user-1');
  });

  it('returns empty string when unassigned', () => {
    assert.equal(resolveAssignedUserId(null, people), '');
  });
});
