import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeAssignedEmail, validateAssignedEmail } from '@/lib/job-assigned-email';

describe('job assigned email', () => {
  it('normalizes and lowercases email', () => {
    assert.equal(normalizeAssignedEmail('  Oliver@Example.COM '), 'oliver@example.com');
  });

  it('returns null for empty values', () => {
    assert.equal(normalizeAssignedEmail(''), null);
    assert.equal(normalizeAssignedEmail(null), null);
  });

  it('accepts valid email', () => {
    const result = validateAssignedEmail('crew@everitt.com');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.email, 'crew@everitt.com');
  });

  it('rejects invalid email', () => {
    const result = validateAssignedEmail('not-an-email');
    assert.equal(result.ok, false);
  });
});
