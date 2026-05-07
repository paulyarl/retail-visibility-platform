/**
 * Clover OAuth API Routes - UniversalSingleton Implementation
 * Integrates CloverOAuthSingletonService with Express API
 */

import { Router } from 'express';
import CloverOAuthSingletonService from '../services/CloverOAuthSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const cloverOAuthService = CloverOAuthSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Generate Clover authorization URL
 * GET /api/clover-oauth-singleton/authorize
 */
router.get('/authorize', async (req, res) => {
  try {
    const { tenantId, state } = req.query;
    
    // Validate required fields
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'tenantId is required'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const authUrl = await cloverOAuthService.generateAuthorizationUrl(
      tenantId as string,
      state as string
    );
    
    res.json({
      success: true,
      data: {
        authUrl,
        provider: 'clover',
        timestamp: new Date().toISOString()
      },
      message: 'Clover authorization URL generated successfully'
    });
  } catch (error) {
    console.error('[CLOVER OAUTH SINGLETON] Authorize error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Clover authorization URL',
      error: (error as Error).message
    });
  }
});

/**
 * Handle Clover OAuth callback
 * POST /api/clover-oauth-singleton/callback
 */
router.post('/callback', async (req, res) => {
  try {
    const { code, state, tenantId } = req.body;
    
    // Validate required fields
    if (!code || !state || !tenantId) {
      return res.status(400).json({
        success: false,
        message: 'code, state, and tenantId are required'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const result = await cloverOAuthService.handleOAuthCallback(code, state, tenantId);
    
    res.json({
      success: true,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: 'Clover OAuth callback processed successfully'
    });
  } catch (error) {
    console.error('[CLOVER OAUTH SINGLETON] Callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process Clover OAuth callback',
      error: (error as Error).message
    });
  }
});

/**
 * Refresh Clover tokens
 * POST /api/clover-oauth-singleton/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    // Validate required fields
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'tenantId is required'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const tokens = await cloverOAuthService.refreshToken(tenantId);
    
    res.json({
      success: true,
      data: {
        tokens,
        timestamp: new Date().toISOString()
      },
      message: 'Clover tokens refreshed successfully'
    });
  } catch (error) {
    console.error('[CLOVER OAUTH SINGLETON] Refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh Clover tokens',
      error: (error as Error).message
    });
  }
});

/**
 * Get OAuth statistics
 * GET /api/clover-oauth-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // Check if user has admin permissions for viewing stats
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for viewing OAuth statistics'
      });
    }

    // Validate tenantId if provided
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await cloverOAuthService.getOAuthStats(tenantId as string);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Clover OAuth statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[CLOVER OAUTH SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch OAuth statistics'
    });
  }
});

/**
 * Get service health status
 * GET /api/clover-oauth-singleton/health
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
    
    const health = await cloverOAuthService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      },
      message: 'Clover OAuth service health status retrieved successfully'
    });
  } catch (error) {
    console.error('[CLOVER OAUTH SINGLETON] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

/**
 * Clear cache and reset state
 * DELETE /api/clover-oauth-singleton/cache
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
    
    await cloverOAuthService.clearCache();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: 'Clover OAuth service cache cleared successfully'
    });
  } catch (error) {
    console.error('[CLOVER OAUTH SINGLETON] Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * Test Clover OAuth operations (for development/testing)
 * POST /api/clover-oauth-singleton/test
 */
router.post('/test', async (req, res) => {
  try {
    const { operation, tenantId } = req.body;
    
    // Check if user has admin permissions for testing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for testing'
      });
    }

    // Validate operation
    if (!operation || !['authorize', 'callback', 'refresh'].includes(operation)) {
      return res.status(400).json({
        success: false,
        message: 'operation must be one of: authorize, callback, refresh'
      });
    }

    // Validate tenantId if provided
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const testTenantId = tenantId || 'tid-m8ijkrnk';
    let result;
    
    switch (operation) {
      case 'authorize':
        result = await cloverOAuthService.generateAuthorizationUrl(testTenantId, 'test-state');
        break;
      case 'callback':
        result = await cloverOAuthService.handleOAuthCallback('test-code', 'test-state', testTenantId);
        break;
      case 'refresh':
        result = await cloverOAuthService.refreshToken(testTenantId);
        break;
    }
    
    res.json({
      success: true,
      data: {
        operation,
        result,
        timestamp: new Date().toISOString()
      },
      message: `Clover OAuth test (${operation}) completed successfully`
    });
  } catch (error) {
    console.error('[CLOVER OAUTH SINGLETON] Test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Clover OAuth operation',
      error: (error as Error).message
    });
  }
});

/**
 * Get supported OAuth scopes
 * GET /api/clover-oauth-singleton/scopes
 */
router.get('/scopes', async (req, res) => {
  try {
    const scopes = [
      {
        name: 'merchant_r',
        displayName: 'Merchant Read',
        description: 'Read merchant information',
        required: true,
        features: ['merchant_info', 'business_details', 'location_data']
      },
      {
        name: 'inventory_r',
        displayName: 'Inventory Read',
        description: 'Read inventory items and categories',
        required: true,
        features: ['product_info', 'pricing', 'stock_levels']
      },
      {
        name: 'inventory_w',
        displayName: 'Inventory Write',
        description: 'Write inventory items and categories',
        required: true,
        features: ['product_creation', 'inventory_management', 'price_updates']
      }
    ];
    
    res.json({
      success: true,
      data: {
        scopes,
        timestamp: new Date().toISOString()
      },
      message: 'Supported Clover OAuth scopes retrieved successfully'
    });
  } catch (error) {
    console.error('[CLOVER OAUTH SINGLETON] Scopes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported scopes'
    });
  }
});

export default router;
