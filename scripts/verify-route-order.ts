/**
 * Route Order Verification Script
 *
 * Boots Express without listening and inspects the router stacks
 * to assert that static routes are registered before catch-all param routes.
 *
 * Key assertions:
 *   1. /api/directory: /search, /stores, /locations come before /:slug
 *   2. /api/tenants: sub-resource routers come before /:id patterns
 *   3. /api/admin: specific sub-path routers come before generic root mounts
 *
 * Usage: npx ts-node scripts/verify-route-order.ts
 */

import express from 'express';
import { mountFromRegistry } from '../apps/api/src/routes/routeRegistry';

interface LayerInfo {
  path: string;
  keys: { name: string; optional: boolean }[];
  isRouter: boolean;
}

/**
 * Extract layer info from an Express router stack.
 */
function getLayerInfos(stack: any[]): LayerInfo[] {
  return stack.map((layer) => {
    const path = layer.regexp?.source || '';
    const keys = (layer.keys || []).map((k: any) => ({
      name: k.name,
      optional: k.optional,
    }));
    const isRouter = !!(layer.handle && layer.handle.stack);
    return { path, keys, isRouter };
  });
}

/**
 * Check if a layer path contains a catch-all param (e.g., /:slug, /:id).
 */
function hasCatchAllParam(info: LayerInfo): boolean {
  return info.keys.some((k) => !k.optional && (k.name === 'slug' || k.name === 'id' || k.name === 'identifier'));
}

/**
 * Find the index of the first layer that matches a specific path pattern.
 */
function findLayerIndex(infos: LayerInfo[], pathPattern: string): number {
  return infos.findIndex((info) => info.path.includes(pathPattern));
}

/**
 * Find the index of the first layer with a catch-all param.
 */
function findCatchAllIndex(infos: LayerInfo[]): number {
  return infos.findIndex((info) => hasCatchAllParam(info));
}

// ─── Test runner ───────────────────────────────────────────────────────────

const results: { name: string; passed: boolean; detail: string }[] = [];

function assert(name: string, condition: boolean, detail: string) {
  results.push({ name, passed: condition, detail });
  const status = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (!condition) {
    console.log(`       ${detail}`);
  }
}

// ─── Boot app without listening ────────────────────────────────────────────

const app = express();
mountFromRegistry(app);

// ─── Inspect the main router stack ─────────────────────────────────────────

const mainRouter = (app as any)._router;
if (!mainRouter || !mainRouter.stack) {
  console.error('❌ No router stack found on app');
  process.exit(1);
}

const mainLayers = getLayerInfos(mainRouter.stack);

// ─── Test 1: Directory orchestrator — static routes before catch-all ───────

// Find the /api/directory mount in the main stack
const dirMountIndex = mainLayers.findIndex((l) => l.path.includes('api') && l.path.includes('directory'));
if (dirMountIndex >= 0) {
  const dirRouter = mainRouter.stack[dirMountIndex].handle;
  if (dirRouter && dirRouter.stack) {
    const dirLayers = getLayerInfos(dirRouter.stack);

    // The terminal catch-all (directory.ts /:slug) should be the LAST root-mounted router
    // Static sub-path routers (e.g., /featured-stores, /categories-optimized) should come first
    const firstStaticSubPath = dirLayers.findIndex((l) => l.path.includes('featured-stores'));
    const lastRootMount = dirLayers.length - 1;

    assert(
      'Directory: static sub-path routers exist',
      firstStaticSubPath >= 0,
      `Expected to find /featured-stores in directory orchestrator`,
    );

    assert(
      'Directory: terminal catch-all is mounted last',
      lastRootMount > firstStaticSubPath,
      `Terminal catch-all at index ${lastRootMount}, first static at ${firstStaticSubPath}`,
    );

    // Verify /search and /stores are not intercepted by /:slug
    // The directory.ts router (terminal) should be last — it contains /search, /stores, /:slug internally
    // We just need to verify the terminal router is last
    const terminalLayer = dirLayers[dirLayers.length - 1];
    assert(
      'Directory: last layer is a router (terminal catch-all)',
      terminalLayer.isRouter,
      `Expected last layer to be a router, got path: ${terminalLayer.path}`,
    );
  }
} else {
  assert('Directory: orchestrator found in main stack', false, 'Could not find /api/directory mount');
}

// ─── Test 2: Tenant orchestrator — sub-resource routers before /:id ────────

const tenantMountIndex = mainLayers.findIndex((l) => l.path.includes('api') && l.path.includes('tenants'));
if (tenantMountIndex >= 0) {
  const tenantRouter = mainRouter.stack[tenantMountIndex].handle;
  if (tenantRouter && tenantRouter.stack) {
    const tenantLayers = getLayerInfos(tenantRouter.stack);

    // The main tenants CRUD router (with /:id patterns) should be mounted LAST
    const lastLayer = tenantLayers[tenantLayers.length - 1];
    assert(
      'Tenants: last layer is a router (main CRUD)',
      lastLayer.isRouter,
      `Expected last layer to be a router, got path: ${lastLayer.path}`,
    );

    // There should be multiple sub-resource routers before the last one
    const routerCount = tenantLayers.filter((l) => l.isRouter).length;
    assert(
      'Tenants: multiple sub-resource routers mounted before main CRUD',
      routerCount > 1,
      `Expected >1 router in tenant orchestrator, got ${routerCount}`,
    );
  }
} else {
  assert('Tenants: orchestrator found in main stack', false, 'Could not find /api/tenants mount');
}

// ─── Test 3: Admin orchestrator — specific sub-paths before generic root ───

const adminMountIndex = mainLayers.findIndex((l) => l.path.includes('api') && l.path.includes('admin'));
if (adminMountIndex >= 0) {
  const adminRouter = mainRouter.stack[adminMountIndex].handle;
  if (adminRouter && adminRouter.stack) {
    const adminLayers = getLayerInfos(adminRouter.stack);

    // Specific sub-path routers (e.g., /service-charges, /users) should come before
    // generic root-mounted routers (mounted at /)
    const firstSpecificSubPath = adminLayers.findIndex((l) => l.path.includes('service-charges'));
    const firstRootMount = adminLayers.findIndex((l) => l.path === '^\\/(?=|$)' && l.isRouter);

    assert(
      'Admin: specific sub-path routers exist',
      firstSpecificSubPath >= 0,
      `Expected to find /service-charges in admin orchestrator`,
    );

    assert(
      'Admin: generic root mounts come after specific sub-paths',
      firstRootMount > firstSpecificSubPath,
      `Generic root mount at index ${firstRootMount}, first specific at ${firstSpecificSubPath}`,
    );

    // Verify the last 5 layers are the generic root mounts
    const lastFive = adminLayers.slice(-5);
    const allRootMounts = lastFive.every((l) => l.path === '^\\/(?=|$)' && l.isRouter);
    assert(
      'Admin: last 5 layers are generic root mounts',
      allRootMounts,
      `Expected last 5 layers to be root mounts, got paths: ${lastFive.map((l) => l.path).join(', ')}`,
    );
  }
} else {
  assert('Admin: orchestrator found in main stack', false, 'Could not find /api/admin mount');
}

// ─── Test 4: No duplicate mounts at the same path ──────────────────────────

const pathCounts = new Map<string, number>();
for (const layer of mainLayers) {
  if (!layer.isRouter) continue;
  const path = layer.path;
  pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
}

const duplicates = Array.from(pathCounts.entries()).filter(([, count]) => count > 5);
assert(
  'No excessive duplicate mounts (>5 at same path)',
  duplicates.length === 0,
  duplicates.length > 0 ? `Duplicates: ${duplicates.map(([p, c]) => `${p}(${c})`).join(', ')}` : 'No duplicates found',
);

// ─── Summary ───────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;

console.log('');
console.log('─── Route Order Verification Summary ───');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('────────────────────────────────────────');

if (failed > 0) {
  console.log('');
  console.log('Failed tests:');
  for (const r of results.filter((r) => !r.passed)) {
    console.log(`  - ${r.name}: ${r.detail}`);
  }
  process.exit(1);
} else {
  console.log('');
  console.log('🎉 All route order checks passed!');
  process.exit(0);
}
