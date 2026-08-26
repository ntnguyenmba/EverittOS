import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOnboardingAccessState } from '@/lib/onboarding-access';
import { resolveWorkspaceDeletionState } from '@/lib/workspace-access';
import { resolveMiddlewareClientRepair, shouldAttemptMiddlewareClientRepair } from '@/lib/middleware-client-repair';

function onboardingClient(row: Record<string, unknown> | null) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: row })
              };
            }
          };
        }
      };
    }
  };
}

test('onboarding defaults to complete when there is no organization', async () => {
  const state = await resolveOnboardingAccessState(onboardingClient(null), null);
  assert.deepEqual(state, { completed: true, skipped: false });
});

test('onboarding reads completed and skipped state', async () => {
  const state = await resolveOnboardingAccessState(
    onboardingClient({ onboarding_completed: true, onboarding_skipped: true }),
    'org-1'
  );
  assert.deepEqual(state, { completed: true, skipped: true });
});

function workspaceClient(options: {
  membershipOrganizationId?: string | null;
  organization?: { deleted_at?: string | null; owner_user_id?: string | null } | null;
}) {
  return {
    from(table: string) {
      if (table === 'organization_members') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      limit() {
                        return {
                          maybeSingle: async () => ({
                            data: options.membershipOrganizationId
                              ? { organization_id: options.membershipOrganizationId }
                              : null
                          })
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      }

      if (table === 'organizations') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: options.organization || null })
                };
              }
            };
          }
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }
  };
}

test('workspace access uses the profile organization when present', async () => {
  const state = await resolveWorkspaceDeletionState(
    workspaceClient({ organization: { deleted_at: null, owner_user_id: 'owner-1' } }),
    'user-1',
    'org-profile'
  );
  assert.deepEqual(state, { organizationId: 'org-profile', blocked: false });
});

test('workspace access falls back to active membership', async () => {
  const state = await resolveWorkspaceDeletionState(
    workspaceClient({
      membershipOrganizationId: 'org-member',
      organization: { deleted_at: null, owner_user_id: 'owner-1' }
    }),
    'user-1',
    null
  );
  assert.deepEqual(state, { organizationId: 'org-member', blocked: false });
});

test('deleted workspace blocks non-owner members', async () => {
  const state = await resolveWorkspaceDeletionState(
    workspaceClient({
      organization: { deleted_at: '2026-08-26T00:00:00.000Z', owner_user_id: 'owner-1' }
    }),
    'user-2',
    'org-1'
  );
  assert.deepEqual(state, { organizationId: 'org-1', blocked: true });
});

test('deleted workspace does not block its owner', async () => {
  const state = await resolveWorkspaceDeletionState(
    workspaceClient({
      organization: { deleted_at: '2026-08-26T00:00:00.000Z', owner_user_id: 'owner-1' }
    }),
    'owner-1',
    'org-1'
  );
  assert.deepEqual(state, { organizationId: 'org-1', blocked: false });
});

test('client repair is attempted only on relevant owner or client paths', () => {
  assert.equal(shouldAttemptMiddlewareClientRepair('owner', '/dashboard'), true);
  assert.equal(shouldAttemptMiddlewareClientRepair('client', '/portal/client/jobs'), true);
  assert.equal(shouldAttemptMiddlewareClientRepair('owner', '/jobs'), false);
  assert.equal(shouldAttemptMiddlewareClientRepair('contractor', '/dashboard'), true);
});

test('middleware client repair converts repaired owner into client and redirects from dashboard', async () => {
  const supabase = {
    rpc: async () => ({ data: { ok: true, skipped: false, role: 'client' } })
  };
  const result = await resolveMiddlewareClientRepair(supabase, 'user-1', 'owner', '/dashboard');
  assert.deepEqual(result, { role: 'client', repaired: true, redirectToClientJobs: true });
});

test('middleware client repair leaves protected roles unchanged', async () => {
  let called = false;
  const supabase = {
    rpc: async () => {
      called = true;
      return { data: { ok: true, skipped: false, role: 'client' } };
    }
  };
  const result = await resolveMiddlewareClientRepair(supabase, 'user-1', 'contractor', '/dashboard');
  assert.equal(called, false);
  assert.deepEqual(result, { role: 'contractor', repaired: false, redirectToClientJobs: false });
});

test('middleware client repair fails open when RPC is unavailable', async () => {
  const supabase = {
    rpc: async () => {
      throw new Error('rpc unavailable');
    }
  };
  const result = await resolveMiddlewareClientRepair(supabase, 'user-1', 'owner', '/dashboard');
  assert.deepEqual(result, { role: 'owner', repaired: false, redirectToClientJobs: false });
});
