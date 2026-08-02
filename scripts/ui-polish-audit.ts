import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const layoutPath = join(ROOT, 'app', 'layout.tsx');
const releaseCssPath = join(ROOT, 'app', 'final-release-polish.css');

const failures: string[] = [];

if (!existsSync(layoutPath)) failures.push('Missing app/layout.tsx');
if (!existsSync(releaseCssPath)) failures.push('Missing app/final-release-polish.css');

const layout = existsSync(layoutPath) ? readFileSync(layoutPath, 'utf8') : '';
const releaseCss = existsSync(releaseCssPath) ? readFileSync(releaseCssPath, 'utf8') : '';

const releaseImport = "import './final-release-polish.css';";
const releaseImportIndex = layout.indexOf(releaseImport);
if (releaseImportIndex < 0) {
  failures.push('Final release polish stylesheet is not imported by app/layout.tsx');
}

const cssImports = [...layout.matchAll(/import '\.\/(.+\.css)';/g)].map((match) => match[1]);
if (cssImports.length && cssImports.at(-1) !== 'final-release-polish.css') {
  failures.push('final-release-polish.css must remain the last app stylesheet import');
}

const requiredSafeguards: Array<[string, string]> = [
  ['translated text wrapping', 'overflow-wrap: anywhere'],
  ['readable helper text', ".muted:not([aria-disabled='true'])"],
  ['mobile action stacking', '.page-actions > *'],
  ['mobile tab stacking', '.segmented-control > *'],
  ['responsive dialogs', "[role='dialog']"],
  ['responsive tables', '.data-table-wrap'],
  ['language control sizing', '.language-switcher-select']
];

for (const [label, token] of requiredSafeguards) {
  if (!releaseCss.includes(token)) failures.push(`Missing ${label} safeguard (${token})`);
}

if (/\.muted[^{}]*\{[^{}]*opacity:\s*(?:0|0\.[0-5])\s*;/s.test(releaseCss)) {
  failures.push('Final release stylesheet must not make normal muted text look disabled');
}

if (failures.length) {
  console.error('UI polish audit failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`UI polish audit passed: ${cssImports.length} app stylesheets checked.`);
