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
import { logger } from '../logger';

const ROUTES_DIR = join(__dirname, '..', 'routes');

export interface Violation {
  file: string;
  line: number;
  catchAll: string;
  staticRoute: string;
  staticLine: number;
}

export interface ParamViolation {
  file: string;
  paramLine: number;
  paramRoute: string;
  staticRoute: string;
  staticLine: number;
}

export function isCatchAllMount(line: string): boolean {
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

export function isStaticMount(line: string): boolean {
  const trimmed = line.trim();
  const match = trimmed.match(/router\.use\(\s*['"`]([^'"`]+)['"`]/);
  if (!match) return false;
  const path = match[1];
  return path !== '/' && path !== '/*' && path !== '*' && path.length > 0;
}

export function scanFile(filePath: string): Violation[] {
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

// ─── Dynamic Param Shadowing Detection ──────────────────────────────────────

export interface RouteEntry {
  line: number;
  method: string;
  path: string;
  raw: string;
}

export function extractRouteEntry(line: string, lineNum: number): RouteEntry | null {
  const trimmed = line.trim();
  // Match router.get/post/put/delete/patch('path', ...)
  const match = trimmed.match(/router\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/);
  if (!match) return null;
  return { line: lineNum, method: match[1], path: match[2], raw: trimmed };
}

export function getPrefix(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash <= 0) return '';
  return path.substring(0, lastSlash);
}

export function getLastSegment(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return path.substring(lastSlash + 1);
}

export function isDynamicParam(segment: string): boolean {
  return segment.startsWith(':');
}

export function scanFileForParamShadowing(filePath: string): ParamViolation[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: ParamViolation[] = [];
  const routes: RouteEntry[] = [];

  // Track block comments to skip commented-out routes
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Simple block comment tracking (handles /* ... */ spanning multiple lines)
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      continue;
    }
    if (line.trim().startsWith('/*') && !line.includes('*/')) {
      inBlockComment = true;
      continue;
    }

    const entry = extractRouteEntry(line, i + 1);
    if (entry) routes.push(entry);
  }

  // For each route ending in /:param, check if a later route shares the same
  // prefix but has a static final segment
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const lastSeg = getLastSegment(route.path);

    if (!isDynamicParam(lastSeg)) continue;

    const prefix = getPrefix(route.path);
    if (!prefix) continue;

    for (let j = i + 1; j < routes.length; j++) {
      const later = routes[j];
      if (later.method !== route.method) continue;

      const laterPrefix = getPrefix(later.path);
      const laterLastSeg = getLastSegment(later.path);

      if (laterPrefix === prefix && !isDynamicParam(laterLastSeg)) {
        violations.push({
          file: filePath,
          paramLine: route.line,
          paramRoute: route.raw,
          staticRoute: later.raw,
          staticLine: later.line,
        });
      }
    }
  }

  return violations;
}

export function scanDirectory(dir: string): Violation[] {
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

export function scanDirectoryForParamShadowing(dir: string): ParamViolation[] {
  const allViolations: ParamViolation[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      allViolations.push(...scanDirectoryForParamShadowing(fullPath));
    } else if (extname(fullPath) === '.ts') {
      allViolations.push(...scanFileForParamShadowing(fullPath));
    }
  }

  return allViolations;
}

// ─── Entry Point ────────────────────────────────────────────────────────────

export function runLint(): { catchAll: Violation[]; param: ParamViolation[] } {
  const catchAllViolations = scanDirectory(ROUTES_DIR);
  const paramViolations = scanDirectoryForParamShadowing(ROUTES_DIR);

  if (catchAllViolations.length === 0 && paramViolations.length === 0) {
    console.log('✅ No catch-all or param shadowing ordering violations found.');
  } else {
    if (catchAllViolations.length > 0) {
      logger.error(`❌ Found ${catchAllViolations.length} catch-all ordering violation(s):\n`, undefined);
      for (const v of catchAllViolations) {
        logger.error(`  File: ${v.file}`, undefined);
        logger.error(`  Catch-all at line ${v.line}: ${v.catchAll}`, undefined);
        logger.error(`  Static route at line ${v.staticLine}: ${v.staticRoute}`, undefined);
        logger.error('', undefined);
      }
    }
    if (paramViolations.length > 0) {
      logger.error(`❌ Found ${paramViolations.length} dynamic param shadowing violation(s):\n`, undefined);
      for (const v of paramViolations) {
        logger.error(`  File: ${v.file}`, undefined);
        logger.error(`  Param route at line ${v.paramLine}: ${v.paramRoute}`, undefined);
        logger.error(`  Static sibling at line ${v.staticLine}: ${v.staticRoute}`, undefined);
        logger.error('', undefined);
      }
    }
  }

  return { catchAll: catchAllViolations, param: paramViolations };
}

// Auto-run when executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith('lint-catchall-order.ts')) {
  const { catchAll, param } = runLint();
  process.exit(catchAll.length === 0 && param.length === 0 ? 0 : 1);
}
