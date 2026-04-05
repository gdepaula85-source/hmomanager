#!/usr/bin/env node
/**
 * One-time / maintenance: splits public/js/dashboard-app.js into src/dashboard/sections/*.js
 * by top-level "// ── ... ──" markers. Preserves line order for concatenated build.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcPath = path.join(root, 'public/js/dashboard-app.js');
const outDir = path.join(root, 'src/dashboard/sections');

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'section';
}

function main() {
  const lines = fs.readFileSync(srcPath, 'utf8').split('\n');

  /** Only split on named section banners (skip decorative "// ───────" lines). */
  function isSectionHeader(line) {
    if (!/^\/\/ ──/.test(line)) return false;
    const rest = line.replace(/^\/\/ ──\s*/, '');
    return /[a-zA-Z]/.test(rest);
  }

  const blocks = [];
  let buf = [];
  for (const line of lines) {
    if (isSectionHeader(line)) {
      if (buf.length && buf.some((l) => l.trim())) {
        blocks.push(buf.join('\n'));
      }
      buf = [];
    }
    buf.push(line);
  }
  if (buf.length) blocks.push(buf.join('\n'));

  fs.mkdirSync(outDir, { recursive: true });
  const manifest = [];

  blocks.forEach(function (block, i) {
    const first = block.split('\n').find((l) => /^\/\/ ──/.test(l)) || '';
    const title = first
      .replace(/^\/\/ ──\s*/, '')
      .replace(/\s*─+.*$/, '')
      .trim();
    const name = String(i + 1).padStart(2, '0') + '-' + slug(title || 'block-' + i) + '.js';
    const outPath = path.join(outDir, name);
    fs.writeFileSync(outPath, block.replace(/\n*$/, '') + '\n');
    manifest.push({ file: 'sections/' + name, title: title || '(preamble)' });
  });

  fs.writeFileSync(
    path.join(root, 'src/dashboard/sections-manifest.json'),
    JSON.stringify({ generatedFrom: 'public/js/dashboard-app.js', sections: manifest }, null, 2) + '\n'
  );
  console.log('Wrote', manifest.length, 'section files to', outDir);
}

main();
