/**
 * Catch-All Ordering Lint
 *
 * Scans route orchestrator files for catch-all routes (e.g. router.use('/', ...),
 * router.use('/*', ...)) that appear BEFORE static sub-routes in the same file.
 * Fails with exit code 1 if a violation is found.
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 5.4.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROUTES_DIR = join(__dirname, '..', 'routes');

interface Violation {
  file: string;
  line: number;
  catchAll: string;
  staticRoute: string;
  staticLine: number;
}

function isCatchAllMount(line: string): boolean {
  const trimmed = line.trim();
  // Match patterns like:
  //   router.use('/', ...)
  //   router.use('/*', ...)
  //   router.use('/', someRouter)
  // But NOT: router.use('/specific-path', ...)
  const match = trimmed.match(/router\.use\(\s*['"`]([^'"`]+)['"`]/);
  if (!match) return false;
  const path = match[1];
  return path === '/' || path === '/*' || path === '*';
}

function isStaticMount(line: string): boolean {
  const trimmed = line.trim();
  const match = trimmed.match(/router\.use\(\s*['"`]([^'"`]+)['"`]/);
  if (!match) return false;
  const path = match[1];
  return path !== '/' && path !== '/*' && path !== '*' && path.length > 0;
}

function scanFile(filePath: string): Violation[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Violation[] = [];

  let catchAllLine = -1;
  let catchAllText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isCatchAllMount(line)) {
      // If we already found a catch-all, keep the first one
      if (catchAllLine === -1) {
        catchAllLine = i + 1;
        catchAllText = line.trim();
      }
    }

    // If we found a static route AFTER a catch-all, that's a violation
    if (catchAllLine !== -1 && isStaticMount(line)) {
      violations.push({
        file: filePath,
        line: catchAllLine,
        catchAll: catchAllText,
        staticRoute: line.trim(),
        staticLine: i + 1,
      });
    }
  }

  return violations;
}

function scanDirectory(dir: string): Violation[] {
  const allViolations: Violation[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      allViolations.push(...scanDirectory(fullPath));
    } else if (extname(fullPath) === '.ts') {
      allViolations.push(...scanFile(fullPath));
    }
  }

  return allViolations;
}

// ─── Entry Point ────────────────────────────────────────────────────────────

const violations = scanDirectory(ROUTES_DIR);

if (violations.length === 0) {
  console.log('✅ No catch-all ordering violations found.');
  process.exit(0);
} else {
  console.error(`❌ Found ${violations.length} catch-all ordering violation(s):\n`);
  for (const v of violations) {
    console.error(`  File: ${v.file}`);
    console.error(`  Catch-all at line ${v.line}: ${v.catchAll}`);
    console.error(`  Static route at line ${v.staticLine}: ${v.staticRoute}`);
    console.error('');
  }
  process.exit(1);
}
