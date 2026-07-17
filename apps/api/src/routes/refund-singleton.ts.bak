/**
 * Refund API Routes - UniversalSingleton Implementation
 * Integrates RefundSingletonService with Express API
 */

import { Router } from 'express';
import RefundSingletonService from '../services/RefundSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const refundService = RefundSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Process a refund
 * POST /api/refund-singleton/process
 */
router.post('/process', async (req, res) => {
  try {
    const { orderId, paymentId, tenantId, reason, initiatedBy } = req.body;
    
    // Validate required fields
    if (!orderId || !paymentId || !tenantId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'orderId, paymentId, tenantId, and reason are required'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const result = await refundService.processRefund({
      orderId,
      paymentId,
      tenantId,
      reason,
      initiatedBy
    });
    
    res.json({
      success: true,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: 'Refund processed successfully'
    });
  } catch (error) {
    console.error('[REFUND SINGLETON] Process refund error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: (error as Error).message
    });
  }
});

/**
 * Get refund by ID
 * GET /api/refund-singleton/refund/:refundId
 */
router.get('/refund/:refundId', async (req, res) => {
  try {
    const { refundId } = req.params;
    
    // Get refund without tenant restriction (admin can view all)
    const refund = await refundService.getRefund(refundId);
    
    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund not found'
      });
    }

    // Check if user has permission to access this refund's tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(refund.tenant_id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this refund'
      });
    }
    
    res.json({
      success: true,
      data: {
        refund,
        timestamp: new Date().toISOString()
      },
      message: 'Refund retrieved successfully'
    });
  } catch (error) {
    console.error('[REFUND SINGLETON] Get refund error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve refund'
    });
  }
});

/**
 * Get refunds for tenant
 * GET /api/refund-singleton/tenant/:tenantId
 */
router.get('/tenant/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { status, limit } = req.query;
    
    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const refunds = await refundService.getTenantRefunds(
      tenantId,
      status as string,
      limit ? parseInt(limit as string) : 50
    );
    
    res.json({
      success: true,
      data: {
        refunds,
        count: refunds.length,
        timestamp: new Date().toISOString()
      },
      message: 'Tenant refunds retrieved successfully'
    });
  } catch (error) {
    console.error('[REFUND SINGLETON] Get tenant refunds error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tenant refunds'
    });
  }
});

/**
 * Get refund statistics
 * GET /api/refund-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // Check if user has admin permissions for viewing stats
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for viewing refund statistics'
      });
    }

    // Validate tenantId if provided
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await refundService.getRefundStats(tenantId as string);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Refund statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[REFUND SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch refund statistics'
    });
  }
});

/**
 * Get service health status
 * GET /api/refund-singleton/health
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
    
    const health = await refundService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      },
      message: 'Refund service health status retrieved successfully'
    });
  } catch (error) {
    console.error('[REFUND SINGLETON] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

/**
 * Clear cache and reset state
 * DELETE /api/refund-singleton/cache
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
    
    await refundService.clearCache();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: 'Refund service cache cleared successfully'
    });
  } catch (error) {
    console.error('[REFUND SINGLETON] Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * Test refund processing (for development/testing)
 * POST /api/refund-singleton/test
 */
router.post('/test', async (req, res) => {
  try {
    const { orderId, paymentId, tenantId, reason } = req.body;
    
    // Check if user has admin permissions for testing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for testing'
      });
    }

    // Validate tenantId if provided
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    // Test with sample data
    const testRequest = {
      orderId: orderId || 'test-order-123',
      paymentId: paymentId || 'test-payment-456',
      tenantId: tenantId || 'tid-m8ijkrnk',
      reason: reason || 'Test refund processing',
      initiatedBy: 'test-user'
    };
    
    const result = await refundService.processRefund(testRequest);
    
    res.json({
      success: true,
      data: {
        testRequest,
        result,
        timestamp: new Date().toISOString()
      },
      message: 'Test refund processed successfully'
    });
  } catch (error) {
    console.error('[REFUND SINGLETON] Test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test refund processing',
      error: (error as Error).message
    });
  }
});

/**
 * Get supported payment gateways
 * GET /api/refund-singleton/gateways
 */
router.get('/gateways', async (req, res) => {
  try {
    const gateways = [
      {
        name: 'paypal',
        displayName: 'PayPal',
        description: 'PayPal payment gateway with comprehensive refund support',
        features: ['instant_refunds', 'batch_processing', 'webhook_notifications'],
        performance: 'fast',
        supportedOperations: ['full_refund', 'partial_refund']
      },
      {
        name: 'stripe',
        displayName: 'Stripe',
        description: 'Stripe payment gateway with robust refund capabilities',
        features: ['full_refund', 'partial_refund', 'dispute_management'],
        performance: 'medium',
        supportedOperations: ['full_refund', 'partial_refund']
      },
      {
        name: 'square',
        displayName: 'Square',
        description: 'Square payment gateway with POS integration',
        features: ['pos_refunds', 'batch_processing', 'inventory_integration'],
        performance: 'slow',
        supportedOperations: ['full_refund']
      }
    ];
    
    res.json({
      success: true,
      data: {
        gateways,
        timestamp: new Date().toISOString()
      },
      message: 'Supported payment gateways retrieved successfully'
    });
  } catch (error) {
    console.error('[REFUND SINGLETON] Gateways error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported gateways'
    });
  }
});

export default router;
