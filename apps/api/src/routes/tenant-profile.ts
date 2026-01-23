/**
 * Tenant Profile API Routes
 * Integrates TenantProfileService with Express API
 */

import { Router } from 'express';
import TenantProfileService from '../services/TenantProfileService';

const router = Router();

// Get singleton instance
const tenantService = TenantProfileService.getInstance();

/**
 * Get tenant profile
 * GET /api/tenant/:tenantId/profile
 */
router.get('/:tenantId/profile', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const profile = await tenantService.getTenantProfile(tenantId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Tenant profile not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        profile,
        timestamp: new Date().toISOString()
      },
      message: 'Tenant profile retrieved successfully'
    });
  } catch (error) {
    console.error('Tenant profile retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tenant profile',
      error: (error as Error).message
    });
  }
});

/**
 * Get tenant analytics
 * GET /api/tenant/:tenantId/analytics
 */
router.get('/:tenantId/analytics', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const analytics = await tenantService.getTenantAnalytics(tenantId);
    
    res.json({
      success: true,
      data: {
        analytics,
        timestamp: new Date().toISOString()
      },
      message: 'Tenant analytics retrieved successfully'
    });
  } catch (error) {
    console.error('Tenant analytics retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tenant analytics',
      error: (error as Error).message
    });
  }
});

/**
 * Record tenant activity
 * POST /api/tenant/:tenantId/activity
 */
router.post('/:tenantId/activity', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { type, description, metadata } = req.body;
    
    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const activity = await tenantService.recordTenantActivity(tenantId, {
      type,
      description,
      metadata: {
        ...metadata,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      }
    });
    
    res.status(201).json({
      success: true,
      data: {
        activity,
        timestamp: new Date().toISOString()
      },
      message: 'Tenant activity recorded successfully'
    });
  } catch (error) {
    console.error('Tenant activity recording failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record tenant activity',
      error: (error as Error).message
    });
  }
});

/**
 * Get tenant statistics
 * GET /api/tenant/:tenantId/stats
 */
router.get('/:tenantId/stats', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await tenantService.getTenantProfileStats(tenantId);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Tenant statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Tenant statistics retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tenant statistics',
      error: (error as Error).message
    });
  }
});

/**
 * Update tenant profile
 * PUT /api/tenant/:tenantId/profile
 */
router.put('/:tenantId/profile', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const updates = req.body;
    
    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const updatedProfile = await tenantService.updateTenantProfile(tenantId, updates);
    
    res.json({
      success: true,
      data: {
        profile: updatedProfile,
        timestamp: new Date().toISOString()
      },
      message: 'Tenant profile updated successfully'
    });
  } catch (error) {
    console.error('Tenant profile update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tenant profile',
      error: (error as Error).message
    });
  }
});

/**
 * Get tenant profile statistics
 * GET /api/tenant/:tenantId/stats
 */
router.get('/:tenantId/stats', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await tenantService.getTenantProfileStats(tenantId);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Tenant profile statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Tenant profile statistics retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tenant profile statistics',
      error: (error as Error).message
    });
  }
});

export default router;
