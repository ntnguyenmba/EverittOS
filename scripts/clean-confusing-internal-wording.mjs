import fs from 'node:fs';
import path from 'node:path';

const roots = ['app', 'components'];
const extensions = new Set(['.tsx', '.ts', '.jsx', '.js']);
const replacements = [
  [/Internal only/g, 'Team notes'],
  [/internal only/g, 'team notes'],
  [/Internal notes/g, 'Team notes'],
  [/internal notes/g, 'team notes'],
  [/For internal use only/g, 'For your team'],
  [/for internal use only/g, 'for your team']
];

function visit(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(fullPath);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;

    const before = fs.readFileSync(fullPath, 'utf8');
    let after = before;
    for (const [pattern, value] of replacements) after = after.replace(pattern, value);
    if (after !== before) fs.writeFileSync(fullPath, after);
  }
}

for (const root of roots) visit(root);
