import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const layout = readFileSync(resolve(root, 'app/layout.tsx'), 'utf8');
const loadedCss = [...layout.matchAll(/import '\.\/(.+\.css)';/g)]
  .map((match) => readFileSync(resolve(root, 'app', match[1]), 'utf8'))
  .join('\n');
const tokens = readFileSync(resolve(root, 'app/design/tokens.css'), 'utf8');
const primitives = readFileSync(resolve(root, 'app/design/primitives.css'), 'utf8');

describe('shared button consistency', () => {
  it('loads the shared rhythm layer after the legacy signed-in layer', () => {
    const consolidatedImport = layout.indexOf("import './global-content-rhythm.css';");
    const legacyImport = layout.indexOf("import './legacy-signed-in.css';");
    assert.ok(consolidatedImport > legacyImport);
  });

  it('keeps a 44px minimum tap target on shared buttons', () => {
    assert.match(tokens, /--eo-tap:\s*44px/);
    assert.match(loadedCss, /\.btn[^{]*\{[^}]*min-height:\s*var\(--eo-tap\)/);
  });

  it('keeps focus, disabled, and danger states readable', () => {
    assert.match(primitives, /:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--eo-color-focus-ring\)/);
    assert.match(loadedCss, /\.btn:disabled[\s\S]*cursor:\s*not-allowed/);
    assert.match(loadedCss, /\.btn-danger\s*\{[^}]*color:\s*var\(--danger\)/);
    assert.doesNotMatch(loadedCss, /:focus-visible[^{]*\{[^}]*outline:\s*none/);
  });
});
