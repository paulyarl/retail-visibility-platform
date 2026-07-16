#!/usr/bin/env node
/**
 * Migrate console.error → clientLogger.error and console.warn → clientLogger.warn
 * across the frontend codebase (apps/web/src).
 *
 * - Skips: app/api/ routes (server handlers), test files, client-logger.ts itself
 * - Skips: commented-out console.* calls
 * - Adds import { clientLogger } from '@/lib/client-logger' if not present
 * - Wraps non-object 2nd args in { detail: ... } to satisfy clientLogger API
 */

const fs = require('fs');
const path = require('path');

const WEB_SRC = path.resolve(__dirname, '..', 'apps', 'web', 'src');
const SKIP_DIRS = new Set(['node_modules', 'tests', 'test']);
const SKIP_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.d.ts'];
const SKIP_FILES = new Set(['client-logger.ts']);
const IMPORT_PATH = '@/lib/client-logger';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const DRY_RUN = !WRITE;

let filesFixed = 0;
let replacements = 0;

function collectTsFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip app/api/ (server-side route handlers — clientLogger won't work there)
      if (entry.name === 'api' && dir.replace(/\\/g, '/').endsWith('/app')) continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      collectTsFiles(fullPath, results);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      if (SKIP_SUFFIXES.some(s => entry.name.endsWith(s))) continue;
      if (SKIP_FILES.has(entry.name)) continue;
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Parse arguments of a console.error( or console.warn( call on a single line.
 * Returns { args: string[], start: number, end: number } or null.
 */
function parseCall(line, callName) {
  const patterns = [
    callName + '(',
  ];
  let idx = -1;
  for (const p of patterns) {
    idx = line.indexOf(p);
    if (idx !== -1) break;
  }
  if (idx === -1) return null;

  // Make sure it's not commented out
  const beforeCall = line.slice(0, idx);
  if (beforeCall.includes('//')) return null;

  const argStart = idx + callName.length + 1;
  let depth = 1;
  let args = [];
  let currentArg = '';
  let inString = false;
  let stringChar = '';
  let endPos = -1;

  for (let i = argStart; i < line.length; i++) {
    const char = line[i];

    if (inString) {
      currentArg += char;
      if (char === stringChar && line[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      currentArg += char;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth++;
      currentArg += char;
      continue;
    }

    if (char === ')' || char === ']' || char === '}') {
      depth--;
      if (depth === 0) {
        if (currentArg.trim()) args.push(currentArg.trim());
        endPos = i;
        break;
      }
      currentArg += char;
      continue;
    }

    if (char === ',' && depth === 1) {
      args.push(currentArg.trim());
      currentArg = '';
      continue;
    }

    currentArg += char;
  }

  if (endPos === -1) return null;
  return { args, start: idx, end: endPos };
}

/**
 * Check if an expression is an object literal (starts with {)
 */
function isObjectLiteral(expr) {
  return expr.trim().startsWith('{');
}

/**
 * Transform args for clientLogger.error / clientLogger.warn
 *
 * clientLogger.error(messageOrError: string | Error, context?: Record<string, any>)
 * clientLogger.warn(message: string, context?: Record<string, any>)
 *
 * Rules:
 * - 0 args: skip (invalid call)
 * - 1 arg: direct replacement
 * - 2 args, 2nd is object literal: direct replacement
 * - 2 args, 2nd is not object: wrap 2nd in { detail: ... }
 * - 3+ args: merge extras into { detail: arg2, detail2: arg3, ... }
 */
function transformArgs(args, isWarn) {
  if (args.length === 0) return null;
  if (args.length === 1) return args[0];

  const first = args[0];
  const rest = args.slice(1);

  if (rest.length === 1 && isObjectLiteral(rest[0])) {
    // Direct: clientLogger.error(msg, { ... })
    return `${first}, ${rest[0]}`;
  }

  // Wrap non-object args
  if (rest.length === 1) {
    return `${first}, { detail: ${rest[0]} }`;
  }

  // Multiple extra args
  const wrapped = rest.map((a, i) => i === 0 ? `detail: ${a}` : `detail${i + 1}: ${a}`).join(', ');
  return `${first}, { ${wrapped} }`;
}

function needsImport(content) {
  // Only need to add import if the import path is not already present
  return !content.includes(IMPORT_PATH);
}

function addImport(content) {
  // Check if there's already an import from client-logger
  if (content.includes(IMPORT_PATH)) return content;

  // Find the last import line (look for lines with 'from ' or 'from "')
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match: from '...' or from "..." — end of an import statement
    if (/from\s+['"]/.test(line)) {
      lastImportIdx = i;
    }
    // Also match: import '...' (side-effect imports)
    if (/^import\s+['"]/.test(line.trim())) {
      lastImportIdx = i;
    }
  }

  if (lastImportIdx === -1) {
    // No imports found, add at top
    return `import { clientLogger } from '${IMPORT_PATH}';\n\n` + content;
  }

  // Add after last import
  lines.splice(lastImportIdx + 1, 0, `import { clientLogger } from '${IMPORT_PATH}';`);
  return lines.join('\n');
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let count = 0;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // Skip commented-out lines
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('//')) continue;

    for (const { method, loggerMethod } of [
      { method: 'console.error', loggerMethod: 'clientLogger.error' },
      { method: 'console.warn', loggerMethod: 'clientLogger.warn' },
    ]) {
      const parsed = parseCall(lines[i], method);
      if (!parsed) continue;

      const { args, start, end } = parsed;
      const transformed = transformArgs(args, method === 'console.warn');
      if (!transformed) continue;

      const newCall = `${loggerMethod}(${transformed})`;
      lines[i] = lines[i].slice(0, start) + newCall + lines[i].slice(end + 1);
      count++;
    }
  }
  content = lines.join('\n');

  if (content !== original) {
    // Add import if needed
    if (needsImport(content)) {
      content = addImport(content);
    }

    if (content !== original) {
      replacements += count;
      if (WRITE) {
        fs.writeFileSync(filePath, content, 'utf8');
      }
      return count;
    }
  }
  return 0;
}

// Main
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Migrate console.error/warn → clientLogger (frontend)        ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log();
console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY RUN'}`);
console.log();

const files = collectTsFiles(WEB_SRC);
console.log(`Scanning ${files.length} files...`);
console.log();

for (const file of files) {
  const count = processFile(file);
  if (count > 0) {
    filesFixed++;
    const rel = path.relative(WEB_SRC, file);
    console.log(`  ${rel} — ${count} fix(es)`);
  }
}

console.log();
console.log('─── Summary ───');
console.log(`  Files fixed:    ${filesFixed}`);
console.log(`  Replacements:   ${replacements}`);
if (DRY_RUN) console.log('\nRun with --write to apply.');
if (WRITE) console.log('\nFixes applied. Run pnpm checkweb to verify.');
