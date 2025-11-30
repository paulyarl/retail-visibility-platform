/**
 * Recommendation API Routes
 * MVP Recommendation System
 */

import { Router, Request, Response } from 'express';
import {
  getStoresViewedBySameUsers,
  getPopularStoresInCategory,
  getTrendingNearby,
  trackUserBehavior,
  getProductsViewedBySameUsers,
  getStoresInUserFavoriteCategories
} from '../services/recommendationService';

const router = Router();

/**
 * POST /api/recommendations/track
 * Track user behavior for recommendations
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      sessionId,
      entityType = 'store',
      entityId,
      locationLat,
      locationLng,
      referrer,
      userAgent,
      ipAddress
    } = req.body;

    if (!entityId) {
      return res.status(400).json({
        error: 'entity_id_required',
        message: 'Entity ID is required for tracking'
      });
    }

    await trackUserBehavior({
      userId,
      sessionId,
      entityType,
      entityId,
      locationLat,
      locationLng,
      referrer,
      userAgent,
      ipAddress
    });

    res.json({ success: true, tracked: true });

  } catch (error) {
    console.error('Error tracking behavior:', error);
    res.status(500).json({
      error: 'tracking_failed',
      message: 'Failed to track user behavior'
    });
  }
});

/**
 * GET /api/recommendations/stores-like-this/:storeId
 * Get stores viewed by users who also viewed this store
 */
router.get('/stores-like-this/:storeId', async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;
    const { userId } = req.query;
    const { limit = 3 } = req.query;

    const result = await getStoresViewedBySameUsers(
      storeId,
      userId as string,
      Math.min(Math.max(Number(limit), 1), 10)
    );

    res.json(result);

  } catch (error) {
    console.error('Error getting stores like this:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get store recommendations'
    });
  }
});

/**
 * GET /api/recommendations/popular-in-category/:categorySlug
 * Get popular stores in the same category
 */
router.get('/popular-in-category/:categorySlug', async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    const { lat, lng, limit = 3 } = req.query;

    const result = await getPopularStoresInCategory(
      categorySlug,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
      Math.min(Math.max(Number(limit), 1), 10)
    );

    res.json(result);

  } catch (error) {
    console.error('Error getting popular stores in category:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get category recommendations'
    });
  }
});

/**
 * GET /api/recommendations/trending-nearby
 * Get trending stores near user location
 */
router.get('/trending-nearby', async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 25, days = 7, limit = 3 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'location_required',
        message: 'Latitude and longitude are required for nearby recommendations'
      });
    }

    const result = await getTrendingNearby(
      Number(lat),
      Number(lng),
      Math.min(Math.max(Number(radius), 1), 100), // 1-100 mile radius
      Math.min(Math.max(Number(days), 1), 30), // 1-30 days
      Math.min(Math.max(Number(limit), 1), 10) // 1-10 results
    );

    res.json(result);

  } catch (error) {
    console.error('Error getting trending nearby:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get nearby recommendations'
    });
  }
});

/**
 * GET /api/recommendations/products-like-this/:productId
 * Get products viewed by users who also viewed this product
 */
router.get('/products-like-this/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { userId } = req.query;
    const { limit = 3 } = req.query;

    const result = await getProductsViewedBySameUsers(
      productId,
      userId as string,
      Math.min(Math.max(Number(limit), 1), 10)
    );

    res.json(result);

  } catch (error) {
    console.error('Error getting products like this:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get product recommendations'
    });
  }
});

/**
 * GET /api/recommendations/stores-for-user
 * Get stores in user's favorite categories
 */
router.get('/stores-for-user', async (req: Request, res: Response) => {
  try {
    const { userId, lat, lng, limit = 3 } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: 'user_id_required',
        message: 'User ID is required for personalized recommendations'
      });
    }

    const result = await getStoresInUserFavoriteCategories(
      userId as string,
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
      Math.min(Math.max(Number(limit), 1), 10)
    );

    res.json(result);

  } catch (error) {
    console.error('Error getting stores for user:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get user recommendations'
    });
  }
});

/**
 * GET /api/recommendations/for-product/:productId
 * Get all recommendations for a product page
 */
router.get('/for-product/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { userId, lat, lng, tenantId, categorySlug } = req.query;

    const recommendations = [];

    // 1. Products like this (always included)
    const productsLikeThis = await getProductsViewedBySameUsers(
      productId,
      userId as string,
      3
    );
    if (productsLikeThis.recommendations.length > 0) {
      recommendations.push({
        type: 'products_like_this',
        title: 'Products Like This You Viewed',
        ...productsLikeThis
      });
    }

    // 2. Popular in category (if category provided)
    if (categorySlug) {
      const popularInCategory = await getPopularStoresInCategory(
        categorySlug as string,
        lat ? Number(lat) : undefined,
        lng ? Number(lng) : undefined,
        3
      );
      if (popularInCategory.recommendations.length > 0) {
        recommendations.push({
          type: 'popular_in_category',
          title: `Popular ${(categorySlug as string).replace('-', ' ')}`,
          ...popularInCategory
        });
      }
    }

    // 3. Trending nearby (if location provided)
    if (lat && lng) {
      const trendingNearby = await getTrendingNearby(
        Number(lat),
        Number(lng),
        25,
        7,
        3
      );
      if (trendingNearby.recommendations.length > 0) {
        recommendations.push({
          type: 'trending_nearby',
          title: 'Trending Nearby',
          ...trendingNearby
        });
      }
    }

    res.json({
      recommendations,
      productId,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Error getting recommendations for product:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get product recommendations'
    });
  }
});

/**
 * GET /api/recommendations/for-storefront/:tenantId
 * Get recommendations for storefront pages
 */
router.get('/for-storefront/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { userId, lat, lng } = req.query;

    const recommendations = [];

    // 1. Stores like this (same user behavior pattern)
    const storesLikeThis = await getStoresViewedBySameUsers(
      tenantId,
      userId as string,
      3
    );
    if (storesLikeThis.recommendations.length > 0) {
      recommendations.push({
        type: 'stores_like_this',
        title: 'Stores Like This You Viewed',
        ...storesLikeThis
      });
    }

    // 2. User favorite categories (if userId provided)
    if (userId) {
      const userFavorites = await getStoresInUserFavoriteCategories(
        userId as string,
        lat ? Number(lat) : undefined,
        lng ? Number(lng) : undefined,
        3
      );
      if (userFavorites.recommendations.length > 0) {
        recommendations.push({
          type: 'user_favorite_categories',
          title: 'Based on Your Interests',
          ...userFavorites
        });
      }
    }

    // 3. Trending nearby (if location provided)
    if (lat && lng) {
      const trendingNearby = await getTrendingNearby(
        Number(lat),
        Number(lng),
        25,
        7,
        3
      );
      if (trendingNearby.recommendations.length > 0) {
        recommendations.push({
          type: 'trending_nearby',
          title: 'Trending Nearby',
          ...trendingNearby
        });
      }
    }

    res.json({
      recommendations,
      tenantId,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Error getting recommendations for storefront:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get storefront recommendations'
    });
  }
});

/**
 * GET /api/recommendations/for-directory
 * Get recommendations for directory home page
 */
router.get('/for-directory', async (req: Request, res: Response) => {
  try {
    const { userId, lat, lng, categorySlug } = req.query;

    const recommendations = [];

    // 1. User favorite categories (if userId provided)
    if (userId) {
      const userFavorites = await getStoresInUserFavoriteCategories(
        userId as string,
        lat ? Number(lat) : undefined,
        lng ? Number(lng) : undefined,
        5
      );
      if (userFavorites.recommendations.length > 0) {
        recommendations.push({
          type: 'user_favorite_categories',
          title: 'Recommended For You',
          ...userFavorites
        });
      }
    }

    // 2. Popular in category (if category provided)
    if (categorySlug) {
      const popularInCategory = await getPopularStoresInCategory(
        categorySlug as string,
        lat ? Number(lat) : undefined,
        lng ? Number(lng) : undefined,
        5
      );
      if (popularInCategory.recommendations.length > 0) {
        recommendations.push({
          type: 'popular_in_category',
          title: `Popular ${(categorySlug as string).replace('-', ' ')}`,
          ...popularInCategory
        });
      }
    }

    // 3. Trending nearby (if location provided)
    if (lat && lng) {
      const trendingNearby = await getTrendingNearby(
        Number(lat),
        Number(lng),
        25,
        7,
        5
      );
      if (trendingNearby.recommendations.length > 0) {
        recommendations.push({
          type: 'trending_nearby',
          title: 'Trending Nearby',
          ...trendingNearby
        });
      }
    }

    res.json({
      recommendations,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Error getting recommendations for directory:', error);
    res.status(500).json({
      error: 'recommendation_failed',
      message: 'Failed to get directory recommendations'
    });
  }
});

export default router;
