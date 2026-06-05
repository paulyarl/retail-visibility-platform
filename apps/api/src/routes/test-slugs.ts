import { Router } from 'express';
import tenantSingletonService from '../services/TenantSingletonService';

const router = Router();

/**
 * GET /api/test/slug-comparison/:tenantId
 * Compare regular slug vs autoId-enhanced slug
 */
router.get('/slug-comparison/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Get both slug types
    const regularSlug = await tenantSingletonService.getTenantSlug(tenantId);
    const uniqueSlug = await tenantSingletonService.getTenantSlugWithAutoId(tenantId);
    const autoId = await tenantSingletonService.getTenantAutoId(tenantId);
    
    res.json({
      success: true,
      tenantId,
      regularSlug,
      uniqueSlug,
      autoId,
      comparison: {
        seoOptimized: regularSlug,
        guaranteedUnique: uniqueSlug,
        difference: uniqueSlug.length - regularSlug.length,
        format: 'business-name-state-autoId'
      },
      examples: {
        starbucksNY: 'starbucks-NY-A1B2',
        starbucksCA: 'starbucks-CA-C3D4',
        targetFL: 'target-FL-E5F6'
      }
    });
  } catch (error) {
    console.error('[Slug Comparison Error]', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to compare slugs'
    });
  }
});

export default router;
