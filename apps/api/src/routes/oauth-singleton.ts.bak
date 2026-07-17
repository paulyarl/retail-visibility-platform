/**
 * OAuth API Routes - UniversalSingleton Implementation
 * Integrates OAuthSingletonService with Express API for PayPal and Square OAuth
 */

import { Router } from 'express';
import OAuthSingletonService from '../services/OAuthSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const oauthService = OAuthSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// ====================
// PAYPAL OAUTH ROUTES
// ====================

/**
 * Get PayPal authorization URL
 * GET /api/oauth-singleton/paypal/authorize
 */
router.get('/paypal/authorize', async (req, res) => {
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
    
    const authUrl = await oauthService.getPayPalAuthorizationUrl(
      tenantId as string,
      state as string
    );
    
    res.json({
      success: true,
      data: {
        authUrl,
        provider: 'paypal',
        timestamp: new Date().toISOString()
      },
      message: 'PayPal authorization URL generated successfully'
    });
  } catch (error) {
    console.error('[OAUTH SINGLETON] PayPal authorize error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PayPal authorization URL',
      error: (error as Error).message
    });
  }
});

/**
 * Handle PayPal OAuth callback
 * POST /api/oauth-singleton/paypal/callback
 */
router.post('/paypal/callback', async (req, res) => {
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
    
    const result = await oauthService.handlePayPalCallback(code, state, tenantId);
    
    res.json({
      success: true,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: 'PayPal OAuth callback processed successfully'
    });
  } catch (error) {
    console.error('[OAUTH SINGLETON] PayPal callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process PayPal OAuth callback',
      error: (error as Error).message
    });
  }
});

/**
 * Refresh PayPal tokens
 * POST /api/oauth-singleton/paypal/refresh
 */
router.post('/paypal/refresh', async (req, res) => {
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
    
    const tokens = await oauthService.refreshPayPalTokens(tenantId);
    
    res.json({
      success: true,
      data: {
        tokens,
        timestamp: new Date().toISOString()
      },
      message: 'PayPal tokens refreshed successfully'
    });
  } catch (error) {
    console.error('[OAUTH SINGLETON] PayPal refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh PayPal tokens',
      error: (error as Error).message
    });
  }
});

// ====================
// SQUARE OAUTH ROUTES
// ====================

/**
 * Get Square authorization URL
 * GET /api/oauth-singleton/square/authorize
 */
router.get('/square/authorize', async (req, res) => {
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
    
    const authUrl = await oauthService.getSquareAuthorizationUrl(
      tenantId as string,
      state as string
    );
    
    res.json({
      success: true,
      data: {
        authUrl,
        provider: 'square',
        timestamp: new Date().toISOString()
      },
      message: 'Square authorization URL generated successfully'
    });
  } catch (error) {
    console.error('[OAUTH SINGLETON] Square authorize error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate Square authorization URL',
      error: (error as Error).message
    });
  }
});

/**
 * Handle Square OAuth callback
 * POST /api/oauth-singleton/square/callback
 */
router.post('/square/callback', async (req, res) => {
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
    
    const result = await oauthService.handleSquareCallback(code, state, tenantId);
    
    res.json({
      success: true,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: 'Square OAuth callback processed successfully'
    });
  } catch (error) {
    console.error('[OAUTH SINGLETON] Square callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process Square OAuth callback',
      error: (error as Error).message
    });
  }
});

/**
 * Refresh Square tokens
 * POST /api/oauth-singleton/square/refresh
 */
router.post('/square/refresh', async (req, res) => {
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
    
    const tokens = await oauthService.refreshSquareTokens(tenantId);
    
    res.json({
      success: true,
      data: {
        tokens,
        timestamp: new Date().toISOString()
      },
      message: 'Square tokens refreshed successfully'
    });
  } catch (error) {
    console.error('[OAUTH SINGLETON] Square refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh Square tokens',
      error: (error as Error).message
    });
  }
});

// ====================
// COMMON OAUTH ROUTES
// ====================

/**
 * Get OAuth statistics
 * GET /api/oauth-singleton/stats
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
    
    const stats = await oauthService.getOAuthStats(tenantId as string);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'OAuth statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[OAUTH SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch OAuth statistics'
    });
  }
});

/**
 * Get service health status
 * GET /api/oauth-singleton/health
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
    
    const health = await oauthService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      },
      message: 'OAuth service health status retrieved successfully'
    });
  } catch (error) {
    console.error('[OAUTH SINGLETON] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

/**
 * Clear cache and reset state
 * DELETE /api/oauth-singleton/cache
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
    
    await oauthService.clearCache();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: 'OAuth service cache cleared successfully'
    });
  } catch (error) {
    console.error('[OAUTH SINGLETON] Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * Test OAuth operations (for development/testing)
 * POST /api/oauth-singleton/test
 */
router.post('/test', async (req, res) => {
  try {
    const { provider, operation, tenantId } = req.body;
    
    // Check if user has admin permissions for testing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for testing'
      });
    }

    // Validate provider
    if (!provider || !['paypal', 'square'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'provider must be one of: paypal, square'
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
        if (provider === 'paypal') {
          result = await oauthService.getPayPalAuthorizationUrl(testTenantId, 'test-state');
        } else {
          result = await oauthService.getSquareAuthorizationUrl(testTenantId, 'test-state');
        }
        break;
      case 'callback':
        if (provider === 'paypal') {
          result = await oauthService.handlePayPalCallback('test-code', 'test-state', testTenantId);
        } else {
          result = await oauthService.handleSquareCallback('test-code', 'test-state', testTenantId);
        }
        break;
      case 'refresh':
        if (provider === 'paypal') {
          result = await oauthService.refreshPayPalTokens(testTenantId);
        } else {
          result = await oauthService.refreshSquareTokens(testTenantId);
        }
        break;
    }
    
    res.json({
      success: true,
      data: {
        provider,
        operation,
        result,
        timestamp: new Date().toISOString()
      },
      message: `OAuth test (${provider} ${operation}) completed successfully`
    });
  } catch (error) {
    console.error('[OAUTH SINGLETON] Test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test OAuth operation',
      error: (error as Error).message
    });
  }
});

/**
 * Get supported OAuth providers
 * GET /api/oauth-singleton/providers
 */
router.get('/providers', async (req, res) => {
  try {
    const providers = [
      {
        name: 'paypal',
        displayName: 'PayPal',
        description: 'PayPal OAuth integration for payment processing and refunds',
        features: ['payment_processing', 'refund_handling', 'token_refresh', 'secure_storage'],
        supportedOperations: ['authorize', 'callback', 'refresh'],
        scopes: ['openid', 'email', 'https://uri.paypal.com/services/payments/refund'],
        environment: 'sandbox'
      },
      {
        name: 'square',
        displayName: 'Square',
        description: 'Square OAuth integration for POS and payment processing',
        features: ['payment_processing', 'order_management', 'token_refresh', 'secure_storage'],
        supportedOperations: ['authorize', 'callback', 'refresh'],
        scopes: ['PAYMENTS_READ', 'PAYMENTS_WRITE', 'ORDERS_READ', 'ORDERS_WRITE'],
        environment: 'sandbox'
      }
    ];
    
    res.json({
      success: true,
      data: {
        providers,
        timestamp: new Date().toISOString()
      },
      message: 'Supported OAuth providers retrieved successfully'
    });
  } catch (error) {
    console.error('[OAUTH SINGLETON] Providers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported providers'
    });
  }
});

export default router;
