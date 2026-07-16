#!/usr/bin/env node
/**
 * Fix Script v2: Handles all remaining TS errors from console.error→logger.error migration
 *
 * 1. Wraps ANY variable's ?.name/?.message/?.stack with (VAR as any)?.  in logger.error lines
 * 2. Replaces (req as any).ctx with undefined in files that don't have req in scope
 * 3. Fixes logger.error calls where 2nd arg is a string/number instead of RequestCtx
 */

const fs = require('fs');
const path = require('path');

const API_SRC = path.resolve(__dirname, '..', 'apps', 'api', 'src');
const SKIP_DIRS = new Set(['node_modules', 'tests', 'test']);
const SKIP_SUFFIXES = ['.test.ts', '.spec.ts', '.d.ts'];
const SKIP_FILES = new Set(['logger.ts']);

const args = process.argv.slice(2);
const WRITE = args.includes('--write');

let filesFixed = 0;
let replacements = 0;

function collectTsFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectTsFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      if (SKIP_SUFFIXES.some(s => entry.name.endsWith(s))) continue;
      if (SKIP_FILES.has(entry.name)) continue;
      results.push(fullPath);
    }
  }
  return results;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let count = 0;

  // Fix 1: Wrap ANY VAR?.name/?.message/?.stack with (VAR as any)?.
  // Process line by line, only in logger.error lines
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('logger.error')) continue;

    // Match identifier?.name or identifier?.message or identifier?.stack
    // Don't match if already wrapped: (VAR as any)?.prop
    // Don't match if preceded by ).  (e.g. (something)?.prop is already wrapped)
    lines[i] = lines[i].replace(
      /(?<!\)\?\.)(?<!\w)([a-zA-Z_$][a-zA-Z0-9_$]*)\?\.([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\s*(?:\|\||,|\}|\)))/g,
      (match, varName, prop) => {
        if (prop === 'name' || prop === 'message' || prop === 'stack') {
          // Check if already wrapped: look backwards for 'as any)?'
          const beforeMatch = lines[i].slice(0, lines[i].indexOf(match));
          if (beforeMatch.endsWith('as any)?.')) return match;
          count++;
          return `(${varName} as any)?.${prop}`;
        }
        return match;
      }
    );
  }
  content = lines.join('\n');

  // Fix 2: Replace (req as any).ctx with undefined in files that don't have req in scope
  if (content.includes('(req as any).ctx')) {
    // Remove all logger.error lines then check if req is used elsewhere
    const withoutLogger = content.replace(/logger\.error\([^;]+;?\)/g, '');
    const hasReqElsewhere = /\breq\b/.test(withoutLogger);

    if (!hasReqElsewhere) {
      content = content.replace(/\(req as any\)\.ctx/g, 'undefined');
      count++;
    }
  }

  // Fix 3: Fix logger.error calls where 2nd arg is a string/number instead of RequestCtx
  // Case: logger.error('msg:', error instanceof Error ? error.message : '...', undefined)
  content = content.replace(
    /logger\.error\((['"`][^'"`]*['"`]),\s*(error instanceof Error \? error\.message : [^,)]+),\s*undefined\)/g,
    (match, msg, errExpr) => {
      count++;
      return `logger.error(${msg}, undefined, { error: { name: 'Error', message: ${errExpr} } })`;
    }
  );

  // Case: logger.error('msg:', result.error, undefined) where result.error is a string
  content = content.replace(
    /logger\.error\((['"`][^'"`]*['"`]),\s*(result\.error),\s*undefined\)/g,
    (match, msg, errExpr) => {
      count++;
      return `logger.error(${msg}, undefined, { error: { name: 'Error', message: ${errExpr} } })`;
    }
  );

  // Case: logger.error('msg:', response.status, undefined)
  content = content.replace(
    /logger\.error\((['"`][^'"`]*['"`]),\s*(response\.status),\s*undefined\)/g,
    (match, msg, errExpr) => {
      count++;
      return `logger.error(${msg}, undefined, { error: { name: 'Error', message: String(${errExpr}) } })`;
    }
  );

  // Case: logger.error('msg:', refundResult.error, (req as any).ctx) — wrong arg order
  content = content.replace(
    /logger\.error\((['"`][^'"`]*['"`]),\s*(refundResult\.error),\s*\(req as any\)\.ctx\)/g,
    (match, msg, errExpr) => {
      count++;
      return `logger.error(${msg}, (req as any).ctx, { error: { name: 'Error', message: ${errExpr} } })`;
    }
  );

  // Case: logger.error('msg:', result.errors, undefined) where result.errors is an array
  content = content.replace(
    /logger\.error\((['"`][^'"`]*['"`]),\s*(result\.errors),\s*undefined\)/g,
    (match, msg, errExpr) => {
      count++;
      return `logger.error(${msg}, undefined, { error: { name: 'Error', message: String(${errExpr}) } })`;
    }
  );

  if (content !== original) {
    replacements += count;
    if (WRITE) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
    return count;
  }
  return 0;
}

// Main
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Fix logger.error TS errors v2 — comprehensive               ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log();
console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY RUN'}`);
console.log();

const files = collectTsFiles(API_SRC);
console.log(`Scanning ${files.length} files...`);
console.log();

for (const file of files) {
  const count = processFile(file);
  if (count > 0) {
    filesFixed++;
    const rel = path.relative(API_SRC, file);
    console.log(`  ${rel} — ${count} fix(es)`);
  }
}

console.log();
console.log('─── Summary ───');
console.log(`  Files fixed:    ${filesFixed}`);
console.log(`  Replacements:   ${replacements}`);
if (!WRITE) console.log('\nRun with --write to apply.');
if (WRITE) console.log('\nFixes applied. Run pnpm checkapi to verify.');
