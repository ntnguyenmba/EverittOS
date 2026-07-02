#!/usr/bin/env node
/**
 * Apply pending production migrations in order.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/apply-pending-migrations.mjs
 *
 * Or set SUPABASE_DB_URL (direct Postgres connection string from Supabase Dashboard).
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const PENDING = [
  'supabase/migrations/202606210002_organizations_plan_mirror.sql',
  'supabase/migrations/202608250001_growth_ai_access.sql',
  'supabase/migrations/202608250002_plan_for_organization_subscription.sql',
  'supabase/migrations/202608250003_automations_api_only_writes.sql'
];

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('Missing DATABASE_URL or SUPABASE_DB_URL.');
  console.error('Get the direct connection string from Supabase Dashboard → Project Settings → Database.');
  process.exit(1);
}

const psql = spawnSync('which', ['psql'], { encoding: 'utf8' });
if (psql.status !== 0) {
  console.error('psql is required. Install PostgreSQL client tools or use Supabase SQL Editor to run:');
  PENDING.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

for (const rel of PENDING) {
  const path = join(root, rel);
  const sql = readFileSync(path, 'utf8');
  console.log(`\n=== Applying ${rel} ===`);
  const result = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', path], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`Failed applying ${rel}`);
    process.exit(result.status || 1);
  }
  console.log(`OK: ${rel}`);
}

console.log('\nAll pending migrations applied successfully.');
