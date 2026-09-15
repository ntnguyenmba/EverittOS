import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const failures: string[] = [];

function read(path: string): string {
  const absolute = join(ROOT, path);
  if (!existsSync(absolute)) {
    failures.push(`Missing ${path}`);
    return '';
  }
  return readFileSync(absolute, 'utf8');
}

function requireText(source: string, path: string, values: string[]) {
  for (const value of values) {
    if (!source.includes(value)) failures.push(`${path} must include: ${value}`);
  }
}

const layout = read('app/layout.tsx');
const tokens = read('app/design/tokens.css');
const primitives = read('app/design/primitives.css');
const legacy = read('app/legacy-signed-in.css');
const rhythm = read('app/global-content-rhythm.css');
const shell = read('components/app-shell.tsx');
const clientLayout = read('app/portal/client/layout.tsx');
const workerLayout = read('app/portal/contractor/layout.tsx');
const ownerPage = read('app/jobs/new/page.tsx');
const pageHeader = read('components/page-header.tsx');

const cssImports = [...layout.matchAll(/import '\.\/(.+\.css)';/g)].map((match) => match[1]);
const canonicalOrder = ['globals.css', 'design/tokens.css', 'design/primitives.css'];
if (cssImports.slice(0, canonicalOrder.length).join('|') !== canonicalOrder.join('|')) {
  failures.push('Global styles must begin with globals.css, design/tokens.css, then design/primitives.css.');
}
if (cssImports.at(-1) !== 'global-content-rhythm.css') {
  failures.push('global-content-rhythm.css must remain the final stylesheet so shared visual rules win the cascade.');
}
if (cssImports.length > 19) {
  failures.push(`Global stylesheet count grew from the approved 19 to ${cssImports.length}.`);
}

requireText(tokens, 'app/design/tokens.css', [
  '--eo-color-brand: #234a84;',
  '--eo-color-accent: #4f7cc4;',
  '--eo-color-primary-hover: #1e3f72;',
  '--eo-color-page: #f8fafc;',
  '--eo-color-surface: #ffffff;',
  '--eo-color-surface-subtle: #eaf2ff;',
  '--eo-color-text: #172033;',
  '--eo-color-text-secondary: #5b667a;',
  '--eo-color-muted: #7c8798;',
  '--eo-color-border: #dde6f2;',
  '--eo-color-divider: #e7eef7;',
  '--eo-color-success:',
  '--eo-color-warning:',
  '--eo-color-danger:',
  '--eo-space-1: 4px;',
  '--eo-space-6: 32px;',
  '--eo-radius-control: 12px;',
  '--eo-radius-card: 12px;',
  '--eo-tap: 44px;',
  '--eo-control: 48px;',
]);

requireText(primitives, 'app/design/primitives.css', [
  '.eo-card',
  '.eo-btn',
  '.eo-field',
  '.eo-status',
  'var(--eo-radius-card)',
  'var(--eo-radius-control)',
  'var(--eo-color-accent)',
]);

requireText(legacy, 'app/legacy-signed-in.css', [
  'BEGIN signed-in-canvas.css',
  'BEGIN unified-record-cards.css',
  'BEGIN signed-in-rhythm-final.css',
]);

requireText(rhythm, 'app/global-content-rhythm.css', [
  '.dashboard-shell',
  '.role-portal-shell',
  '.settings-card',
  '.client-job-card',
  '.team-member-card',
  '.job-detail-shell',
  'var(--eo-content-section-gap)',
  'var(--eo-radius-card)',
  'var(--eo-color-surface)',
]);

requireText(pageHeader, 'components/page-header.tsx', [
  'subtitle: string;',
  '<p className="page-subtitle">{subtitle}</p>',
]);

requireText(clientLayout, 'app/portal/client/layout.tsx', ['<AppShell role="client"']);
requireText(workerLayout, 'app/portal/contractor/layout.tsx', ['<AppShell role="contractor"']);
requireText(ownerPage, 'app/jobs/new/page.tsx', ['<AppShell plan="free" role="owner"']);

requireText(shell, 'components/app-shell.tsx', [
  "type RoleBannerKind = 'owner' | 'client' | 'worker';",
  "en: { context: 'Signed in as'",
  "es: { context: 'Sesión iniciada como'",
  "vi: { context: 'Đang đăng nhập với vai trò'",
  "if (role === 'client') return 'client';",
  "if (role === 'contractor' || role === 'employee' || role === 'viewer') return 'worker';",
  'app-role-banner',
  'var(--eo-color-brand)',
  'var(--eo-radius-card)',
  '@media(max-width:640px)',
  '@media(max-width:760px)',
  '@media(max-width:480px)',
]);

const legacySections = [...legacy.matchAll(/\/\* BEGIN ([^*]+\.css) \*\//g)].map((match) => match[1]);
if (legacySections.length !== 20) {
  failures.push(`app/legacy-signed-in.css must retain all 20 source sections; found ${legacySections.length}.`);
}
if (new Set(legacySections).size !== legacySections.length) {
  failures.push('app/legacy-signed-in.css contains duplicate source sections.');
}
if (!legacy.includes('@media (max-width: 680px)') && !legacy.includes('@media(max-width:680px)')) {
  failures.push('app/legacy-signed-in.css must retain the compact record-card breakpoint.');
}
if (!rhythm.includes('@media (max-width: 640px)')) {
  failures.push('app/global-content-rhythm.css must retain its mobile control breakpoint.');
}

for (const [path, source] of [
  ['app/design/tokens.css', tokens],
  ['app/design/primitives.css', primitives],
  ['app/global-content-rhythm.css', rhythm],
  ['components/app-shell.tsx', shell],
] as const) {
  if (/#[fF]4[fF]1[eE][aA]/.test(source)) failures.push(`${path} reintroduces the retired beige canvas color.`);
}

if (failures.length) {
  console.error('Visual contract audit failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Visual contract passed: shared palette, spacing, surfaces, controls, responsive sizing, and role banners are intact.');
