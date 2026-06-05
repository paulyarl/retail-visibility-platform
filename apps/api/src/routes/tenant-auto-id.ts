/**
 * Tenant Auto ID API Routes
 * Provides consistent 4-digit tenant IDs for shops and other features
 */

import { Router } from 'express';
import { generateTenantAutoId, getCachedTenantAutoId, getTenantIdentifiers, isTenantAutoId } from '../middleware/tenantAutoId';

const router = Router();

/**
 * GET /api/tenant-auto-id/:tenantId
 * Generate auto ID for a specific tenant
 */
router.get('/:tenantId', (req, res) => {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }
    
    const autoId = generateTenantAutoId(tenantId);
    
    res.json({
      success: true,
      data: {
        tenantId,
        autoId,
        generated: true
      }
    });
  } catch (error) {
    console.error('[TENANT AUTO ID] Error generating auto ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate tenant auto ID'
    });
  }
});

/**
 * GET /api/tenant-auto-id/:tenantId/cached
 * Get cached auto ID for a tenant (performance optimized)
 */
router.get('/:tenantId/cached', (req, res) => {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }
    
    const autoId = getCachedTenantAutoId(tenantId);
    
    res.json({
      success: true,
      data: {
        tenantId,
        autoId,
        cached: true
      }
    });
  } catch (error) {
    console.error('[TENANT AUTO ID] Error getting cached auto ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cached tenant auto ID'
    });
  }
});

/**
 * GET /api/tenant-auto-id/:tenantId/identifiers
 * Get all possible identifiers for a tenant (tenantId, slug, autoId)
 */
router.get('/:tenantId/identifiers', (req, res) => {
  try {
    const { tenantId } = req.params;
    const { slug } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }
    
    const identifiers = getTenantIdentifiers(tenantId, slug as string);
    
    res.json({
      success: true,
      data: identifiers
    });
  } catch (error) {
    console.error('[TENANT AUTO ID] Error getting identifiers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tenant identifiers'
    });
  }
});

/**
 * POST /api/tenant-auto-id/validate
 * Validate if an identifier is a tenant auto ID
 */
router.post('/validate', (req, res) => {
  try {
    const { identifier } = req.body;
    
    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'Identifier is required'
      });
    }
    
    const isValid = isTenantAutoId(identifier);
    
    res.json({
      success: true,
      data: {
        identifier,
        isValidAutoId: isValid,
        type: isValid ? 'tenant_auto_id' : 'other'
      }
    });
  } catch (error) {
    console.error('[TENANT AUTO ID] Error validating identifier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate identifier'
    });
  }
});

/**
 * GET /api/tenant-auto-id/batch
 * Generate auto IDs for multiple tenants
 */
router.get('/batch', (req, res) => {
  try {
    const { tenantIds } = req.query;
    
    if (!tenantIds) {
      return res.status(400).json({
        success: false,
        error: 'Tenant IDs query parameter is required (comma-separated)'
      });
    }
    
    const ids = (tenantIds as string).split(',').map(id => id.trim()).filter(id => id);
    const results = ids.map(tenantId => ({
      tenantId,
      autoId: generateTenantAutoId(tenantId)
    }));
    
    res.json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('[TENANT AUTO ID] Error batch generating auto IDs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to batch generate tenant auto IDs'
    });
  }
});

export default router;
