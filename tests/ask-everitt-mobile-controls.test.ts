import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Ask Everitt uses touch detection and hides keyboard shortcuts on touch devices', () => {
  const source = read('components/ask-everitt-command.tsx');
  assert.match(source, /matchMedia\('\(hover: none\), \(pointer: coarse\)'\)/);
  assert.match(source, /setKbd\(''\)/);
  assert.match(source, /setKbd\(platform\.includes\('mac'\) \? '⌘K' : 'Ctrl\+K'\)/);
  assert.match(source, /\{kbd \? <span className="everitt-cmd-kbd">\{kbd\}<\/span> : null\}/);
  assert.match(source, /\{kbd \? <span className="everitt-cmd-kbd everitt-cmd-kbd-muted">\{kbd\}<\/span> : null\}/);
  assert.match(source, /everitt-cmd-close/);
  assert.match(source, /escapeHint/);
  assert.doesNotMatch(source, /Esc to close ·'/);
  assert.doesNotMatch(source, /Esc para cerrar ·'/);
  assert.doesNotMatch(source, /Esc để đóng ·'/);
});

test('Ask Everitt footer Escape hint is desktop-only via keyboard label', () => {
  const source = read('components/ask-everitt-command.tsx');
  assert.match(source, /\{kbd \? ` \$\{copy\.escapeHint\}/);
  assert.match(source, /footerPrefix: 'Search uses your workspace data · AI only when needed ·'/);
  assert.match(source, /escapeHint: 'Esc to close'/);
  assert.match(source, /escapeHint: 'Esc para cerrar'/);
  assert.match(source, /escapeHint: 'Esc để đóng'/);
});

test('temporary Ask Everitt mobile CSS workaround is removed', () => {
  const layout = read('app/layout.tsx');
  assert.doesNotMatch(layout, /ask-everitt-mobile-controls\.css/);
  assert.throws(() => read('app/ask-everitt-mobile-controls.css'));
  const globals = read('app/globals.css');
  assert.match(globals, /\.everitt-cmd-close/);
  assert.match(globals, /min-width:\s*40px/);
  assert.match(globals, /min-height:\s*40px/);
});
