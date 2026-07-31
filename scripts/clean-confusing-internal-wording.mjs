#!/usr/bin/env node
/**
 * Safe, idempotent wording cleanup for known user-facing message catalogs only.
 *
 * This script intentionally does NOT rewrite app/components source files.
 * Prefer reviewed, direct edits for UI copy. Running this repeatedly is safe.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const TARGETS = [
  'lib/i18n/messages/en.ts',
  'lib/i18n/messages/es.ts',
  'lib/i18n/messages/vi.ts',
  'lib/i18n/portal-messages.ts',
  'lib/i18n/job-detail-copy.ts',
  'lib/i18n/job-finance-copy.ts',
];

/** Phrase replacements applied only inside string literals / template content in catalogs. */
const REPLACEMENTS = [
  [/Internal notes/g, 'Team notes'],
  [/Notas internas/g, 'Notas del equipo'],
  [/Ghi chú nội bộ/g, 'Ghi chú nhóm'],
  [/Internal only/g, 'Team only'],
  [/For internal use only/g, 'For your team'],
  [/Customer portal/g, 'Customer dashboard'],
  [/Contractor portal/g, 'Contractor dashboard'],
  [/customer portal/g, 'customer dashboard'],
  [/contractor portal/g, 'contractor dashboard'],
  [/Assigned worker/g, 'Assigned contractor'],
  [/assigned worker/g, 'assigned contractor'],
];

function processFile(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`skip (missing): ${relPath}`);
    return false;
  }

  const original = fs.readFileSync(fullPath, 'utf8');
  let next = original;
  for (const [pattern, replacement] of REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }

  if (next === original) {
    console.log(`unchanged: ${relPath}`);
    return false;
  }

  fs.writeFileSync(fullPath, next);
  console.log(`updated: ${relPath}`);
  return true;
}

let changed = 0;
for (const target of TARGETS) {
  if (processFile(target)) changed += 1;
}

console.log(`Done. Updated ${changed} file(s).`);
)
