import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeOrgMemberships } from '@/lib/org-memberships';

describe('normalizeOrgMemberships', () => {
  it('dedupes by organization id and drops soft-deleted orgs', () => {
    const result = normalizeOrgMemberships(
      [
        {
          organizationId: 'org-1',
          organizationName: 'Everitt Ventures',
          role: 'owner',
          isOwner: true,
          deletedAt: null
        },
        {
          organizationId: 'org-1',
          organizationName: 'Everitt Ventures',
          role: 'owner',
          isOwner: true,
          deletedAt: null
        },
        {
          organizationId: 'org-deleted',
          organizationName: 'Old Workspace',
          role: 'owner',
          isOwner: true,
          deletedAt: '2026-07-01T00:00:00Z'
        }
      ],
      'org-1'
    );

    assert.equal(result.length, 1);
    assert.equal(result[0]?.organizationId, 'org-1');
  });

  it('collapses owner-side duplicate workspace names preferring the active org', () => {
    const result = normalizeOrgMemberships(
      [
        {
          organizationId: 'org-a',
          organizationName: 'Everitt Ventures',
          role: 'owner',
          isOwner: true
        },
        {
          organizationId: 'org-b',
          organizationName: 'Everitt Ventures',
          role: 'owner',
          isOwner: true
        },
        {
          organizationId: 'org-client',
          organizationName: 'Client Co',
          role: 'contractor',
          isOwner: false
        }
      ],
      'org-b'
    );

    assert.equal(result.length, 2);
    assert.deepEqual(
      result.map((row) => row.organizationId).sort(),
      ['org-b', 'org-client'].sort()
    );
  });

  it('keeps distinct owned workspace names', () => {
    const result = normalizeOrgMemberships(
      [
        {
          organizationId: 'org-a',
          organizationName: 'Alpha',
          role: 'owner',
          isOwner: true
        },
        {
          organizationId: 'org-b',
          organizationName: 'Beta',
          role: 'owner',
          isOwner: true
        }
      ],
      'org-a'
    );

    assert.equal(result.length, 2);
  });
});
