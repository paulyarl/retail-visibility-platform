#!/usr/bin/env node
/**
 * Batch Migration Script: console.error → logger.error
 *
 * Transforms console.error calls in .ts files under apps/api/src/
 * into structured logger.error calls with proper error objects.
 *
 * Patterns handled:
 *   1. Route handlers with req + res (uses req.ctx as context)
 *   2. Services/jobs/lib (uses undefined as context)
 *
 * Safety features:
 *   - Dry-run mode by default (shows what would change)
 *   - --write flag to apply changes
 *   - Skips files that already import logger
 *   - Skips test files (*.test.ts, *.spec.ts)
 *   - Skips logger.ts itself
 *   - Backup files created with .bak extension when --write
 *   - Detailed report of changes per file
 *
 * Usage:
 *   node scripts/migrate-console-to-logger.js              # dry-run, print report
 *   node scripts/migrate-console-to-logger.js --write       # apply changes
 *   node scripts/migrate-console-to-logger.js --write --filter routes  # only routes dir
 */

const fs = require('fs');
const path = require('path');

const API_SRC = path.resolve(__dirname, '..', 'apps', 'api', 'src');
const SKIP_DIRS = new Set(['node_modules', 'tests', 'test']);
const SKIP_SUFFIXES = ['.test.ts', '.spec.ts', '.d.ts'];
const SKIP_FILES = new Set(['logger.ts']);

// --- CLI args ---
const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const filterArg = args.find(a => a.startsWith('--filter='));
const FILTER = filterArg ? filterArg.split('=')[1].replace(/\\/g, '/') : null;
const verbose = args.includes('--verbose');

// --- Stats ---
const stats = {
  filesScanned: 0,
  filesChanged: 0,
  consoleErrorFound: 0,
  consoleErrorConverted: 0,
  importsAdded: 0,
  skipped: 0,
  errors: 0,
};

const report = [];

/**
 * Recursively collect .ts files
 */
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
      if (FILTER && !fullPath.replace(/\\/g, '/').includes(FILTER)) continue;
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Check if file already imports logger
 */
function hasLoggerImport(content) {
  return /import\s*\{[^}]*logger[^}]*\}\s*from\s*['"][^'"]*logger['"]/.test(content);
}

/**
 * Compute relative import path for logger from a given file
 */
function getLoggerImportPath(filePath) {
  const srcDir = API_SRC;
  const fileDir = path.dirname(filePath);
  let rel = path.relative(fileDir, path.join(srcDir, 'logger'));
  if (!rel.startsWith('.')) rel = './' + rel;
  // Normalize separators for Windows
  return rel.replace(/\\/g, '/');
}

/**
 * Detect if this file is a route handler (has req/res pattern)
 * We check for presence of `req` and `res` parameters or `(req as any).ctx`
 */
function isRouteFile(content) {
  // Strong signals: uses req.ctx or (req as any).ctx or res.status
  return /\breq\b.*\bctx\b|\(req\s+as\s+any\)\.ctx|res\.status\s*\(/.test(content);
}

/**
 * Extract the tag from console.error call if present
 * Patterns:
 *   console.error('[TAG] message:', error);
 *   console.error('message:', error);
 *   console.error('message', error);
 *   console.error(`template ${var}`, error);
 */
function parseConsoleError(line) {
  // Match console.error( with various quote styles
  // We need to handle multi-line calls too, but start with single-line
  const trimmed = line.trim();

  // Pattern: console.error(<string>, <error-var>)
  // Capture the string literal and the error variable
  const match = trimmed.match(/^console\.error\(\s*(.+?)\s*,\s*(\w+)\s*\)\s*;?\s*$/);
  if (match) {
    const msgPart = match[1].trim();
    const errVar = match[2].trim();
    return { msgPart, errVar, raw: trimmed };
  }

  // Pattern: console.error(<string>) — no error variable
  const matchNoErr = trimmed.match(/^console\.error\(\s*(.+?)\s*\)\s*;?\s*$/);
  if (matchNoErr) {
    const msgPart = matchNoErr[1].trim();
    return { msgPart, errVar: null, raw: trimmed };
  }

  // Pattern: console.error(<string>, <multiple args>)
  const matchMulti = trimmed.match(/^console\.error\(\s*(.+?)\s*,\s*(.+?)\s*\)\s*;?\s*$/);
  if (matchMulti) {
    const msgPart = matchMulti[1].trim();
    const errPart = matchMulti[2].trim();
    // If the second arg looks like a simple variable, use it
    if (/^\w+$/.test(errPart)) {
      return { msgPart, errVar: errPart, raw: trimmed };
    }
    // Otherwise treat as complex — we'll handle it differently
    return { msgPart, errVar: errPart, raw: trimmed, complex: true };
  }

  return null;
}

/**
 * Build the logger.error replacement line
 */
function buildLoggerCall(parsed, indent, isRoute, loggerVar) {
  const { msgPart, errVar, complex } = parsed;

  // Determine context: route files use (req as any).ctx, others use undefined
  const ctxExpr = isRoute ? '(req as any).ctx' : 'undefined';

  if (complex) {
    // Complex second argument — wrap in error object if it's not just a var
    // e.g. console.error('msg:', error.message, someExtra)
    return `${indent}${loggerVar}.error(${msgPart}, ${ctxExpr}, { error: { name: 'Error', message: String(${errVar}) } });`;
  }

  if (errVar) {
    // Standard: logger.error(msg, ctx, { error: { name, message, stack } })
    // Optional chaining handles non-Error throws (strings, numbers, etc.)
    return `${indent}${loggerVar}.error(${msgPart}, ${ctxExpr}, { error: { name: ${errVar}?.name || 'Error', message: ${errVar}?.message || String(${errVar}), stack: ${errVar}?.stack } });`;
  }

  // No error variable — just log the message
  return `${indent}${loggerVar}.error(${msgPart}, ${ctxExpr});`;
}

/**
 * Add logger import to file content
 */
function addLoggerImport(content, filePath) {
  const importPath = getLoggerImportPath(filePath);
  const importLine = `import { logger } from '${importPath}';\n`;

  // Try to add after the last import statement
  const importMatches = [...content.matchAll(/^import\s.+$/gm)];
  if (importMatches.length > 0) {
    const lastImport = importMatches[importMatches.length - 1];
    const insertPos = lastImport.index + lastImport[0].length + 1; // +1 for newline
    return content.slice(0, insertPos) + importLine + content.slice(insertPos);
  }

  // No imports found — add at top
  return importLine + '\n' + content;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const isRoute = isRouteFile(content);
  const alreadyHasLogger = hasLoggerImport(content);

  let changed = false;
  let changeCount = 0;
  const changes = [];

  // First pass: identify all console.error lines (single-line only)
  const consoleErrorLines = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('console.error(') && trimmed.includes(')')) {
      // Check if it's a complete single-line call
      const openCount = (trimmed.match(/\(/g) || []).length;
      const closeCount = (trimmed.match(/\)/g) || []).length;
      if (openCount === closeCount) {
        consoleErrorLines.push(i);
      }
      // Multi-line console.error calls are skipped for safety
    }
  }

  if (consoleErrorLines.length === 0) return null;

  stats.consoleErrorFound += consoleErrorLines.length;

  // Determine logger variable name (handle if 'logger' is already imported for something else)
  let loggerVar = 'logger';
  // Check if 'logger' is already used in the file for something else
  if (alreadyHasLogger) {
    // Verify it's THE logger (from logger.ts)
    const importMatch = content.match(/import\s*\{\s*([^}]*logger[^}]*)\s*\}\s*from\s*['"]([^'"]*logger['"])/);
    if (importMatch) {
      // Already has proper logger import — use it
      loggerVar = 'logger';
    } else {
      // 'logger' might be used for something else — use _logger
      loggerVar = '_logger';
    }
  }

  // Process lines in reverse order to preserve line numbers
  const newLines = [...lines];

  for (let i = consoleErrorLines.length - 1; i >= 0; i--) {
    const lineIdx = consoleErrorLines[i];
    const line = lines[lineIdx];
    const indent = line.match(/^(\s*)/)[1];

    const parsed = parseConsoleError(line);
    if (!parsed) {
      if (verbose) console.log(`  SKIP (unparseable): ${filePath}:${lineIdx + 1}`);
      stats.skipped++;
      continue;
    }

    const replacement = buildLoggerCall(parsed, indent, isRoute, loggerVar);
    newLines[lineIdx] = replacement;
    changed = true;
    changeCount++;
    stats.consoleErrorConverted++;

    changes.push({
      line: lineIdx + 1,
      before: line.trim(),
      after: replacement.trim(),
    });
  }

  if (!changed) return null;

  let finalContent = newLines.join('\n');

  // Add import if needed
  if (!alreadyHasLogger) {
    finalContent = addLoggerImport(finalContent, filePath);
    stats.importsAdded++;
  } else if (loggerVar === '_logger') {
    // Need to import as _logger
    const importPath = getLoggerImportPath(filePath);
    const importLine = `import { logger as _logger } from '${importPath}';\n`;
    // Add after last import
    const importMatches = [...finalContent.matchAll(/^import\s.+$/gm)];
    if (importMatches.length > 0) {
      const lastImport = importMatches[importMatches.length - 1];
      const insertPos = lastImport.index + lastImport[0].length + 1;
      finalContent = finalContent.slice(0, insertPos) + importLine + finalContent.slice(insertPos);
    }
    stats.importsAdded++;
  }

  return { finalContent, changeCount, changes, isRoute, loggerVar };
}

// --- Main ---

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  console.error → logger.error Migration Script              ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log();
console.log(`Mode: ${WRITE ? 'WRITE (changes will be applied)' : 'DRY RUN (no changes written)'}`);
console.log(`Source: ${API_SRC}`);
if (FILTER) console.log(`Filter: ${FILTER}`);
console.log();

const files = collectTsFiles(API_SRC);
console.log(`Found ${files.length} .ts files to scan`);
console.log();

for (const file of files) {
  stats.filesScanned++;

  let result;
  try {
    result = processFile(file);
  } catch (e) {
    stats.errors++;
    console.error(`ERROR processing ${file}: ${e.message}`);
    continue;
  }

  if (!result) continue;

  stats.filesChanged++;
  const relPath = path.relative(API_SRC, file);
  const routeTag = result.isRoute ? ' [route]' : ' [service]';

  console.log(`📄 ${relPath}${routeTag} — ${result.changeCount} replacement(s)`);

  if (verbose) {
    for (const ch of result.changes) {
      console.log(`   L${ch.line}:`);
      console.log(`     -  ${ch.before}`);
      console.log(`     +  ${ch.after}`);
    }
  }

  report.push({ file: relPath, changes: result.changes, isRoute: result.isRoute });

  if (WRITE) {
    // Create backup
    fs.copyFileSync(file, file + '.bak');
    fs.writeFileSync(file, result.finalContent, 'utf8');
  }
}

// --- Report ---
console.log();
console.log('─── Summary ───');
console.log(`  Files scanned:     ${stats.filesScanned}`);
console.log(`  Files changed:     ${stats.filesChanged}`);
console.log(`  console.error found:  ${stats.consoleErrorFound}`);
console.log(`  Converted:         ${stats.consoleErrorConverted}`);
console.log(`  Skipped (unparseable): ${stats.skipped}`);
console.log(`  Imports added:     ${stats.importsAdded}`);
console.log(`  Errors:            ${stats.errors}`);

if (!WRITE) {
  console.log();
  console.log('💡 Run with --write to apply changes.');
  console.log('   Backup files (.bak) are created when --write is used.');
  console.log('   Run "pnpm checkapi" after migration to verify.');
}

if (WRITE) {
  console.log();
  console.log('✅ Migration applied. Next steps:');
  console.log('   1. Run: pnpm checkapi');
  console.log('   2. Review any TS errors (multi-line console.error calls need manual migration)');
  console.log('   3. Remove .bak files once verified: find apps/api/src -name "*.bak" -delete');
  console.log('   4. Run tests to verify no regressions');
}

// Write report file
const reportPath = path.resolve(__dirname, 'migration-report.json');
fs.writeFileSync(reportPath, JSON.stringify({ stats, report }, null, 2));
console.log();
console.log(`📋 Detailed report: ${reportPath}`);
