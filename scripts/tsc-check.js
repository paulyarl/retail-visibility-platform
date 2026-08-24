#!/usr/bin/env node
/**
 * tsc-check.js — wrapper that runs tsc with an increased heap limit.
 *
 * Usage: node scripts/tsc-check.js <tsconfig-args...>
 * Example: node scripts/tsc-check.js --noEmit --project apps/api
 *
 * Resolves the tsc binary from the --project workspace first (pnpm does not
 * hoist typescript to the repo root), then falls back to apps/api, apps/web.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const rootDir = path.resolve(__dirname, '..');

function projectDirFromArgs(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--project' || arg === '-p') {
      const value = argv[i + 1];
      if (!value) return null;
      const resolved = path.resolve(rootDir, value);
      return fs.existsSync(resolved) && fs.statSync(resolved).isFile()
        ? path.dirname(resolved)
        : resolved;
    }
    if (arg.startsWith('--project=') || arg.startsWith('-p=')) {
      const value = arg.slice(arg.indexOf('=') + 1);
      const resolved = path.resolve(rootDir, value);
      return fs.existsSync(resolved) && fs.statSync(resolved).isFile()
        ? path.dirname(resolved)
        : resolved;
    }
  }
  return null;
}

function resolveTsc() {
  const candidates = [
    projectDirFromArgs(args),
    path.join(rootDir, 'apps', 'api'),
    path.join(rootDir, 'apps', 'web'),
    rootDir,
  ].filter(Boolean);

  for (const dir of candidates) {
    try {
      return require.resolve('typescript/bin/tsc', { paths: [dir] });
    } catch {
      // try next
    }
  }

  throw new Error(
    "Cannot find module 'typescript/bin/tsc'. Install typescript in the workspace you are typechecking (e.g. apps/api)."
  );
}

const tscPath = resolveTsc();

const result = spawnSync(process.execPath, ['--max-old-space-size=8192', tscPath, ...args], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
});

process.exit(result.status || 0);
