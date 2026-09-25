import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const APP = join(ROOT, 'app');
const DESIGN = join(APP, 'design');

/** Root stylesheets still loaded after the 2026-09-25 dead-overlay removal.
    The list only shrinks: harvest a file into tokens/primitives, then delete it here. */
const frozenRootCss = new Set([
  'bookkeeping.css',
  'contractor-portal.css',
  'dashboard.css',
  'everitt-theme.css',
  'feedback-toast.css',
  'form-alignment-fixes.css',
  'global-content-rhythm.css',
  'globals.css',
  'job-visit-layout-override.css',
  'legacy-signed-in.css',
  'mobile-safe-areas.css',
  'nav.css',
  'outbound.css',
  'payment-receipt-modal-fix.css',
  'quote-workspace.css',
  'receipt.css',
  'role-home-structure.css',
  'typography.css',
]);

const allowedDesignCss = new Set(['tokens.css', 'primitives.css']);

const bannedName = /(final|polish|hotfix|guard|refresh|last|overlay-fix|repair|alignment-final)/i;

function listCss(dir: string): string[] {
  try {
    return readdirSync(dir).filter((name) => name.endsWith('.css') && statSync(join(dir, name)).isFile());
  } catch {
    return [];
  }
}

const failures: string[] = [];

const rootCss = listCss(APP);
const unexpectedRoot = rootCss.filter((name) => !frozenRootCss.has(name));
if (unexpectedRoot.length) {
  failures.push('New root-level CSS is blocked. Put shared rules in app/design/tokens.css or app/design/primitives.css.');
  for (const file of unexpectedRoot) failures.push(`  unexpected: ${relative(ROOT, join(APP, file))}`);
}

const missingRoot = [...frozenRootCss].filter((name) => !rootCss.includes(name));
if (missingRoot.length) {
  failures.push('Remove deleted stylesheets from the frozen list so it keeps shrinking.');
  for (const file of missingRoot) failures.push(`  stale entry: app/${file}`);
}

const designCss = listCss(DESIGN);
const unexpectedDesign = designCss.filter((name) => !allowedDesignCss.has(name));
if (unexpectedDesign.length) {
  failures.push('Only tokens.css and primitives.css are allowed under app/design/.');
  for (const file of unexpectedDesign) failures.push(`  unexpected: ${relative(ROOT, join(DESIGN, file))}`);
}

for (const file of unexpectedRoot.concat(unexpectedDesign)) {
  if (bannedName.test(file)) {
    failures.push(`Banned overlay name: ${file}`);
  }
}

if (failures.length) {
  console.error('\nStyle freeze failed. See STABILIZATION.md.');
  for (const line of failures) console.error(line);
  process.exit(1);
}

console.log(
  `Style freeze passed. ${frozenRootCss.size} root CSS files are frozen; new shared work belongs in app/design/tokens.css or primitives.css.`,
);
