/**
 * Scans user-facing React/TSX for likely hardcoded English UI strings.
 *
 * Strict mode (fails CI): labels in JSX attributes / confirm dialogs / visible text
 * for known shared app, dashboard, auth, settings, portal, billing, export, and jobs
 * phrases, excluding locale catalogs and typed copy helpers.
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
  'lib/outbound/types.ts'
];

/**
 * High-confidence user-visible phrases that must not appear as hardcoded UI
 * outside typed copy helpers / locale maps.
 */
const STRICT_PHRASES = [
  // Shared app chrome and dashboard
  'Welcome back',
  'Financial Details',
  'New Job',
  'New Customer',
  'Customer balance due',
  'Cash after paid costs',
  'All-Time Jobs',
  'Ask Everitt about your business',
  'Create instructions',
  'Open instructions',
  'Job instructions',
  'Loading…',
  'Retry',
  'Save changes',
  'Cancel',
  'Delete',
  'Edit',
  'Search',
  'No results',
  'Something went wrong',
  'Back',
  'Continue',
  'Close',
  'Done',
  'View details',
  'Learn more',

  // Authentication and account
  'Sign in',
  'Sign out',
  'Create account',
  'Forgot password',
  'Reset password',
  'Email address',
  'Password',
  'Show password',
  'Hide password',
  'Check your email',
  'Verify your email',
  'Account details',
  'Plans & billing',
  'Delete account',
  'Delete company',
  'Danger Zone',

  // Navigation, settings, and portals
  'Dashboard',
  'Jobs',
  'Customers',
  'Leads',
  'Team',
  'Schedule',
  'Settings',
  'Notifications',
  'Language',
  'Business details',
  'Branding',
  'Customer messages & invoices',
  'Legal & advanced',
  'My jobs',
  'Active jobs',
  'Completed jobs',
  'Job history',
  'No active jobs',
  'No completed jobs',
  'No jobs yet',
  'Assigned to you',
  'Customer portal',
  'Contractor portal',

  // Settings / account chrome
  'Unable to save settings.',
  'Unable to restart onboarding.',
  'Business name',
  'Restart setup',
  'Setup checklist',
  'Save branding',
  'Update password',
  'Change password',
  'Sign out everywhere',
  'Save account',
  'Notification preferences',
  'Restore Purchases',
  'Refresh Subscription Status',
  'Choose your plan',
  'Manage billing',
  'Cancel plan',
  'Current plan',
  'Plan access',
  'Action needed',
  'Loading billing',
  'Activating your plan',
  'Subscribe with Apple',
  'Subscribe with Google Play',
  'Sync subscription',
  'Syncing...',
  'Add passkey',
  'Stay signed in',
  'Permission denied',
  'Create company',
  'Open billing',

  // Billing, payments, exports, and jobs
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
  'Payment receipt',
  'Mark complete',
  'Mark cancelled',
  'Archive',
  'Restore',
  'Export',
  'Download',
  'Upload photos',
  'Add photos',
  'No photos yet'
];

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

/** Mark lines that sit inside en/es/vi locale map object literals. */
function markLocaleCatalogLines(lines: string[]): boolean[] {
  const marked = new Array(lines.length).fill(false);
  let depth = 0;
  let inLocaleBlock = false;
  let localeBlockBaseDepth = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    // Inline per-locale values: en: 'Delete account'
    if (/\b(en|es|vi)\s*:\s*['"`]/.test(line)) {
      marked[index] = true;
    }

    const localeStart = line.match(/\b(en|es|vi)\s*:\s*\{/);
    if (localeStart && !inLocaleBlock) {
      inLocaleBlock = true;
      localeBlockBaseDepth = depth;
    }

    for (const char of line) {
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
    }

    if (inLocaleBlock) {
      marked[index] = true;
      if (depth <= localeBlockBaseDepth) inLocaleBlock = false;
    }
  }

  return marked;
}

function looksLikeLocaleMapEnglish(line: string, previous: string): boolean {
  if (/^\s*\w+:\s*['"`]/.test(line) && (/^\s*en:\s*\{/.test(previous) || previous.includes('en: {'))) return true;
  if (/\ben:\s*\{/.test(line)) return true;
  if (
    /getBillingOpsCopy|getExportCopy|getSettingsWorkspaceCopy|getSettingsBillingUiCopy|getWorkspaceDeleteCopy|getNativeStoreSubscribeCopy|getSyncSubscriptionCopy|getNativeBillingCopy|getSubscriptionStatusCopy|getAiUpgradeCopy|getPasskeyManagerCopy|getPasskeySetupCopy|getSessionIdleCopy|getAccessBlockedCopy|getPermissionDeniedCopy|getContractorLayoutCopy|getCreateCompanyCopy|BillingOpsCopy|ExportCopy|getFeedbackLabels|LABELS\[|dashboardCopy\[|loginCopy\[|copy\[locale\]|copy\[locale\s*\|\||c\.\w+|billingCopy\.|exportCopy\./.test(
      line
    )
  ) {
    return true;
  }
  if (/\|\|\s*['"`]/.test(line) && /(error|message|json\.error|throw new Error)/i.test(line)) return true;
  return false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const files = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir)));
const findings: Array<{ file: string; line: number; phrase: string; text: string }> = [];

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
  const localeCatalogLines = markLocaleCatalogLines(lines);
  lines.forEach((line, index) => {
    if (/^\s*import\s/.test(line)) return;
    if (localeCatalogLines[index]) return;
    const previous = lines[Math.max(0, index - 1)] || '';
    for (const phrase of STRICT_PHRASES) {
      if (!line.includes(phrase)) continue;
      if (looksLikeLocaleMapEnglish(line, previous)) continue;

      const escaped = escapeRegExp(phrase);
      const uiContext = new RegExp(
        `(placeholder|aria-label|title|confirm\\(|>|label:\\s*|children:\\s*|:\\s*)['"\`][^'"\`]*${escaped}`
      );
      const bareString = new RegExp(`['"\`]${escaped}['"\`]`);
      if (!uiContext.test(line) && !bareString.test(line)) continue;
      if (/billingCopy\.|exportCopy\.|copy\.|c\.|t\(|FEEDBACK\./.test(line)) continue;

      findings.push({ file: rel, line: index + 1, phrase, text: line.trim().slice(0, 180) });
    }
  });
}

if (findings.length) {
  console.error(`i18n UI audit failed: ${findings.length} hardcoded UI string(s):\n`);
  for (const item of findings.slice(0, 80)) {
    console.error(`  ${item.file}:${item.line} [${item.phrase}]`);
    console.error(`    ${item.text}`);
  }
  if (findings.length > 80) console.error(`  …and ${findings.length - 80} more`);
  process.exit(1);
}

console.log(`i18n UI audit passed: scanned ${files.length} TSX files, no forbidden UI phrases.`);
process.exit(0);
