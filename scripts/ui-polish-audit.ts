import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const layoutPath = join(ROOT, 'app', 'layout.tsx');
const failures: string[] = [];

if (!existsSync(layoutPath)) failures.push('Missing app/layout.tsx');

const layout = existsSync(layoutPath) ? readFileSync(layoutPath, 'utf8') : '';
const cssImports = [...layout.matchAll(/import '\.\/(.+\.css)';/g)].map((match) => match[1]);

/** Approved cascade after the 2026-09-03 mechanical consolidation. */
const approvedLayoutCss = [
  'globals.css',
  'design/tokens.css',
  'design/primitives.css',
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
  'legacy-signed-in.css',
  'global-content-rhythm.css',
];

if (cssImports.join('|') !== approvedLayoutCss.join('|')) {
  failures.push('app/layout.tsx global CSS imports must match the approved cascade and order.');
  const max = Math.max(cssImports.length, approvedLayoutCss.length);
  for (let index = 0; index < max; index += 1) {
    if (cssImports[index] !== approvedLayoutCss[index]) {
      failures.push(`  position ${index + 1}: expected ${approvedLayoutCss[index] ?? '(none)'}, found ${cssImports[index] ?? '(none)'}`);
    }
  }
}

if (layout.includes("import './release-polish.css'")) {
  failures.push('Do not reintroduce release-polish.css as a global last layer. Harvest into tokens/primitives instead.');
}

if (failures.length) {
  console.error('UI cascade audit failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`UI cascade audit passed: ${cssImports.length} stylesheets match the approved consolidated order.`);
