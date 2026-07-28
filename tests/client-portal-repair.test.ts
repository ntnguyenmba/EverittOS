import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { canRepairAsClientRole } from '@/lib/client-portal-repair';

const migrationsDir = join(process.cwd(), 'supabase/migrations');

function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

describe('client portal access repair safety', () => {
  it('only allows client/owner roles to be repaired into client portal guests', () => {
    assert.equal(canRepairAsClientRole('client'), true);
    assert.equal(canRepairAsClientRole('owner'), true);
    assert.equal(canRepairAsClientRole('manager'), false);
    assert.equal(canRepairAsClientRole('admin'), false);
    assert.equal(canRepairAsClientRole('contractor'), false);
    assert.equal(canRepairAsClientRole('employee'), false);
    assert.equal(canRepairAsClientRole('viewer'), false);
  });

  it('ships a durable SQL repair migration for existing client invitees', () => {
    const files = migrationFiles();
    const repairName = files.find((name) => name.includes('client_portal_access_repair'));
    assert.ok(repairName, 'expected client_portal_access_repair migration');

    const sql = readFileSync(join(migrationsDir, repairName!), 'utf8');
    assert.match(sql, /repair_client_portal_access_for_user/);
    assert.match(sql, /repair_client_portal_access_all/);
    assert.match(sql, /client_repair_is_business_owner/);
    assert.match(sql, /job_client_access/);
    assert.match(sql, /organization_invitations/);
    assert.match(sql, /status = 'accepted'/);
    assert.match(sql, /expired/);
    assert.match(sql, /protected_role/);
    assert.match(sql, /data_repair_log/);
    assert.match(sql, /grant execute on function public\.repair_client_portal_access_for_user\(uuid\) to authenticated/);
    assert.doesNotMatch(sql, /update public\.profiles\s+set role = 'client'\s+where role in \('manager'/i);
  });
});
