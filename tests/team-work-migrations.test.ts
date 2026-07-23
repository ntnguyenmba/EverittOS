import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const migrationsDir = join(process.cwd(), 'supabase/migrations');

function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function readMigration(name: string): string {
  return readFileSync(join(migrationsDir, name), 'utf8');
}

describe('team work migration safety', () => {
  it('defines can_manage_org_work using production-safe helpers', () => {
    const repair = readMigration('202609070001_team_work_rls_prerequisite_repair.sql');
    assert.match(repair, /create or replace function public\.can_manage_org_work/);
    assert.match(repair, /can_manage_organization\(p_org_id\)/);
    assert.match(repair, /owner_user_id = auth\.uid\(\)/);
    assert.doesNotMatch(repair, /current_org_role\(p_org_id\) in \('owner'/);
  });

  it('creates current_org_role as an alias to member_role_in_org', () => {
    const repair = readMigration('202609070001_team_work_rls_prerequisite_repair.sql');
    assert.match(repair, /create or replace function public\.current_org_role/);
    assert.match(repair, /member_role_in_org\(p_org_id\)/);
  });

  it('does not leave team-work migrations depending on undefined SQL helpers', () => {
    const teamWorkMigrations = migrationFiles().filter((name) => name >= '202609010001');
    const requiredHelpers = ['can_manage_org_work', 'record_shared_with_current_user', 'member_role_in_org'];

    for (const name of teamWorkMigrations) {
      const sql = readMigration(name);
      if (!sql.includes('can_manage_org_work')) continue;

      for (const helper of requiredHelpers) {
        if (!sql.includes(helper)) continue;
        if (helper === 'member_role_in_org') {
          assert.match(
            sql,
            /member_role_in_org/,
            `${name} references team work helpers but must use member_role_in_org`
          );
        }
      }

      if (sql.includes('create or replace function public.can_manage_org_work')) {
        assert.match(
          sql,
          /can_manage_organization/,
          `${name} must define can_manage_org_work via can_manage_organization`
        );
      }
    }
  });

  it('keeps analytics and jobs list on organization-scoped jobs queries in TypeScript', () => {
    const analytics = readFileSync(join(process.cwd(), 'app/api/analytics/summary/route.ts'), 'utf8');
    const jobsApi = readFileSync(join(process.cwd(), 'app/api/jobs/route.ts'), 'utf8');
    const jobsOrgQuery = readFileSync(join(process.cwd(), 'lib/jobs-org-query.ts'), 'utf8');

    assert.match(analytics, /countOrganizationJobs/);
    assert.doesNotMatch(analytics, /eventCounts\.job_created/);
    assert.match(jobsApi, /listWorkspaceJobs/);
    assert.match(jobsOrgQuery, /organization_id/);
  });

  it('repairs contractor worker identity and restores is_assigned_to_job on jobs RLS', () => {
    const identityRepair = readMigration('202609190001_contractor_worker_identity_repair.sql');
    assert.match(identityRepair, /create or replace function public\.is_assigned_to_job/);
    assert.match(identityRepair, /w\.id = j\.assigned_to/);
    assert.match(identityRepair, /public\.is_assigned_to_job\(id\)/);
    assert.match(identityRepair, /repair_contractor_worker_identity/);
    assert.match(identityRepair, /thuy@everittventures\.com/);
    assert.match(identityRepair, /workers_org_email_active_unique/);
    assert.match(identityRepair, /workers_org_auth_user_unique/);
    assert.match(identityRepair, /data_repair_log/);

    const laborSelf = readMigration('202609200001_contractor_job_labor_self_select.sql');
    assert.match(laborSelf, /job_labor_org_select/);
    assert.match(laborSelf, /w\.auth_user_id = auth\.uid\(\)/);
    assert.match(laborSelf, /can_manage_org_work/);

    const authRelink = readMigration('202609210001_contractor_worker_auth_relink.sql');
    assert.match(authRelink, /Relink existing contractor workers/);
    assert.match(authRelink, /workers_self_auth_select/);
    assert.match(authRelink, /auth_user_id = r\.auth_user_id/);
    assert.doesNotMatch(authRelink, /insert into public\.workers/i);

    const laterMigrations = migrationFiles().filter((name) => name > '202609210001_contractor_worker_auth_relink.sql');
    for (const name of laterMigrations) {
      const sql = readMigration(name);
      if (!sql.includes('jobs_team_work_read')) continue;
      assert.match(
        sql,
        /is_assigned_to_job\(id\)/,
        `${name} must not drop contractor assignment visibility from jobs_team_work_read`
      );
    }
  });
});
