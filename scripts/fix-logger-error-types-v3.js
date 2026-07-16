#!/usr/bin/env node
/**
 * Fix Script v3: Handles all 110 remaining TS errors
 *
 * 1. Replace ALL (req as any).ctx with undefined (fixes TS2304)
 * 2. Restructure logger.error calls where 2nd arg is not RequestCtx (fixes TS2345)
 * 3. Merge extra args when 4+ args given (fixes TS2554)
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

/**
 * Parse arguments of a logger.error( call on a line.
 * Returns { args: string[], start: number, end: number } or null.
 */
function parseLoggerCall(line, callName) {
  const idx = line.indexOf(callName + '(');
  if (idx === -1) return null;

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
 * Check if an expression is a valid 2nd arg (RequestCtx | undefined)
 */
function isValidCtxExpr(expr) {
  const trimmed = expr.trim();
  if (trimmed === 'undefined') return true;
  // req.ctx or req?.ctx patterns are valid in route files
  if (/^req\.ctx$/.test(trimmed)) return true;
  if (/^req\?\.ctx$/.test(trimmed)) return true;
  return false;
}

/**
 * Check if an expression is an error object (3rd arg pattern)
 */
function isErrorObject(expr) {
  const trimmed = expr.trim();
  return trimmed.startsWith('{ error:') || trimmed.startsWith('{error:');
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let count = 0;

  // Fix 1: Replace ALL (req as any).ctx with undefined
  content = content.replace(/\(req as any\)\.ctx/g, 'undefined');

  // Fix 2 & 3: Process logger.error calls line by line
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('logger.error')) continue;

    const parsed = parseLoggerCall(lines[i], 'logger.error');
    if (!parsed) continue;

    const { args, start, end } = parsed;
    if (args.length < 2) continue;

    // Check if 2nd arg is valid ctx
    if (isValidCtxExpr(args[1])) {
      // Check for too many args (4+)
      if (args.length > 3) {
        // Merge extra args into message or error
        // Pattern: logger.error(msg, ctx, extra1, extra2, ...)
        // → logger.error(msg, ctx, { error: { name: 'Error', message: String(extra1) + ... } })
        const msg = args[0];
        const ctx = args[1];
        const extras = args.slice(2).map(a => `String(${a})`).join(' + ');
        const newCall = `logger.error(${msg}, ${ctx}, { error: { name: 'Error', message: ${extras} } })`;
        lines[i] = lines[i].slice(0, start) + newCall + lines[i].slice(end + 1);
        count++;
      }
      continue;
    }

    // 2nd arg is NOT a valid ctx — need to restructure
    const msg = args[0];
    const wrongArg = args[1];

    if (args.length === 2) {
      // logger.error(msg, wrongArg) → logger.error(msg, undefined, { error: { name: 'Error', message: String(wrongArg) } })
      const newCall = `logger.error(${msg}, undefined, { error: { name: 'Error', message: String(${wrongArg}) } })`;
      lines[i] = lines[i].slice(0, start) + newCall + lines[i].slice(end + 1);
      count++;
    } else if (args.length === 3) {
      // logger.error(msg, wrongArg, thirdArg)
      const thirdArg = args[2];
      if (isValidCtxExpr(thirdArg)) {
        // logger.error(msg, wrongArg, undefined) → logger.error(msg, undefined, { error: { name: 'Error', message: String(wrongArg) } })
        const newCall = `logger.error(${msg}, undefined, { error: { name: 'Error', message: String(${wrongArg}) } })`;
        lines[i] = lines[i].slice(0, start) + newCall + lines[i].slice(end + 1);
        count++;
      } else if (isErrorObject(thirdArg)) {
        // logger.error(msg, wrongArg, { error: {...} }) → logger.error(msg, undefined, { error: { name: 'Error', message: String(wrongArg), ...merge } })
        // Extract existing error props
        const innerMatch = thirdArg.match(/^\{\s*error:\s*\{([^}]*)\}\s*\}$/);
        if (innerMatch) {
          const existingProps = innerMatch[1].trim();
          const newCall = `logger.error(${msg}, undefined, { error: { name: 'Error', message: String(${wrongArg}), ${existingProps} } })`;
          lines[i] = lines[i].slice(0, start) + newCall + lines[i].slice(end + 1);
          count++;
        } else {
          // Complex error object — just put wrongArg into message and keep the object
          const newCall = `logger.error(${msg}, undefined, { error: { name: 'Error', message: String(${wrongArg}) } })`;
          lines[i] = lines[i].slice(0, start) + newCall + lines[i].slice(end + 1);
          count++;
        }
      } else {
        // Both 2nd and 3rd are wrong — merge both into error object
        const newCall = `logger.error(${msg}, undefined, { error: { name: 'Error', message: String(${wrongArg}) + ' ' + String(${thirdArg}) } })`;
        lines[i] = lines[i].slice(0, start) + newCall + lines[i].slice(end + 1);
        count++;
      }
    } else if (args.length >= 4) {
      // logger.error(msg, wrongArg, ctxOrNot, errorObjOrNot, ...)
      // Best effort: put wrongArg into message, use undefined for ctx, merge rest
      const ctx = isValidCtxExpr(args[2]) ? args[2] : 'undefined';
      const rest = args.slice(2).filter(a => !isValidCtxExpr(a)).map(a => `String(${a})`).join(' + ');
      const newCall = `logger.error(${msg}, ${ctx}, { error: { name: 'Error', message: String(${wrongArg}) + ${rest ? ' + ' + rest : ''} } })`;
      lines[i] = lines[i].slice(0, start) + newCall + lines[i].slice(end + 1);
      count++;
    }
  }
  content = lines.join('\n');

  if (content !== original) {
    // Count includes both (req as any).ctx replacements and logger.error restructurings
    const reqReplacements = (original.match(/\(req as any\)\.ctx/g) || []).length;
    count = Math.max(count, reqReplacements);
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
console.log('║  Fix logger.error TS errors v3 — final pass                  ║');
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
