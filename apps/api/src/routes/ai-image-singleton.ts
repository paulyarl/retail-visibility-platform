/**
 * AI Image API Routes - UniversalSingleton Implementation
 * Integrates AIImageSingletonService with Express API
 */

import { Router } from 'express';
import AIImageSingletonService from '../services/AIImageSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const aiImageService = AIImageSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Generate product image
 * POST /api/ai-image-singleton/generate
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, style, aspectRatio, quality, tenantId, inventoryItemId, metadata } = req.body;
    
    // Validate required fields
    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    // Check if user has permission to generate images for this tenant
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const generatedImage = await aiImageService.generateProductImage({
      prompt,
      style,
      aspectRatio,
      quality,
      tenantId,
      inventoryItemId,
      metadata
    });
    
    res.status(201).json({
      success: true,
      data: {
        generatedImage,
        timestamp: new Date().toISOString()
      },
      message: 'Image generated successfully'
    });
  } catch (error) {
    console.error('[AI IMAGE SINGLETON] Generate image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate image',
      error: (error as Error).message
    });
  }
});

/**
 * Get image generation statistics
 * GET /api/ai-image-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await aiImageService.getGenerationStats();
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Image generation statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[AI IMAGE SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch image generation statistics'
    });
  }
});

/**
 * Get service health status
 * GET /api/ai-image-singleton/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = await aiImageService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      },
      message: 'AI image service health status retrieved successfully'
    });
  } catch (error) {
    console.error('[AI IMAGE SINGLETON] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

/**
 * Clear cache
 * DELETE /api/ai-image-singleton/cache
 */
router.delete('/cache', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // Check if user has admin permissions for cache clearing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required'
      });
    }
    
    await aiImageService.clearCache(tenantId as string);
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('[AI IMAGE SINGLETON] Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

export default router;
