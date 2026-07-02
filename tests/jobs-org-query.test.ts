import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveWorkspaceRole } from '@/lib/jobs-org-query';
import { scopeJobsForWorkspace } from '@/lib/jobs-query';

type QueryStub = {
  filters: string[];
  or(filters: string): QueryStub;
  eq(column: string, value: string): QueryStub;
  order(): QueryStub;
  select(): QueryStub;
};

function createQueryStub(): QueryStub {
  const stub: QueryStub = {
    filters: [],
    or(filters: string) {
      this.filters.push(`or:${filters}`);
      return this;
    },
    eq(column: string, value: string) {
      this.filters.push(`eq:${column}=${value}`);
      return this;
    },
    order() {
      return this;
    },
    select() {
      return this;
    }
  };
  return stub;
}

describe('jobs workspace scoping', () => {
  it('scopes manager queries to the organization and legacy own rows', () => {
    const query = createQueryStub();
    scopeJobsForWorkspace(query, 'user-1', 'org-1', 'owner');
    assert.ok(query.filters.some((f) => f.includes('organization_id.eq.org-1')));
  });

  it('scopes staff queries to own or assigned org work', () => {
    const query = createQueryStub();
    scopeJobsForWorkspace(query, 'user-2', 'org-1', 'employee');
    const orFilter = query.filters.find((f) => f.startsWith('or:'));
    assert.ok(orFilter?.includes('assigned_to.eq.user-2'));
    assert.ok(orFilter?.includes('user_id.eq.user-2'));
  });

  it('prefers membership role over profile fallback', () => {
    assert.equal(resolveWorkspaceRole('manager', 'employee'), 'manager');
    assert.equal(resolveWorkspaceRole(null, 'owner'), 'owner');
  });
});
