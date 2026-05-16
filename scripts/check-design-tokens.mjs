#!/usr/bin/env node
/**
 * Fails if hex/rgba color literals appear outside styles/tokens.css (:root).
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const TOKEN_FILE = join(ROOT, 'styles/tokens.css');
const SCAN_DIRS = ['styles', 'js', 'index.html'];
const IGNORE = new Set(['node_modules', '.git', 'src/App.jsx']);

const COLOR_RE = /#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]+\)/g;

function collectFiles(relPath) {
  const full = join(ROOT, relPath);
  try {
    const st = statSync(full);
    if (st.isFile()) return [full];
  } catch {
    return [];
  }
  const out = [];
  for (const name of readdirSync(full)) {
    if (IGNORE.has(name)) continue;
    const child = join(full, name);
    const cst = statSync(child);
    if (cst.isDirectory()) out.push(...collectFiles(join(relPath, name)));
    else if (['.css', '.js', '.html'].includes(extname(name))) out.push(child);
  }
  return out;
}

const files = SCAN_DIRS.flatMap(collectFiles).filter((f) => !f.endsWith('check-design-tokens.mjs'));
const violations = [];

for (const file of files) {
  if (file === TOKEN_FILE) continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((lineText, i) => {
    if (/name="theme-color"/.test(lineText)) return;
    let match;
    const re = new RegExp(COLOR_RE.source, 'g');
    while ((match = re.exec(lineText)) !== null) {
      violations.push({ file: file.replace(ROOT, ''), line: i + 1, value: match[0] });
    }
  });
}

if (violations.length) {
  console.error('Design token check failed: color literals outside styles/tokens.css\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.value}`);
  }
  process.exit(1);
}

console.log('Design token check passed.');
