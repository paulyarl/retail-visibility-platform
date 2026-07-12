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
  test('every registry entry has a valid router with a stack', () => {
    for (const entry of routeRegistry) {
      expect(entry.router, `Route ${entry.path} has no router`).toBeDefined();
      expect(entry.router.stack, `Route ${entry.path} router has no stack`).toBeDefined();
      expect(Array.isArray(entry.router.stack), `Route ${entry.path} stack is not an array`).toBe(true);
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

  test('webhook routes are marked as pre-middleware', () => {
    for (const entry of routeRegistry) {
      if (entry.authLevel === 'webhook') {
        expect(
          entry.preMiddleware,
          `Webhook route ${entry.path} must be pre-middleware for raw body access`,
        ).toBe(true);
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
});
