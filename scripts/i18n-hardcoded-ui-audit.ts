/**
 * Scans user-facing React/TSX for likely hardcoded English UI strings.
 *
 * Strict mode (fails CI): labels in JSX attributes / confirm dialogs / visible text
 * for known billing, export, and jobs phrases — excluding lib/i18n catalogs.
 *
 * Run: npm run i18n:ui-audit
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'components'];

const SKIP_PATH_PARTS = ['node_modules', '.next', 'tests/', '/tests/', 'scripts/', 'supabase/', 'docs/', '.github/'];

/** Catalog / copy modules may contain English source strings. */
const SKIP_FILES = [
  'lib/i18n/',
  'lib/feedback-labels.ts',
  'lib/outbound/types.ts' // default templates are locale-branched
];

/**
 * High-confidence user-visible phrases that must not appear as hardcoded UI
 * outside typed copy helpers.
 */
const STRICT_PHRASES = [
  'Record payment',
  'Save payment',
  'Payment amount',
  'Payment date',
  'Nothing sent yet',
  'No scheduled items',
  'No drafts',
  'No failed deliveries',
  'Hide from history',
  'Delete draft',
  'Cancel schedule',
  'Create invoice',
  'Send receipt',
  'Payment recorded',
  'Outstanding balances',
  'Who still owes you',
  'Overdue invoices',
  'Payment connections',
  'Loading customer and job details',
  'Enter a recipient email',
  'Remove this item?',
  'Statuses refresh automatically',
  'No invoices match this filter',
  'Record this payment once',
  'Still owed',
  'Auto-save on',
  'Start over',
  'New invoice',
  'Payment receipt'
];

/** Only flag when the phrase is used as UI chrome, not as API fallback. */
const UI_CONTEXT =
  /(placeholder|aria-label|title|alt|confirm\(|window\.confirm|>)[^;]*['"`][^'"`]*(PHRASE)|['"`](PHRASE)['"`]\s*[,})]|children:\s*['"`](PHRASE)/i;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full).replace(/\\/g, '/');
    if (SKIP_PATH_PARTS.some((part) => rel.includes(part))) continue;
    if (SKIP_FILES.some((part) => rel.includes(part))) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function looksLikeLocaleMapEnglish(line: string, previous: string): boolean {
  // Local copy maps: `unableLoad: 'Unable to load jobs.'` under en: { ... }
  if (/^\s*\w+:\s*'/.test(line) && (/^\s*en:\s*\{/.test(previous) || previous.includes("en: {"))) return true;
  if (/\ben:\s*\{/.test(line)) return true;
  if (/getBillingOpsCopy|getExportCopy|BillingOpsCopy|ExportCopy|getFeedbackLabels|LABELS\[/.test(line)) return true;
  // API fallback: json.error || '...'
  if (/\|\|\s*'/.test(line) && /(error|message|json\.error|throw new Error)/i.test(line)) return true;
  return false;
}

const files = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir)));
const findings: Array<{ file: string; line: number; phrase: string; text: string }> = [];

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
  lines.forEach((line, index) => {
    if (/^\s*import\s/.test(line)) return;
    const previous = lines[Math.max(0, index - 1)] || '';
    for (const phrase of STRICT_PHRASES) {
      if (!line.includes(phrase)) continue;
      if (looksLikeLocaleMapEnglish(line, previous)) continue;
      // Require UI-ish context OR assignment to label-like identifiers
      const uiContext = new RegExp(
        `(placeholder|aria-label|title|confirm\\(|>|label:\\s*|:\\s*)['"\`][^'"\`]*${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'i'
      );
      const bareString = new RegExp(`['"\`]${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);
      if (!uiContext.test(line) && !bareString.test(line)) continue;
      // Ignore imports of copy helpers returning these phrases
      if (/billingCopy\.|exportCopy\.|copy\.|c\./.test(line)) continue;
      findings.push({ file: rel, line: index + 1, phrase, text: line.trim().slice(0, 180) });
    }
  });
}

if (findings.length) {
  console.error(`i18n UI audit failed: ${findings.length} hardcoded UI string(s):\n`);
  for (const item of findings.slice(0, 60)) {
    console.error(`  ${item.file}:${item.line} [${item.phrase}]`);
    console.error(`    ${item.text}`);
  }
  if (findings.length > 60) console.error(`  …and ${findings.length - 60} more`);
  process.exit(1);
}

console.log(`i18n UI audit passed: scanned ${files.length} TSX files, no forbidden UI phrases.`);
process.exit(0);
