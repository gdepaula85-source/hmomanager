#!/usr/bin/env node
/**
 * Concatenates src/dashboard/sections/*.js (+ import { state }) and bundles to
 * public/js/dashboard.bundle.js via esbuild. Top-level functions → window for inline handlers.
 */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const statePath = path.join(root, 'src/dashboard/state.js');
const sectionsDir = path.join(root, 'src/dashboard/sections');
const buildDir = path.join(root, 'build/dashboard');
const bundlePath = path.join(root, 'public/js/dashboard.bundle.js');

function collectTopLevelFunctions(code) {
  const names = new Set();
  const reFn = /^function\s+([a-zA-Z_$][\w$]*)\s*\(/gm;
  const reAsync = /^async\s+function\s+([a-zA-Z_$][\w$]*)\s*\(/gm;
  let m;
  while ((m = reFn.exec(code))) names.add(m[1]);
  while ((m = reAsync.exec(code))) names.add(m[1]);
  return [...names];
}

function getSectionFiles() {
  if (!fs.existsSync(sectionsDir)) {
    throw new Error('Missing ' + sectionsDir + ' — run node scripts/split-dashboard-sections.js');
  }
  return fs
    .readdirSync(sectionsDir)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => path.join(sectionsDir, f));
}

function main() {
  fs.mkdirSync(buildDir, { recursive: true });

  if (!fs.existsSync(statePath)) {
    console.error('Missing', statePath);
    process.exit(1);
  }
  fs.copyFileSync(statePath, path.join(buildDir, 'state.js'));

  const appPath = path.join(buildDir, 'app.js');
  const entryPath = path.join(buildDir, 'entry.js');

  const parts = getSectionFiles().map((f) => fs.readFileSync(f, 'utf8'));
  const appSrc = parts.join('\n');
  const fnNames = collectTopLevelFunctions(appSrc);
  const windowExports = fnNames.map((n) => `window.${n}=${n}`).join(';');
  const footer =
    `\nif (typeof window !== 'undefined') { ${windowExports}; }\n`;
  const appOut = `import { state } from './state.js';\n` + appSrc + footer;
  fs.writeFileSync(appPath, appOut);

  const entrySrc =
    `import { state } from './state.js';\n` +
    `if (typeof window !== 'undefined') window.state = state;\n` +
    `import './app.js';\n`;
  fs.writeFileSync(entryPath, entrySrc);

  esbuild
    .build({
      absWorkingDir: buildDir,
      entryPoints: [entryPath],
      bundle: true,
      outfile: bundlePath,
      format: 'iife',
      platform: 'browser',
      logLevel: 'info',
    })
    .then(() => {
      console.log(
        'dashboard.bundle.js (%d sections, %d top-level functions → window)',
        parts.length,
        fnNames.length
      );
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

main();
