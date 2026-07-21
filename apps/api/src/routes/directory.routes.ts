/**
 * Directory Routes Orchestrator
 *
 * Single router that mounts all directory sub-routers in strict order:
 * 1. Static sub-path routers (mounted at specific sub-paths)
 * 2. Root-mounted routers with only static paths
 * 3. Root-mounted routers with catch-all params that call next() when unresolved
 * 4. Terminal catch-all router LAST (directory.ts /:slug — returns 404, does NOT call next())
 *
 * This replaces the previous pattern of 15+ separate app.use('/api/directory', ...) calls
 * in routeRegistry.ts that relied on array order for correct routing.
 *
 * ── Auth Middleware Strategy ──────────────────────────────────────────────
 * - Directory routes are public (no auth at mount or internally).
 *   The directory is a public storefront listing service.
 * - Admin-only directory routes (directoryAdminRoutes) are mounted separately
 *   in routeRegistry.ts at /api/admin/directory, not in this orchestrator.
 */

import { Router } from 'express';

// Sub-path routers (were mounted at specific sub-paths under /api/directory)
import directoryFeaturedStoresRoutes from './directory-featured-stores';
import directoryCategoriesOptimizedRoutes from './directory-categories-optimized';
import directoryMvRoutes from './directory-mv';
import directoryStoreTypesRoutes from './directory-store-types';
import directoryFeaturedProductsRoutes from './directory-featured-products';
import directoryFeaturedStatsRoutes from './directory-featured-stats';
import directoryPremiumFeaturedRoutes from './directory-premium-featured';

// Root-mounted routers with only static or scoped paths (no root-level catch-all)
import directoryConsolidatedRoutes from './directory-consolidated';
import directoryRandomFeaturedRoutes from './directory-random-featured';
import directoryRandomFeaturedGlobalRoutes from './directory-random-featured-global';
import directoryCategoriesEnhancedRoutes from './directory-categories-enhanced';
import directoryMapRoutes from './directory-map';

// Root-mounted routers with catch-all params that call next() when unresolved
import directoryCategoriesRoutes from './directory-categories';
import directoryPhotosRouter from './directory-photos';
import enhancedDirectoryRoutes from './directory-enhanced';

// Terminal catch-all (must be LAST — /:slug returns 404, does NOT call next())
import directoryRoutes from './directory';

const router = Router();

// ── 1. Static sub-path routers (no collision risk) ──────────────────────
router.use('/featured-stores', directoryFeaturedStoresRoutes);
router.use('/categories-optimized', directoryCategoriesOptimizedRoutes);
router.use('/mv', directoryMvRoutes);
router.use('/store-types', directoryStoreTypesRoutes);
router.use('/featured-products', directoryFeaturedProductsRoutes);
router.use('/featured-stats', directoryFeaturedStatsRoutes);
router.use('/premium-featured-products', directoryPremiumFeaturedRoutes);

// ── 2. Root-mounted routers with only static or scoped paths ────────────
router.use('/', directoryConsolidatedRoutes);        // /consolidated/:slug
router.use('/random-featured', directoryRandomFeaturedRoutes); // /random-featured, /random-featured/debug, /random-featured/available
router.use('/', directoryRandomFeaturedGlobalRoutes); // /random-featured-global
router.use('/', directoryCategoriesEnhancedRoutes);   // /categories/enhanced, /categories/types, /categories/storefront, /resolve-slug/:slug, /:slug/related
router.use('/', directoryMapRoutes);                  // /map/locations

// ── 3. Root-mounted routers with catch-all that calls next() ────────────
router.use('/', directoryCategoriesRoutes);           // /categories (static), /:categoryId (calls next() when not found)
router.use('/', directoryPhotosRouter);               // /:listingId/photos (scoped to /photos sub-path)
router.use('/', enhancedDirectoryRoutes);             // /resolve-slug/:slug, /:slug/related, /categories/enhanced, /categories/types, /categories/storefront

// ── 4. Terminal catch-all LAST ──────────────────────────────────────────
// directoryRoutes has /search, /locations, /tenant/:identifier (static) and /:slug (catch-all).
// /:slug returns 404 when listing not found — does NOT call next().
// Must be mounted after all other routers to avoid intercepting their routes.
router.use('/', directoryRoutes);

export default router;
