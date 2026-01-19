import { Router, Request, Response } from 'express';
import { featuredStoresService } from '../services/featured-stores.service';

const router = Router();

// Debug middleware to log all requests to this router
router.use((req, res, next) => {
  console.log(`[FEATURED-STORES-ROUTER] ${req.method} ${req.path} - Original URL: ${req.originalUrl}`);
  next();
});

/**
 * GET /api/directory/featured-stores
 * 
 * Get featured stores (promotional)
 * This is completely separate from store types/directory categories
 */
router.get('/', async (req: Request, res: Response) => {
  console.log('[FEATURED-STORES] GET / route hit - fetching featured stores');
  try {
    const { lat, lng, radius, limit } = req.query;

    // Parse location parameters if provided
    const location =
      lat && lng
        ? {
            lat: parseFloat(lat as string),
            lng: parseFloat(lng as string),
          }
        : undefined;

    const radiusMiles = radius ? parseFloat(radius as string) : 25;
    const maxStores = limit ? parseInt(limit as string, 10) : 50;

    // Use the dedicated featured stores service
    const { stores, stats, totalCount } = await featuredStoresService.getFeaturedStores(
      location, 
      radiusMiles, 
      maxStores
    );

    // Create synthetic store type response for frontend compatibility
    const featuredStoreType = {
      id: "featured-stores",
      name: "Featured Stores", 
      slug: "featured-stores",
      storeCount: stats.totalStores,
      totalProducts: stats.totalProducts,
      avgRating: stats.avgRating,
      uniqueLocations: stats.uniqueLocations,
      cities: stats.cities,
      states: stats.states,
      featuredStoreCount: stats.totalStores, // Same as store count for featured stores
      syncedStoreCount: 0,
      firstStoreAdded: stats.firstStoreAdded,
      lastStoreUpdated: stats.lastStoreUpdated
    };

    res.json({
      success: true,
      data: {
        storeType: featuredStoreType,
        stores: stores,
        totalCount: totalCount,
        returnedCount: stores.length,
        location: location || null,
        radius: radiusMiles,
      },
    });
  } catch (error) {
    console.error('[FEATURED-STORES] Error fetching featured stores:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured stores',
    });
  }
});

export default router;
