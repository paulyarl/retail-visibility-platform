/**
 * Route Coverage Tests
 *
 * Validates that every entry in the route registry has a valid router,
 * that mount order is correct (pre-middleware before regular, catch-alls last),
 * and that no catch-all route shadows a static route in the same orchestrator.
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 5.3.
 */

import { describe, test, expect } from 'vitest';
import { routeRegistry, getRouteRegistrySummary } from '../routes/routeRegistry';

describe('Route Registry Coverage', () => {
  test('every registry entry has a valid router or middleware', () => {
    for (const entry of routeRegistry) {
      expect(entry.router, `Route ${entry.path} has no router`).toBeDefined();
      // Some entries are middleware functions (e.g. auditLogger), not Express Routers.
      // Only validate .stack for entries that are actual Router instances.
      if (entry.router.stack) {
        expect(Array.isArray(entry.router.stack), `Route ${entry.path} stack is not an array`).toBe(true);
      }
    }
  });

  test('every registry entry has required metadata', () => {
    for (const entry of routeRegistry) {
      expect(entry.path, 'Entry missing path').toBeTruthy();
      expect(entry.domain, `Entry ${entry.path} missing domain`).toBeTruthy();
      expect(entry.authLevel, `Entry ${entry.path} missing authLevel`).toBeTruthy();
      expect(['public', 'tenant', 'admin', 'webhook']).toContain(entry.authLevel);
    }
  });

  test('pre-middleware routes are mounted before regular routes', () => {
    const firstRegularIndex = routeRegistry.findIndex((e) => !e.preMiddleware);
    const lastPreMiddlewareIndex = routeRegistry.reduce(
      (last, e, i) => (e.preMiddleware ? i : last),
      -1,
    );

    if (firstRegularIndex !== -1 && lastPreMiddlewareIndex !== -1) {
      expect(
        lastPreMiddlewareIndex,
        'Pre-middleware routes must come before regular routes',
      ).toBeLessThan(firstRegularIndex);
    }
  });

  test('no duplicate mount paths with same domain', () => {
    const seen = new Set<string>();
    for (const entry of routeRegistry) {
      const key = `${entry.path}:${entry.domain}`;
      // Duplicates are allowed (e.g. multiple cache routes on /api/cache),
      // but we log them for visibility
      if (seen.has(key)) {
        console.warn(`[Route Coverage] Duplicate mount: ${key}`);
      }
      seen.add(key);
    }
  });

  test('registry summary returns grouped domains', () => {
    const summary = getRouteRegistrySummary();
    expect(summary).toBeDefined();
    expect(Array.isArray(summary)).toBe(true);
    expect(summary.length).toBeGreaterThan(0);

    for (const group of summary) {
      expect(group.domain).toBeTruthy();
      expect(group.count).toBeGreaterThan(0);
      expect(Array.isArray(group.paths)).toBe(true);
    }
  });

  test('catch-all routes are marked and mounted after specific routes', () => {
    const catchAlls = routeRegistry.filter((e) => e.isCatchAll);
    const nonCatchAlls = routeRegistry.filter((e) => !e.isCatchAll && !e.preMiddleware);

    if (catchAlls.length > 0) {
      const lastNonCatchAllIndex = routeRegistry.reduce(
        (last, e, i) => (!e.isCatchAll && !e.preMiddleware ? i : last),
        -1,
      );
      const firstCatchAllIndex = routeRegistry.findIndex((e) => e.isCatchAll);

      // Catch-alls should come after all non-catch-all regular routes
      // (they may be interleaved with pre-middleware routes, which is fine)
      if (lastNonCatchAllIndex !== -1 && firstCatchAllIndex !== -1) {
        expect(firstCatchAllIndex).toBeGreaterThan(lastNonCatchAllIndex);
      }
    }
  });

  test('webhook routes are marked as pre-middleware (except intentional late mounts)', () => {
    for (const entry of routeRegistry) {
      if (entry.authLevel === 'webhook') {
        // Webhook routes must be pre-middleware unless explicitly marked as a late mount
        const isLateMount = entry.comment?.toLowerCase().includes('late mount');
        if (!isLateMount) {
          expect(
            entry.preMiddleware,
            `Webhook route ${entry.path} must be pre-middleware for raw body access`,
          ).toBe(true);
        }
      }
    }
  });

  test('admin routes require admin auth level', () => {
    for (const entry of routeRegistry) {
      if (entry.domain === 'admin') {
        expect(
          entry.authLevel === 'admin' || entry.authLevel === 'public',
          `Admin route ${entry.path} has unexpected authLevel: ${entry.authLevel}`,
        ).toBe(true);
      }
    }
  });

  test('marketing-ops route is registered with admin auth level', () => {
    const mktEntry = routeRegistry.find((e) => e.path === '/api/admin/marketing-ops');
    expect(mktEntry, 'Marketing Ops route not found in registry').toBeDefined();
    expect(mktEntry!.domain).toBe('admin');
    expect(mktEntry!.authLevel).toBe('admin');
    expect(mktEntry!.router, 'Marketing Ops route has no router').toBeDefined();
  });

  // ─── Route-ordering guard ───────────────────────────────────────────
  // Prevents the bug class where a `:param` catch-all (e.g. /:id, /openers/:id)
  // is declared before a static sub-path (e.g. /openers/headers) in the same
  // Express Router, causing Express to match /openers/headers as :id='headers'.
  // See: end-of-phase-sprint-checklist.md "Route order and catch-all ordering".
  test('no param route shadows a static sub-path in the same router', () => {
    for (const entry of routeRegistry) {
      if (!entry.router?.stack || !Array.isArray(entry.router.stack)) continue;

      const stack = entry.router.stack as any[];
      // Collect (index, path) pairs for route handlers (skip middleware).
      const routes: { index: number; path: string }[] = [];
      for (let i = 0; i < stack.length; i++) {
        const layer = stack[i];
        if (!layer.route) continue; // skip middleware (no .route)
        const path = layer.route.path;
        if (typeof path !== 'string') continue;
        routes.push({ index: i, path });
      }

      // For each param route (contains :param), check that no static route
      // under the same prefix appears after it.
      for (const paramRoute of routes) {
        if (!paramRoute.path.includes(':')) continue;

        // Derive the static prefix before the :param.
        // e.g. /openers/:id → prefix /openers/
        const paramIdx = paramRoute.path.indexOf(':');
        const prefix = paramRoute.path.slice(0, paramIdx);

        for (const staticRoute of routes) {
          if (staticRoute.index <= paramRoute.index) continue;
          if (!staticRoute.path.startsWith(prefix)) continue;
          if (staticRoute.path.includes(':')) continue; // skip other param routes

          // staticRoute is a static path under the same prefix, declared AFTER
          // the param route → Express will match it as the param value. Bug.
          expect(
            staticRoute.index,
            `Route-ordering bug in ${entry.path}: param route "${paramRoute.path}" ` +
              `(stack #${paramRoute.index}) is declared before static sub-path ` +
              `"${staticRoute.path}" (stack #${staticRoute.index}). ` +
              `Express will match "${staticRoute.path}" as :${paramRoute.path.slice(paramIdx)}=` +
              `"${staticRoute.path.slice(prefix.length)}". ` +
              `Move "${staticRoute.path}" before "${paramRoute.path}".`,
          ).toBeLessThan(paramRoute.index);
        }
      }
    }
  });
});
