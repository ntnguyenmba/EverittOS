#!/usr/bin/env node
/**
 * Validates the job creator recurring schedule layout.
 * Does not rewrite source files. Safe to run repeatedly.
 */
import fs from 'node:fs';

const path = 'components/job-creator.tsx';
const source = fs.readFileSync(path, 'utf8');

const checks = [
  [/scheduleType|Repeats/, 'Repeats / schedule type label'],
  [/Starts on|startsOn/, 'Starts on control'],
  [/Start time|startTime/, 'Start time control'],
  [/End time|endTime/, 'End time control'],
  [/Job timezone|jobTimezone/, 'Job timezone control'],
  [/neverEnds|Never/, 'Never ends option'],
  [/companyDefaultTimezone|Use company default/, 'Company default timezone option'],
  [/preferredStartTime: firstVisit\?\.start_time \|\| null/, 'No fake 9:00 AM preferred start time'],
  [/isRecurring/, 'Recurring branch'],
  [/recurrenceEndMode/, 'End mode control'],
];

let failed = false;
for (const [pattern, label] of checks) {
  if (!pattern.test(source)) {
    console.error(`Missing: ${label}`);
    failed = true;
  }
}

if (/\|\| '09:00'/.test(source)) {
  console.error('Found fake 09:00 default');
  failed = true;
}

const scheduleIdx = source.indexOf('recurrenceCopy.scheduleType');
const startDateIdx = source.indexOf('id="recurrence-starts-on"', scheduleIdx);
const startTimeIdx = source.indexOf('id="recurring-start-time"', startDateIdx);
const endTimeIdx = source.indexOf('id="recurring-end-time"', startTimeIdx);
const timezoneIdx = source.indexOf('recurrenceCopy.jobTimezone', endTimeIdx);
const endsIdx = source.indexOf('recurrenceCopy.ends', timezoneIdx);

if (!/recurrenceStartDate/.test(source) || !/setSeriesStartDate/.test(source)) {
  console.error('Missing dedicated recurrence start date state');
  failed = true;
}

if (![scheduleIdx, startDateIdx, startTimeIdx, endTimeIdx, timezoneIdx, endsIdx].every((i) => i >= 0)) {
  console.error('Could not verify recurring control order');
  failed = true;
} else if (!(scheduleIdx < startDateIdx && startDateIdx < startTimeIdx && startTimeIdx < endTimeIdx && endTimeIdx < timezoneIdx && timezoneIdx < endsIdx)) {
  console.error('Recurring schedule controls are out of the required order');
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log('Recurring schedule layout looks correct.');
