import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { summarizeRecurrence } from '../lib/recurring-jobs';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('native library picker uses Camera.pickImages for multiple photos', () => {
  const source = read('lib/platform/upload.ts');
  assert.match(source, /Camera\.pickImages/);
  assert.match(source, /pickJobPhotoFromCamera/);
  assert.match(source, /pickJobPhotoFromLibrary/);
  assert.match(source, /cancelled/);
});

test('job photo section separates camera capture from multi library selection', () => {
  const source = read('components/job-photos-section.tsx');
  assert.match(source, /libraryInputRef/);
  assert.match(source, /cameraInputRef/);
  assert.match(source, /capture="environment"/);
  assert.match(source, /Choose before photos/);
  assert.match(source, /Take after photo/);
  assert.match(source, /Add progress photos/);
  assert.match(source, /Before photos/);
  assert.match(source, /photo-lightbox/);
  const libraryBlock = source.match(/ref=\{libraryInputRef\}[\s\S]{0,220}onChange=/);
  assert.ok(libraryBlock, 'library input block missing');
  assert.match(libraryBlock[0], /multiple/);
  assert.doesNotMatch(libraryBlock[0], /capture=/);
});

test('recurring schedule UI has one schedule block and no fake 9:00 AM default', () => {
  const source = read('components/job-creator.tsx');
  assert.match(source, /recurrenceCopy\.scheduleType/);
  assert.match(source, /recurrenceCopy\.oneTime/);
  assert.match(source, /isRecurring/);
  assert.match(source, /const primaryVisit = visits\[0\];/);
  assert.match(source, /preferredStartTime: primaryVisit\?\.start_time \|\| null/);
  assert.match(source, /companyDefaultTimezone/);
  assert.match(source, /recurrenceEndMode/);
  assert.doesNotMatch(source, /\|\| '09:00'/);
  const moreOptionsIdx = source.indexOf('<summary>More options</summary>');
  const scheduleIdx = source.indexOf('recurrenceCopy.scheduleType', moreOptionsIdx);
  const timezoneIdx = source.indexOf('recurrenceCopy.jobTimezone', scheduleIdx);
  const endsIdx = source.indexOf('recurrenceCopy.ends', timezoneIdx);
  assert.ok(moreOptionsIdx >= 0 && scheduleIdx > moreOptionsIdx && timezoneIdx > scheduleIdx && endsIdx > timezoneIdx);
});

test('recurrence summary omits time until chosen and can include timezone abbrev', () => {
  const withoutTime = summarizeRecurrence({
    frequency: 'biweekly',
    weekday: 4,
    startDate: '2026-07-31',
    preferredStartTime: null,
    timezone: 'America/Chicago'
  });
  assert.match(withoutTime, /Every two weeks on Thursday starting July 31, 2026/);
  assert.doesNotMatch(withoutTime, /9:00 AM/);

  const withTime = summarizeRecurrence({
    frequency: 'biweekly',
    weekday: 4,
    startDate: '2026-07-31',
    preferredStartTime: '09:00',
    timezone: 'America/Chicago'
  });
  assert.match(withTime, /at 9:00 AM/);
  assert.match(withTime, /CDT|CST/);
});

test('user-facing company wording replaces workspace in key catalogs', () => {
  const en = read('lib/i18n/messages/en.ts');
  assert.match(en, /Company settings/);
  assert.match(en, /Customer dashboard/);
  assert.doesNotMatch(en, /Contractor dashboard/);
  assert.match(en, /settingsNav:[\s\S]*workspace: 'Company'/);
});
