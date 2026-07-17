import { Router, Request, Response } from 'express';
import { storeTypeDirectoryService } from '../services/store-type-directory.service';

const router = Router();

// Debug middleware to log all requests to this router
router.use((req, res, next) => {
  console.log(`[STORE-TYPES-ROUTER] ${req.method} ${req.path} - Original URL: ${req.originalUrl}`);
  next();
});

/**
 * GET /api/directory/store-types
 * 
 * Get all store types available in the directory
 * Only includes types from published directory listings
 * 
 * Query params:
 * - lat: Latitude for location filtering (optional)
 * - lng: Longitude for location filtering (optional)
 * - radius: Maximum distance in miles (optional, default: 25)
 */
router.get('/', async (req: Request, res: Response) => {
  console.log('[STORE-TYPES] GET / route hit - fetching store types');
  try {
    const { lat, lng, radius } = req.query;
    console.log('[STORE-TYPES] Query params:', { lat, lng, radius });

    // Parse location parameters if provided
    const location =
      lat && lng
        ? {
            lat: parseFloat(lat as string),
            lng: parseFloat(lng as string),
          }
        : undefined;

    const radiusMiles = radius ? parseFloat(radius as string) : 25;
    console.log('[STORE-TYPES] Parsed params:', { location, radiusMiles });

    // Get store types
    console.log('[STORE-TYPES] About to call getStoreTypes...');
    const storeTypes = await storeTypeDirectoryService.getStoreTypes(
      location,
      radiusMiles
    );
    console.log('[STORE-TYPES] Got store types:', storeTypes?.length || 0);

    res.json({
      success: true,
      data: {
        storeTypes,
        totalCount: storeTypes.length,
      },
    });
  } catch (error: any) {
    console.error('[STORE-TYPES] Error fetching store types:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_store_types',
      message: error?.message,
    });
  }
});

/**
 * GET /api/directory/store-type-counts
 * 
 * Get store type counts for all store types
 * Returns a mapping of store type slug to store count
 */
router.get('/store-type-counts', async (req: Request, res: Response) => {
  try {
    // Get store types with counts
    const storeTypes = await storeTypeDirectoryService.getStoreTypes();

    // Convert to simple mapping of slug -> count
    const storeTypeCounts: Record<string, number> = {};
    storeTypes.forEach(storeType => {
      storeTypeCounts[storeType.slug] = storeType.storeCount;
    });

    res.json({
      success: true,
      data: {
        storeTypeCounts,
      },
    });
  } catch (error) {
    console.error('Error fetching store type counts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store type counts',
    });
  }
});

/**
 * GET /api/directory/store-types/:typeSlug
 * 
 * Get details for a specific store type
 * 
 * Path params:
 * - typeSlug: Store type slug (e.g., "electronics-store", "clothing-store")
 */
router.get('/:typeSlug', async (req: Request, res: Response) => {
  try {
    const { typeSlug } = req.params;

    const storeType = await storeTypeDirectoryService.getStoreTypeDetails(typeSlug);

    // If store type not found, return empty result instead of 404
    // This allows the frontend to handle zero-store categories gracefully
    if (!storeType) {
      return res.json({
        success: true,
        data: { 
          storeType: {
            id: typeSlug,
            name: typeSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            slug: typeSlug,
            storeCount: 0,
            totalProducts: 0,
            avgRating: 0,
            uniqueLocations: 0,
            cities: [],
            states: [],
            featuredStoreCount: 0,
            syncedStoreCount: 0,
            firstStoreAdded: null,
            lastStoreUpdated: null,
          }
        },
      });
    }

    res.json({
      success: true,
      data: { storeType },
    });
  } catch (error) {
    console.error('Error fetching store type details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store type details',
    });
  }
});

/**
 * GET /api/directory/store-types/:typeSlug/stores
 * 
 * Get stores of a specific type
 * Only includes verified stores (in directory_listings)
 * 
 * Path params:
 * - typeSlug: Store type slug (e.g., "electronics-store")
 * 
 * Query params:
 * - lat: Latitude for distance calculation (optional)
 * - lng: Longitude for distance calculation (optional)
 * - radius: Maximum distance in miles (optional, default: 25)
 * - limit: Maximum number of stores to return (optional, default: 50)
 */
router.get(
  '/:typeSlug/stores',
  async (req: Request, res: Response) => {
    try {
      const { typeSlug } = req.params;
      const { lat, lng, radius, limit } = req.query;

      //console.log(`[API] Fetching stores for store type: ${typeSlug}`);

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

      // Get stores by type
      const stores = await storeTypeDirectoryService.getStoresByType(
        typeSlug,
        location,
        radiusMiles
      );

      // Limit results
      const limitedStores = stores.slice(0, maxStores);

      res.json({
        success: true,
        data: {
          storeType: typeSlug,
          stores: limitedStores,
          totalCount: stores.length,
          returnedCount: limitedStores.length,
          location: location || null,
          radius: radiusMiles,
        },
      });
    } catch (error) {
      console.error('Error fetching stores by type:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch stores by type',
      });
    }
  }
);

export default router;
