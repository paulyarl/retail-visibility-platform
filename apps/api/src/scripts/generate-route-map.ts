/**
 * Route Map Generator
 *
 * Reads the centralized routeRegistry and introspects each Express router's
 * stack to produce a JSON file with every mounted path, HTTP method, and
 * middleware chain.
 *
 * Output: apps/api/src/generated/route-map.json
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 5.1.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { routeRegistry, AuthLevel } from '../routes/routeRegistry';
import { logger } from '../logger';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RouteMethod {
  method: string;
  path: string;
  fullPath: string;
  middleware: string[];
}

interface RouteMapEntry {
  mountPath: string;
  domain: string;
  authLevel: AuthLevel;
  comment?: string;
  preMiddleware?: boolean;
  isCatchAll?: boolean;
  routes: RouteMethod[];
}

interface RouteMap {
  generatedAt: string;
  totalMounts: number;
  totalRoutes: number;
  mounts: RouteMapEntry[];
}

// ─── Router Introspection ───────────────────────────────────────────────────

/**
 * Extract the name of a middleware function for documentation purposes.
 */
function getMiddlewareName(fn: any): string {
  if (!fn) return 'unknown';
  if (typeof fn === 'string') return fn;
  if (fn.name) return fn.name;
  if (fn.constructor && fn.constructor.name) return fn.constructor.name;
  return 'anonymous';
}

/**
 * Recursively walk an Express router's stack to extract all route definitions.
 * Returns an array of { method, path, fullPath, middleware } objects.
 */
function introspectRouter(
  router: any,
  basePath: string,
  parentMiddleware: string[] = [],
): RouteMethod[] {
  const routes: RouteMethod[] = [];

  if (!router || !router.stack) {
    return routes;
  }

  for (const layer of router.stack) {
    if (layer.route) {
      // This is a terminal route (GET, POST, etc.)
      const rawPath = layer.route.path;
      const routePath = rawPath instanceof RegExp
        ? extractPathFromRegexp(rawPath) || rawPath.source
        : String(rawPath ?? '');
      const fullPath = normalizePath(basePath, routePath);

      for (const method of Object.keys(layer.route.methods)) {
        if (layer.route.methods[method]) {
          const layerMiddleware = (layer.route.stack || []).map((l: any) =>
            getMiddlewareName(l.handle),
          );
          routes.push({
            method: method.toUpperCase(),
            path: routePath,
            fullPath,
            middleware: [...parentMiddleware, ...layerMiddleware],
          });
        }
      }
    } else if (layer.handle && layer.handle.stack) {
      // This is a nested router — recurse
      const nestedPath = layer.regexp
        ? extractPathFromRegexp(layer.regexp, layer.keys)
        : '';
      const nestedBasePath = normalizePath(basePath, nestedPath);
      const nestedMiddleware = (layer.keys || []).map((k: any) =>
        getMiddlewareName(k.handle),
      );
      routes.push(
        ...introspectRouter(
          layer.handle,
          nestedBasePath,
          [...parentMiddleware, ...nestedMiddleware].filter(Boolean),
        ),
      );
    }
  }

  return routes;
}

/**
 * Best-effort extraction of a path string from a Express regexp source.
 * Handles common patterns like /^\/foo\/?(?=\/|$)/i → /foo
 */
function extractPathFromRegexp(regexp: RegExp, keys?: any[]): string {
  const source = regexp.source;
  // Match the leading path segment: /^\/something\/?(?=\/|$)/
  const match = source.match(/^\^\\\/([^?\\/(]+)/);
  if (match) {
    return `/${match[1]}`;
  }
  return '';
}

/**
 * Join a base path and a route path, normalizing double slashes.
 */
function normalizePath(base: string, routePath: string): string {
  if (!routePath || routePath === '/') return base || '/';
  if (base.endsWith('/') && routePath.startsWith('/')) {
    return `${base}${routePath.slice(1)}`;
  }
  if (!base.endsWith('/') && !routePath.startsWith('/')) {
    return `${base}/${routePath}`;
  }
  return `${base}${routePath}`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function generateRouteMap(): RouteMap {
  const mounts: RouteMapEntry[] = [];
  let totalRoutes = 0;

  for (const entry of routeRegistry) {
    const routes = introspectRouter(entry.router, entry.path);
    totalRoutes += routes.length;

    mounts.push({
      mountPath: entry.path,
      domain: entry.domain,
      authLevel: entry.authLevel,
      comment: entry.comment,
      preMiddleware: entry.preMiddleware,
      isCatchAll: entry.isCatchAll,
      routes,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    totalMounts: mounts.length,
    totalRoutes,
    mounts,
  };
}

// ─── Entry Point ────────────────────────────────────────────────────────────

const outputDir = join(__dirname, '..', 'generated');
const outputFile = join(outputDir, 'route-map.json');

try {
  mkdirSync(outputDir, { recursive: true });
  const routeMap = generateRouteMap();
  writeFileSync(outputFile, JSON.stringify(routeMap, null, 2));
  console.log(`✅ Route map generated: ${outputFile}`);
  console.log(`   ${routeMap.totalMounts} mounts, ${routeMap.totalRoutes} routes`);
} catch (error) {
  logger.error('❌ Failed to generate route map:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  process.exit(1);
}
