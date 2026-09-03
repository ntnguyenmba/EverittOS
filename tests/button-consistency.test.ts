import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const layout = readFileSync(resolve(root, 'app/layout.tsx'), 'utf8');
const css = readFileSync(resolve(root, 'app/button-consistency.css'), 'utf8');

describe('shared button consistency', () => {
  it('loads the shared button layer after all older page polish files', () => {
    const consolidatedImport = layout.indexOf("import './global-content-rhythm.css';");
    const legacyImport = layout.indexOf("import './legacy-signed-in.css';");

    assert.ok(consolidatedImport > legacyImport);
  });

  it('keeps the common button frame and minimum tap target', () => {
    assert.match(css, /--button-frame:\s*#2d3748/i);
    assert.match(css, /\.btn,[\s\S]*min-height:\s*44px/);
    assert.match(css, /border:\s*1px solid var\(--button-frame\)/);
  });

  it('keeps primary, danger, focus, disabled, and dark-surface states readable', () => {
    assert.match(css, /\.btn-primary,[\s\S]*background:\s*var\(--button-frame\)/);
    assert.match(css, /\.btn-danger,[\s\S]*border-color:\s*#9b2c2c/i);
    assert.match(css, /:focus-visible[\s\S]*outline:\s*3px solid/);
    assert.match(css, /:disabled[\s\S]*pointer-events:\s*none/);
    assert.match(css, /\.surface-dark \.btn:not\(\.btn-primary\)[\s\S]*color:\s*var\(--button-on-dark\)/);
  });

  it('includes mobile button safeguards', () => {
    assert.match(css, /@media \(max-width:\s*640px\)/);
    assert.match(css, /\.settings-actions \.btn/);
    assert.match(css, /\.app-page-top-actions \.btn/);
  });
});
