import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyJobWriteError,
  extractUnknownJobColumn,
  inferFailureCodeFromSafeMessage,
  maskCalendarUid,
  safeGroupedFailureMessage,
  sanitizeCalendarErrorText
} from '@/lib/calendar-import/errors';
import { toSafeCalendarImportResult } from '@/lib/calendar-import/safe-status';

describe('calendar import error reporting', () => {
  it('classifies unique conflicts separately from insert failures', () => {
    assert.equal(classifyJobWriteError('duplicate key value violates unique constraint', '23505'), 'duplicate_conflict');
    assert.equal(classifyJobWriteError('invalid input syntax for type date'), 'invalid_event_time');
    assert.equal(classifyJobWriteError('jobs_timezone_valid_check'), 'invalid_timezone');
    assert.equal(classifyJobWriteError('Could not create imported job.'), 'job_insert_failed');
    assert.equal(
      classifyJobWriteError("Could not find the 'external_source' column of 'jobs' in the schema cache", 'PGRST204'),
      'schema_mismatch'
    );
    assert.equal(extractUnknownJobColumn({
      code: 'PGRST204',
      message: "Could not find the 'external_source' column of 'jobs' in the schema cache"
    }), 'external_source');
    assert.equal(
      extractUnknownJobColumn({
        message: 'null value in column "title" of relation "jobs" violates not-null constraint'
      }),
      null
    );
    assert.equal(
      inferFailureCodeFromSafeMessage('Calendar job fields do not match the current database schema.'),
      'schema_mismatch'
    );
  });

  it('returns a useful schema mismatch reason without database internals', () => {
    const message = safeGroupedFailureMessage(Array.from({ length: 11 }, () => 'schema_mismatch' as const));
    assert.equal(
      message,
      '11 calendar events could not be saved because the job fields do not match the current database schema.'
    );
    assert.doesNotMatch(String(message), /PGRST204|PostgREST|external_source|feed_url|https?:\/\//i);
  });

  it('returns a short grouped reason without feed URLs or database internals', () => {
    const message = safeGroupedFailureMessage(['invalid_event_time']);
    assert.equal(message, '1 calendar event could not be imported because its start time could not be read.');
    assert.doesNotMatch(String(message), /UID|VEVENT|schema|PostgREST|feed_url|https?:\/\//i);
  });

  it('redacts private calendar URLs from error text', () => {
    const secret = 'https://calendar.example.com/private/team.ics?token=secret-value';
    const sanitized = sanitizeCalendarErrorText(`fetch failed for ${secret}`);
    assert.doesNotMatch(sanitized, /calendar\.example\.com/);
    assert.doesNotMatch(sanitized, /token=/);
    assert.doesNotMatch(sanitized, /team\.ics/);
    assert.match(sanitized, /\[redacted\]/);
  });

  it('never puts the feed URL on a safe result payload', () => {
    const result = toSafeCalendarImportResult(
      {
        label: 'Calendar Import',
        last_sync_at: '2026-08-13T12:00:00Z',
        last_sync_error: '1 calendar event could not be saved as a job.',
        feed_url: 'https://calendar.example.com/private/feed.ics'
      } as never,
      { created: 8, updated: 1, skipped: 2, failed: 1 },
      '1 calendar event could not be saved as a job.'
    );
    const serialized = JSON.stringify(result);
    assert.equal(result.created, 8);
    assert.equal(result.failed, 1);
    assert.equal(result.error, '1 calendar event could not be saved as a job.');
    assert.doesNotMatch(serialized, /feed_url|feedUrl|calendar\.example\.com/);
  });

  it('masks UIDs instead of logging them', () => {
    const masked = maskCalendarUid('example-123@calendar.example.com');
    assert.match(masked, /^uid_[0-9a-f]+$/);
    assert.doesNotMatch(masked, /example-123/);
    assert.doesNotMatch(masked, /calendar\.example\.com/);
  });
});
