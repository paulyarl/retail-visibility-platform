/**
 * Recommendation API Routes - UniversalSingleton Implementation
 * Integrates RecommendationSingletonService with Express API
 */

import { Router } from 'express';
import RecommendationSingletonService from '../services/RecommendationSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const recommendationService = RecommendationSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Get "Stores Like This You Viewed" recommendations
 * POST /api/recommendation-singleton/same-users
 */
router.post('/same-users', async (req, res) => {
  try {
    const { storeId, userId, limit } = req.body;
    
    // Validate required fields
    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'storeId is required'
      });
    }

    // Validate limit
    if (limit && (limit < 1 || limit > 10)) {
      return res.status(400).json({
        success: false,
        message: 'limit must be between 1 and 10'
      });
    }
    
    const response = await recommendationService.getStoresViewedBySameUsers(
      storeId,
      userId,
      limit || 3
    );
    
    res.json({
      success: true,
      data: {
        response,
        timestamp: new Date().toISOString()
      },
      message: 'Same users recommendations retrieved successfully'
    });
  } catch (error) {
    console.error('[RECOMMENDATION SINGLETON] Same users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get same users recommendations',
      error: (error as Error).message
    });
  }
});

/**
 * Get "Similar Stores in Your Area" recommendations
 * POST /api/recommendation-singleton/similar-area
 */
router.post('/similar-area', async (req, res) => {
  try {
    const { tenantId, latitude, longitude, radius, limit } = req.body;
    
    // Validate required fields
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'tenantId is required'
      });
    }

    // Validate coordinates if provided
    if (latitude && (latitude < -90 || latitude > 90)) {
      return res.status(400).json({
        success: false,
        message: 'latitude must be between -90 and 90'
      });
    }

    if (longitude && (longitude < -180 || longitude > 180)) {
      return res.status(400).json({
        success: false,
        message: 'longitude must be between -180 and 180'
      });
    }

    // Validate radius
    if (radius && (radius < 1 || radius > 100)) {
      return res.status(400).json({
        success: false,
        message: 'radius must be between 1 and 100 miles'
      });
    }

    // Validate limit
    if (limit && (limit < 1 || limit > 10)) {
      return res.status(400).json({
        success: false,
        message: 'limit must be between 1 and 10'
      });
    }
    
    const response = await recommendationService.getSimilarStoresInArea(
      tenantId,
      latitude,
      longitude,
      radius || 25,
      limit || 3
    );
    
    res.json({
      success: true,
      data: {
        response,
        timestamp: new Date().toISOString()
      },
      message: 'Similar area recommendations retrieved successfully'
    });
  } catch (error) {
    console.error('[RECOMMENDATION SINGLETON] Similar area error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get similar area recommendations',
      error: (error as Error).message
    });
  }
});

/**
 * Get "Trending Stores" recommendations
 * POST /api/recommendation-singleton/trending
 */
router.post('/trending', async (req, res) => {
  try {
    const { tenantId, category, timeWindow, limit } = req.body;
    
    // Validate timeWindow
    if (timeWindow && (timeWindow < 1 || timeWindow > 30)) {
      return res.status(400).json({
        success: false,
        message: 'timeWindow must be between 1 and 30 days'
      });
    }

    // Validate limit
    if (limit && (limit < 1 || limit > 10)) {
      return res.status(400).json({
        success: false,
        message: 'limit must be between 1 and 10'
      });
    }
    
    const response = await recommendationService.getTrendingStores(
      tenantId,
      category,
      timeWindow || 7,
      limit || 3
    );
    
    res.json({
      success: true,
      data: {
        response,
        timestamp: new Date().toISOString()
      },
      message: 'Trending recommendations retrieved successfully'
    });
  } catch (error) {
    console.error('[RECOMMENDATION SINGLETON] Trending error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending recommendations',
      error: (error as Error).message
    });
  }
});

/**
 * Get personalized recommendations
 * POST /api/recommendation-singleton/personalized
 */
router.post('/personalized', async (req, res) => {
  try {
    const { userId, tenantId, limit } = req.body;
    
    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    // Validate limit
    if (limit && (limit < 1 || limit > 10)) {
      return res.status(400).json({
        success: false,
        message: 'limit must be between 1 and 10'
      });
    }
    
    const response = await recommendationService.getPersonalizedRecommendations(
      userId,
      tenantId,
      limit || 5
    );
    
    res.json({
      success: true,
      data: {
        response,
        timestamp: new Date().toISOString()
      },
      message: 'Personalized recommendations retrieved successfully'
    });
  } catch (error) {
    console.error('[RECOMMENDATION SINGLETON] Personalized error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get personalized recommendations',
      error: (error as Error).message
    });
  }
});

/**
 * Get recommendation statistics
 * GET /api/recommendation-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // Check if user has admin permissions for viewing stats
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for viewing recommendation statistics'
      });
    }

    // Validate tenantId if provided
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await recommendationService.getRecommendationStats(tenantId as string);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Recommendation statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[RECOMMENDATION SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendation statistics'
    });
  }
});

/**
 * Get service health status
 * GET /api/recommendation-singleton/health
 */
router.get('/health', async (req, res) => {
  try {
    // Check if user has admin permissions for health check
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for health check'
      });
    }
    
    const health = await recommendationService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      },
      message: 'Recommendation service health status retrieved successfully'
    });
  } catch (error) {
    console.error('[RECOMMENDATION SINGLETON] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

/**
 * Clear cache
 * DELETE /api/recommendation-singleton/cache
 */
router.delete('/cache', async (req, res) => {
  try {
    // Check if user has admin permissions for cache clearing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for cache clearing'
      });
    }
    
    await recommendationService.clearCache();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: 'Recommendation cache cleared successfully'
    });
  } catch (error) {
    console.error('[RECOMMENDATION SINGLETON] Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * Test recommendation generation (for development/testing)
 * POST /api/recommendation-singleton/test
 */
router.post('/test', async (req, res) => {
  try {
    const { type, storeId, userId, tenantId } = req.body;
    
    // Check if user has admin permissions for testing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for testing'
      });
    }

    // Validate type
    if (!type || !['same-users', 'similar-area', 'trending', 'personalized'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type must be one of: same-users, similar-area, trending, personalized'
      });
    }
    
    let response;
    
    switch (type) {
      case 'same-users':
        response = await recommendationService.getStoresViewedBySameUsers(
          storeId || 'test-store-123',
          userId,
          3
        );
        break;
      case 'similar-area':
        response = await recommendationService.getSimilarStoresInArea(
          tenantId || 'tid-m8ijkrnk',
          40.7128,
          -74.0060,
          25,
          3
        );
        break;
      case 'trending':
        response = await recommendationService.getTrendingStores(
          tenantId,
          undefined,
          7,
          3
        );
        break;
      case 'personalized':
        response = await recommendationService.getPersonalizedRecommendations(
          userId || 'test-user-123',
          tenantId,
          5
        );
        break;
    }
    
    res.json({
      success: true,
      data: {
        testType: type,
        response,
        timestamp: new Date().toISOString()
      },
      message: `Test recommendation (${type}) completed successfully`
    });
  } catch (error) {
    console.error('[RECOMMENDATION SINGLETON] Test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test recommendation generation',
      error: (error as Error).message
    });
  }
});

/**
 * Get supported algorithms
 * GET /api/recommendation-singleton/algorithms
 */
router.get('/algorithms', async (req, res) => {
  try {
    const algorithms = [
      {
        name: 'collaborative_filtering',
        displayName: 'Collaborative Filtering',
        description: 'Users who viewed this store also viewed these stores',
        type: 'same-users',
        features: ['user_behavior', 'view_history', 'similarity_scoring'],
        performance: 'high'
      },
      {
        name: 'geographic_similarity',
        displayName: 'Geographic Similarity',
        description: 'Similar stores in your area based on location',
        type: 'similar-area',
        features: ['location_based', 'distance_calculation', 'regional_analysis'],
        performance: 'medium'
      },
      {
        name: 'trending_analysis',
        displayName: 'Trending Analysis',
        description: 'Popular stores based on recent activity',
        type: 'trending',
        features: ['time_series', 'popularity_scoring', 'trend_detection'],
        performance: 'high'
      },
      {
        name: 'personalized_ml',
        displayName: 'Personalized ML',
        description: 'Machine learning recommendations based on user preferences',
        type: 'personalized',
        features: ['machine_learning', 'user_profiling', 'preference_learning'],
        performance: 'very_high'
      }
    ];
    
    res.json({
      success: true,
      data: {
        algorithms,
        timestamp: new Date().toISOString()
      },
      message: 'Supported algorithms retrieved successfully'
    });
  } catch (error) {
    console.error('[RECOMMENDATION SINGLETON] Algorithms error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported algorithms'
    });
  }
});

export default router;
