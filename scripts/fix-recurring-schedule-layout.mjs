#!/usr/bin/env node
/**
 * Validates the job creator recurring schedule layout.
 * Does not rewrite source files. Safe to run repeatedly.
 */
import fs from 'node:fs';

const path = 'components/job-creator.tsx';
const source = fs.readFileSync(path, 'utf8');

const checks = [
  [/Schedule type/, 'Schedule type label'],
  [/One-time/, 'One-time schedule option'],
  [/Weekday/, 'Weekday control'],
  [/Start date/, 'Start date control'],
  [/Start time/, 'Start time control'],
  [/End time/, 'End time control'],
  [/Job timezone/, 'Job timezone control'],
  [/Advanced recurrence options/, 'Advanced recurrence options'],
  [/Use company default/, 'Company default timezone option'],
  [/preferredStartTime: firstVisit\?\.start_time \|\| null/, 'No fake 9:00 AM preferred start time'],
  [/isRecurring/, 'Recurring branch'],
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

const scheduleIdx = source.indexOf('Schedule type');
const weekdayIdx = source.indexOf('Weekday', scheduleIdx);
const startDateIdx = source.indexOf('Start date', weekdayIdx);
const startTimeIdx = source.indexOf('Start time', startDateIdx);
const endTimeIdx = source.indexOf('End time', startTimeIdx);
const timezoneIdx = source.indexOf('Job timezone', endTimeIdx);
const advancedIdx = source.indexOf('Advanced recurrence options', timezoneIdx);

if (![scheduleIdx, weekdayIdx, startDateIdx, startTimeIdx, endTimeIdx, timezoneIdx, advancedIdx].every((i) => i >= 0)) {
  console.error('Could not verify recurring control order');
  failed = true;
} else if (!(scheduleIdx < weekdayIdx && weekdayIdx < startDateIdx && startDateIdx < startTimeIdx && startTimeIdx < endTimeIdx && endTimeIdx < timezoneIdx && timezoneIdx < advancedIdx)) {
  console.error('Recurring schedule controls are out of the required order');
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log('Recurring schedule layout looks correct.');
