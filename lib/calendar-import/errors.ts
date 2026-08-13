export type CalendarImportFailureCode =
  | 'invalid_event_time'
  | 'missing_event_uid'
  | 'job_insert_failed'
  | 'job_update_failed'
  | 'duplicate_conflict'
  | 'unsupported_all_day'
  | 'invalid_timezone';

const FAILURE_MESSAGES: Record<CalendarImportFailureCode, { one: string; many: string }> = {
  invalid_event_time: {
    one: '1 calendar event could not be imported because its start time could not be read.',
    many: '{count} calendar events could not be imported because their start time could not be read.'
  },
  missing_event_uid: {
    one: '1 calendar event could not be imported because it was missing a stable identity.',
    many: '{count} calendar events could not be imported because they were missing a stable identity.'
  },
  job_insert_failed: {
    one: '1 calendar event could not be saved as a job.',
    many: '{count} calendar events could not be saved as jobs.'
  },
  job_update_failed: {
    one: '1 existing job could not be updated from the calendar.',
    many: '{count} existing jobs could not be updated from the calendar.'
  },
  duplicate_conflict: {
    one: '1 calendar event matched an existing job and was left unchanged.',
    many: '{count} calendar events matched existing jobs and were left unchanged.'
  },
  unsupported_all_day: {
    one: '1 all-day calendar event could not be imported.',
    many: '{count} all-day calendar events could not be imported.'
  },
  invalid_timezone: {
    one: '1 calendar event could not be imported because its timezone was invalid.',
    many: '{count} calendar events could not be imported because their timezone was invalid.'
  }
};

export function maskCalendarUid(uid: string): string {
  const value = uid.trim();
  if (!value) return 'uid_none';
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return `uid_${Math.abs(hash).toString(16)}`;
}

export function sanitizeCalendarErrorText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/https?:\/\/[^\s]+/gi, '[redacted]')
    .replace(/webcal:\/\/[^\s]+/gi, '[redacted]')
    .replace(/feed_url|feedUrl/gi, 'feed')
    .slice(0, 180);
}

export function classifyJobWriteError(message: string, code?: string | null): CalendarImportFailureCode {
  const lower = `${code || ''} ${message || ''}`.toLowerCase();
  if (lower.includes('23505') || lower.includes('duplicate') || lower.includes('unique')) return 'duplicate_conflict';
  if (lower.includes('timezone') || lower.includes('jobs_timezone')) return 'invalid_timezone';
  if (
    lower.includes('scheduled_start') ||
    lower.includes('scheduled_end') ||
    lower.includes('start_date') ||
    lower.includes('timestamp') ||
    lower.includes('date/time') ||
    lower.includes('invalid input syntax for type date')
  ) {
    return 'invalid_event_time';
  }
  return 'job_insert_failed';
}

export function safeGroupedFailureMessage(codes: CalendarImportFailureCode[]): string | null {
  if (codes.length === 0) return null;
  const counts = new Map<CalendarImportFailureCode, number>();
  for (const code of codes) {
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  const [code, count] = ranked[0];
  const template = count === 1 ? FAILURE_MESSAGES[code].one : FAILURE_MESSAGES[code].many;
  return template.replace('{count}', String(count));
}

export function logCalendarImportIssue(meta: {
  organizationId: string;
  code: string;
  summary?: string | null;
  uidHash?: string;
  dbCode?: string | null;
  dbMessage?: string | null;
}): void {
  console.warn(
    '[calendar-import]',
    JSON.stringify({
      organizationId: meta.organizationId,
      code: meta.code,
      uidHash: meta.uidHash || null,
      summary: meta.summary ? String(meta.summary).slice(0, 80) : null,
      dbCode: meta.dbCode || null,
      dbMessage: sanitizeCalendarErrorText(meta.dbMessage)
    })
  );
}
