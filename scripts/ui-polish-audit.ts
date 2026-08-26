import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const layoutPath = join(ROOT, 'app', 'layout.tsx');
const releaseCssPath = join(ROOT, 'app', 'release-polish.css');

const failures: string[] = [];

if (!existsSync(layoutPath)) failures.push('Missing app/layout.tsx');
if (!existsSync(releaseCssPath)) failures.push('Missing app/release-polish.css');

const layout = existsSync(layoutPath) ? readFileSync(layoutPath, 'utf8') : '';
const releaseCss = existsSync(releaseCssPath) ? readFileSync(releaseCssPath, 'utf8') : '';

const releaseImport = "import './release-polish.css';";
const releaseImportIndex = layout.indexOf(releaseImport);
if (releaseImportIndex < 0) {
  failures.push('Shared release stylesheet is not imported by app/layout.tsx');
}

const cssImports = [...layout.matchAll(/import '\.\/(.+\.css)';/g)].map((match) => match[1]);
if (cssImports.length && cssImports.at(-1) !== 'release-polish.css') {
  failures.push('release-polish.css must remain the last app stylesheet import');
}

const requiredSafeguards: Array<[string, string]> = [
  ['shared page width', '--eo-page-max'],
  ['readable primary text', '--eo-text'],
  ['readable muted text', '--eo-muted'],
  ['shared page content spacing', '.dashboard-shell .app-page-content'],
  ['consistent page headers', '.dashboard-shell .page-header'],
  ['consistent cards', '.dashboard-shell .card'],
  ['consistent inputs', ".dashboard-shell input:not([type='checkbox']):not([type='radio'])"],
  ['consistent selects', '.dashboard-shell select'],
  ['consistent buttons', '.dashboard-shell .btn'],
  ['consistent tables', '.dashboard-shell table'],
  ['consistent selected navigation', "nav a[aria-current='page']"],
  ['consistent sidebar', '.dashboard-shell .sidebar'],
  ['consistent footer', '.dashboard-shell .app-footer'],
  ['consistent filters', '.dashboard-shell .filters'],
  ['consistent record cards', '.dashboard-shell .record-card'],
  ['consistent empty states', '.dashboard-shell .empty-state'],
  ['responsive dialogs', "[role='dialog']"],
  ['tablet breakpoint', '@media (max-width: 900px)'],
  ['mobile breakpoint', '@media (max-width: 620px)'],
  ['safe area support', 'env(safe-area-inset-bottom)']
];

for (const [label, token] of requiredSafeguards) {
  if (!releaseCss.includes(token)) failures.push(`Missing ${label} safeguard (${token})`);
}

if (/--eo-muted:\s*(?:#(?:[89a-f]{6})|rgba?\([^)]*,\s*0\.[0-4]\))/i.test(releaseCss)) {
  failures.push('Shared muted text token is too faint for normal app copy');
}

if (/\.dashboard-shell\s+\.muted[^{}]*\{[^{}]*opacity:\s*(?:0|0\.[0-6])\s*!?important?\s*;?/i.test(releaseCss)) {
  failures.push('Shared muted text must not look disabled');
}

if (!releaseCss.includes("color: #ffffff !important") || !releaseCss.includes('.btn-primary')) {
  failures.push('Primary buttons need an explicit readable foreground color');
}

if (!releaseCss.includes('min-height: 44px !important')) {
  failures.push('Mobile controls need a 44px minimum tap target');
}

if (failures.length) {
  console.error('UI consistency audit failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`UI consistency audit passed: ${cssImports.length} app stylesheets checked; release-polish.css is the final shared layer.`);
