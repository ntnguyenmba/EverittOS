import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeMissingWorkspaceRecords } from '@/lib/workspace-repair';

describe('workspace linkage diagnosis', () => {
  it('flags missing membership for an existing organization', () => {
    const missing = computeMissingWorkspaceRecords({
      profileId: 'profile-1',
      profileOrganizationId: 'org-1',
      organizationId: 'org-1',
      organizationExists: true,
      ownerUserId: 'owner-1',
      ownerProfileExists: true,
      membershipId: null,
      membershipActive: false
    });

    assert.deepEqual(missing, ['organization_members']);
  });

  it('flags missing profile organization link when membership exists', () => {
    const missing = computeMissingWorkspaceRecords({
      profileId: 'profile-1',
      profileOrganizationId: null,
      organizationId: 'org-1',
      organizationExists: true,
      ownerUserId: 'owner-1',
      ownerProfileExists: true,
      membershipId: 'member-1',
      membershipActive: true
    });

    assert.deepEqual(missing, ['profile_organization_link']);
  });

  it('flags missing organization when profile references a deleted org', () => {
    const missing = computeMissingWorkspaceRecords({
      profileId: 'profile-1',
      profileOrganizationId: 'org-missing',
      organizationId: 'org-missing',
      organizationExists: false,
      ownerUserId: null,
      ownerProfileExists: false,
      membershipId: null,
      membershipActive: false
    });

    assert.deepEqual(missing, ['organization']);
  });

  it('returns no missing records for a complete workspace linkage', () => {
    const missing = computeMissingWorkspaceRecords({
      profileId: 'profile-1',
      profileOrganizationId: 'org-1',
      organizationId: 'org-1',
      organizationExists: true,
      ownerUserId: 'owner-1',
      ownerProfileExists: true,
      membershipId: 'member-1',
      membershipActive: true
    });

    assert.deepEqual(missing, []);
  });
});
