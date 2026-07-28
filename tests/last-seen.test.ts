import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ACTIVITY_HEARTBEAT_INTERVAL_MS, ACTIVITY_HEARTBEAT_MIN_GAP_MS } from '@/lib/activity-heartbeat';
import { formatLastSeenAt, LAST_SEEN_ONLINE_MS } from '@/lib/last-seen';

describe('formatLastSeenAt', () => {
  const now = new Date('2026-07-28T15:00:00.000Z');

  it('returns Never for null, empty, or invalid values', () => {
    assert.equal(formatLastSeenAt(null, now), 'Never');
    assert.equal(formatLastSeenAt(undefined, now), 'Never');
    assert.equal(formatLastSeenAt('', now), 'Never');
    assert.equal(formatLastSeenAt('not-a-date', now), 'Never');
  });

  it('shows Online now within the 5-minute threshold', () => {
    assert.equal(formatLastSeenAt(new Date(now.getTime() - 60_000).toISOString(), now), 'Online now');
    assert.equal(
      formatLastSeenAt(new Date(now.getTime() - (LAST_SEEN_ONLINE_MS - 1)).toISOString(), now),
      'Online now'
    );
  });

  it('formats relative minutes and hours after the online window', () => {
    assert.equal(formatLastSeenAt(new Date(now.getTime() - 6 * 60_000).toISOString(), now), '6 min ago');
    assert.equal(formatLastSeenAt(new Date(now.getTime() - 18 * 60_000).toISOString(), now), '18 min ago');
    assert.equal(formatLastSeenAt(new Date(now.getTime() - 60 * 60_000).toISOString(), now), '1 hour ago');
    assert.equal(formatLastSeenAt(new Date(now.getTime() - 3 * 60 * 60_000).toISOString(), now), '3 hours ago');
  });

  it('formats yesterday, multi-day, and calendar dates', () => {
    const localNow = new Date(2026, 6, 28, 15, 0, 0);
    const yesterday = new Date(2026, 6, 27, 10, 0, 0);
    const threeDays = new Date(2026, 6, 25, 10, 0, 0);
    const january = new Date(2026, 0, 14, 12, 0, 0);

    assert.equal(formatLastSeenAt(yesterday.toISOString(), localNow), 'Yesterday');
    assert.equal(formatLastSeenAt(threeDays.toISOString(), localNow), '3 days ago');
    assert.match(formatLastSeenAt(january.toISOString(), localNow), /Jan\s+14/);
  });
});

describe('activity heartbeat configuration', () => {
  it('keeps heartbeat interval inside the 3–5 minute window', () => {
    assert.ok(ACTIVITY_HEARTBEAT_INTERVAL_MS >= 3 * 60_000);
    assert.ok(ACTIVITY_HEARTBEAT_INTERVAL_MS <= 5 * 60_000);
    assert.ok(ACTIVITY_HEARTBEAT_MIN_GAP_MS >= 3 * 60_000);
    assert.ok(ACTIVITY_HEARTBEAT_MIN_GAP_MS <= ACTIVITY_HEARTBEAT_INTERVAL_MS);
  });
});

describe('activity API route authentication', () => {
  it('rejects unauthenticated callers with 401 Unauthorized', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/account/activity/route.ts'), 'utf8');
    assert.match(source, /getUser\(\)/);
    assert.match(source, /status:\s*401/);
    assert.match(source, /Unauthorized/);
    assert.match(source, /touch_profile_last_seen|last_seen_at/);
    assert.match(source, /\.update\(\{\s*last_seen_at:/);
    assert.doesNotMatch(source, /\.update\([^)]*updated_at/);
  });

  it('ships a last_seen_at migration without removing updated_at', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/202609240001_profiles_last_seen_at.sql'),
      'utf8'
    );
    assert.match(migration, /last_seen_at timestamptz/);
    assert.match(migration, /profiles_last_seen_at_idx/);
    assert.match(migration, /touch_profile_last_seen/);
    assert.doesNotMatch(migration, /drop column.*updated_at/i);
  });

  it('team management reads last_seen_at instead of updated_at for Last Active', () => {
    const panel = readFileSync(join(process.cwd(), 'components/team/team-management-panel.tsx'), 'utf8');
    assert.match(panel, /formatLastSeenAt/);
    assert.match(panel, /last_seen_at/);
    assert.match(panel, /memberLastActive/);
    assert.doesNotMatch(
      panel,
      /memberLastActive[\s\S]*updated_at \? formatDate\(member\.profiles\.updated_at\)/
    );
  });
});
