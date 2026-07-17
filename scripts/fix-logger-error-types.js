#!/usr/bin/env node
/**
 * Fix Script: Wraps error variable access with (as any) cast
 * to satisfy TypeScript strict mode where catch vars are `unknown`.
 *
 * Pattern: error?.name → (error as any)?.name
 *          error?.message → (error as any)?.message
 *          error?.stack → (error as any)?.stack
 *
 * Also fixes: non-route files that incorrectly use (req as any).ctx → undefined
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
  let changed = false;
  let count = 0;

  // Fix 1: Wrap error var property access with (as any)
  // Pattern in logger.error calls: VAR?.name, VAR?.message, VAR?.stack
  // Match common error variable names
  const errorVars = ['error', 'err', 'e', 'ex', 'exception', 'errorMessage'];
  for (const v of errorVars) {
    // Replace VAR?.name → (VAR as any)?.name  (but not if already cast)
    const namePattern = new RegExp(`(?<!\\(\\s*)\\b${v}\\?\\.name\\b(?!\\s*\\))`, 'g');
    const msgPattern = new RegExp(`(?<!\\(\\s*)\\b${v}\\?\\.message\\b(?!\\s*\\))`, 'g');
    const stackPattern = new RegExp(`(?<!\\(\\s*)\\b${v}\\?\\.stack\\b(?!\\s*\\))`, 'g');

    // Also fix String(VAR) → no change needed, that's fine
    // But we need to be careful — only replace within logger.error context
    // Since these patterns were only introduced by the migration, safe to replace globally

    const nameBefore = content;
    content = content.replace(namePattern, `(${v} as any)?.name`);
    content = content.replace(msgPattern, `(${v} as any)?.message`);
    content = content.replace(stackPattern, `(${v} as any)?.stack`);

    if (content !== nameBefore) {
      changed = true;
      count += (nameBefore.match(namePattern) || []).length;
    }
  }

  // Fix 2: Files that use (req as any).ctx but don't have req in scope
  // These are non-route files that were misidentified as route files
  // Check if file has (req as any).ctx in logger.error but no req parameter
  if (content.includes('(req as any).ctx')) {
    // Check if the file actually has req parameters (route handler)
    const hasReqParam = /\breq\b.*:\s*(Request|any)\b/.test(content) || 
                        /\breq\s+as\s+any\b/.test(content.slice(0, content.indexOf('logger.error')));
    // More precise: check if there's a function with req parameter
    const hasReqInFunction = /function\s*\w*\s*\([^)]*\breq\b/.test(content) || 
                             /(?:async\s+)?\([^)]*\breq\b[^)]*\)\s*(?::|=>)/.test(content) ||
                             /\breq\s*:\s*Request\b/.test(content) ||
                             /\breq\s*:\s*any\b/.test(content);
    
    if (!hasReqInFunction) {
      // Replace (req as any).ctx with undefined in logger.error calls
      content = content.replace(/\(req as any\)\.ctx/g, 'undefined');
      changed = true;
      count++;
    }
  }

  if (changed) {
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
console.log('║  Fix logger.error TypeScript strict mode errors              ║');
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
if (!WRITE) console.log('\n💡 Run with --write to apply.');
if (WRITE) console.log('\n✅ Fixes applied. Run pnpm checkapi to verify.');
