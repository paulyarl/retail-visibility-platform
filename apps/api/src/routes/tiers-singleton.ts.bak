/**
 * Tiers API Routes - UniversalSingleton Implementation
 * Integrates TierService with Express API
 */

import { Router } from 'express';
import TierSingletonService from '../services/TierSingletonService';

const router = Router();

// Get singleton instance
const tierService = TierSingletonService.getInstance();

/**
 * Get tier statistics
 * GET /api/tiers-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    // Check if user has permission to view tier statistics
    if (!req.user?.role || !['admin', 'platform_admin', 'PLATFORM_ADMIN', 'support'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions'
      });
    }
    
    const stats = await tierService.getTierStats();
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Tier statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Tier statistics retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tier statistics',
      error: (error as Error).message
    });
  }
});

/**
 * Get tier by ID
 * GET /api/tiers-singleton/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const tier = await tierService.getTier(id);
    
    if (!tier) {
      return res.status(404).json({
        success: false,
        message: 'Tier not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        tier,
        timestamp: new Date().toISOString()
      },
      message: 'Tier retrieved successfully'
    });
  } catch (error) {
    console.error('Tier retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tier',
      error: (error as Error).message
    });
  }
});

/**
 * Get tier by slug
 * GET /api/tiers-singleton/slug/:slug
 */
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const tier = await tierService.getTierBySlug(slug);
    
    if (!tier) {
      return res.status(404).json({
        success: false,
        message: 'Tier not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        tier,
        timestamp: new Date().toISOString()
      },
      message: 'Tier retrieved successfully'
    });
  } catch (error) {
    console.error('Tier retrieval by slug failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tier',
      error: (error as Error).message
    });
  }
});

/**
 * Create new tier
 * POST /api/tiers-singleton
 */
router.post('/', async (req, res) => {
  try {
    // Check if user has permission to create tiers
    if (!req.user?.role || !['admin', 'platform_admin', 'PLATFORM_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions to create tiers'
      });
    }
    
    const tierData = req.body;
    
    const tier = await tierService.createTier(tierData);
    
    res.status(201).json({
      success: true,
      data: {
        tier,
        timestamp: new Date().toISOString()
      },
      message: 'Tier created successfully'
    });
  } catch (error) {
    console.error('Tier creation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create tier',
      error: (error as Error).message
    });
  }
});

/**
 * Update tier
 * PUT /api/tiers-singleton/:id
 */
router.put('/:id', async (req, res) => {
  try {
    // Check if user has permission to update tiers
    if (!req.user?.role || !['admin', 'platform_admin', 'PLATFORM_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions to update tier'
      });
    }
    
    const { id } = req.params;
    const updates = req.body;
    
    const tier = await tierService.updateTier(id, updates);
    
    res.json({
      success: true,
      data: {
        tier,
        timestamp: new Date().toISOString()
      },
      message: 'Tier updated successfully'
    });
  } catch (error) {
    console.error('Tier update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tier',
      error: (error as Error).message
    });
  }
});

/**
 * Delete tier
 * DELETE /api/tiers-singleton/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    // Check if user has permission to delete tiers
    if (!req.user?.role || !['admin', 'platform_admin', 'PLATFORM_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions to delete tier'
      });
    }
    
    const { id } = req.params;
    
    await tierService.deleteTier(id);
    
    res.json({
      success: true,
      data: {
        tierId: id,
        timestamp: new Date().toISOString()
      },
      message: 'Tier deleted successfully'
    });
  } catch (error) {
    console.error('Tier deletion failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete tier',
      error: (error as Error).message
    });
  }
});

/**
 * List all tiers
 * GET /api/tiers-singleton
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status as 'active' | 'inactive' | 'deprecated' | undefined,
      level: req.query.level ? parseInt(req.query.level as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };
    
    const tiers = await tierService.listTiers(filters);
    
    res.json({
      success: true,
      data: {
        tiers,
        count: tiers.length,
        timestamp: new Date().toISOString()
      },
      message: 'Tiers retrieved successfully'
    });
  } catch (error) {
    console.error('Tier listing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list tiers',
      error: (error as Error).message
    });
  }
});

/**
 * Check if tenant can upgrade to tier
 * GET /api/tiers-singleton/:tierId/can-upgrade/:tenantId
 */
router.get('/:tierId/can-upgrade/:tenantId', async (req, res) => {
  try {
    const { tierId, tenantId } = req.params;
    
    // Check if user has permission to check upgrades
    if (!req.user?.tenantIds?.includes(tenantId) && !['admin', 'platform_admin', 'support'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions'
      });
    }
    
    const result = await tierService.canUpgradeToTier(tenantId, tierId);
    
    res.json({
      success: true,
      data: {
        ...result,
        timestamp: new Date().toISOString()
      },
      message: 'Upgrade eligibility check completed'
    });
  } catch (error) {
    console.error('Upgrade eligibility check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check upgrade eligibility',
      error: (error as Error).message
    });
  }
});

/**
 * Get tier limits
 * GET /api/tiers-singleton/:tierId/limits
 */
router.get('/:tierId/limits', async (req, res) => {
  try {
    const { tierId } = req.params;
    
    const limits = await tierService.getTierLimits(tierId);
    
    if (!limits) {
      return res.status(404).json({
        success: false,
        message: 'Tier not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        tierId,
        limits,
        timestamp: new Date().toISOString()
      },
      message: 'Tier limits retrieved successfully'
    });
  } catch (error) {
    console.error('Tier limits retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tier limits',
      error: (error as Error).message
    });
  }
});

/**
 * Check if tier has feature
 * GET /api/tiers-singleton/:tierId/has-feature/:feature
 */
router.get('/:tierId/has-feature/:feature', async (req, res) => {
  try {
    const { tierId, feature } = req.params;
    
    // Validate feature name
    const validFeatures = [
      'basicAnalytics', 'advancedAnalytics', 'customBranding',
      'prioritySupport', 'apiAccess', 'bulkOperations',
      'customIntegrations', 'whiteLabel'
    ];
    
    if (!validFeatures.includes(feature)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feature name'
      });
    }
    
    const hasFeature = await tierService.hasFeature(tierId, feature as any);
    
    res.json({
      success: true,
      data: {
        tierId,
        feature,
        hasFeature,
        timestamp: new Date().toISOString()
      },
      message: 'Feature check completed'
    });
  } catch (error) {
    console.error('Feature check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check feature',
      error: (error as Error).message
    });
  }
});

export default router;
