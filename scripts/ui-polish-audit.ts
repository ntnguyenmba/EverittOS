import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const layoutPath = join(ROOT, 'app', 'layout.tsx');

const failures: string[] = [];

if (!existsSync(layoutPath)) failures.push('Missing app/layout.tsx');

const layout = existsSync(layoutPath) ? readFileSync(layoutPath, 'utf8') : '';
const cssImports = [...layout.matchAll(/import '\.\/(.+\.css)';/g)].map((match) => match[1]);

/** Frozen cascade from app/layout.tsx at the 2026-08-30 visual freeze. */
const frozenLayoutCss = [
  'globals.css',
  'everitt-theme.css',
  'typography.css',
  'nav.css',
  'outbound.css',
  'feedback-toast.css',
  'dashboard.css',
  'form-alignment-fixes.css',
  'job-visit-layout-override.css',
  'payment-receipt-modal-fix.css',
  'receipt.css',
  'mobile-safe-areas.css',
  'contractor-portal.css',
  'quote-workspace.css',
  'role-home-structure.css',
  'signed-in-canvas.css',
  'jobs-filter-mobile-alignment.css',
  'jobs-mobile-layout-hotfix.css',
  'word-spacing-fix.css',
  'top-chrome-align.css',
  'ask-everitt-overlay-fix.css',
  'job-card-spacing.css',
  'one-nav.css',
  'box-stack-spacing.css',
  'signed-in-stability.css',
  'hero-last.css',
  'visual-unify.css',
  'readability-last.css',
  'everitt-login-look.css',
  'final-layout-guard.css',
  'view-center-final.css',
];

const allowedExtra = new Set(['design/tokens.css', 'design/primitives.css']);

if (cssImports[0] !== 'globals.css') {
  failures.push('app/layout.tsx must keep globals.css as the first stylesheet import');
}

const extras = cssImports.filter((name) => !frozenLayoutCss.includes(name) && !allowedExtra.has(name));
if (extras.length) {
  failures.push('New global CSS imports are blocked during the freeze. Allowed extras: app/design/tokens.css, app/design/primitives.css.');
  for (const file of extras) failures.push(`  extra import: ${file}`);
}

const missing = frozenLayoutCss.filter((name) => !cssImports.includes(name));
if (missing.length) {
  failures.push('Do not drop frozen layout stylesheets until they have been harvested into primitives.');
  for (const file of missing) failures.push(`  missing import: ${file}`);
}

if (layout.includes("import './release-polish.css'")) {
  failures.push('Do not reintroduce release-polish.css as a global last layer. Harvest into tokens/primitives instead.');
}

if (failures.length) {
  console.error('UI freeze audit failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`UI freeze audit passed: ${cssImports.length} layout stylesheets match the frozen cascade.`);
