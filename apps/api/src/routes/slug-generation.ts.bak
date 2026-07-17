/**
 * Slug Generation API Routes
 * 
 * Provides REST API endpoints for slug generation and management.
 * All endpoints use the SlugSingletonService for consistency.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import slugSingletonService from '../services/SlugSingletonService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const generateSlugSchema = z.object({
  text: z.string().min(1).max(200),
  location: z.object({
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  tenantId: z.string().optional(),
  checkUniqueness: z.boolean().optional().default(true),
});

const checkAvailabilitySchema = z.object({
  slug: z.string().min(1).max(200),
  excludeTenantId: z.string().optional(),
});

/**
 * POST /api/slugs/generate
 * Generate a slug from text with optional location disambiguation
 * 
 * Body:
 * {
 *   "text": "Business Name",
 *   "location": { "city": "New York", "state": "New York", "country": "United States" },
 *   "tenantId": "tid-12345",
 *   "checkUniqueness": true
 * }
 * 
 * Response:
 * {
 *   "slug": "business-name-new-york-ny",
 *   "isUnique": true,
 *   "suggestions": ["business-name-new-york-ny", "business-name-new-york-ny-usa"]
 * }
 */
router.post('/generate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const parsed = generateSlugSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'invalid_payload', 
        details: parsed.error.flatten() 
      });
    }

    const { text, location, tenantId, checkUniqueness } = parsed.data;

    // Generate slug
    const slug = await slugSingletonService.generateSlug(
      text,
      location || {},
      tenantId
    );

    // Check uniqueness if requested
    let isUnique = true;
    if (checkUniqueness) {
      isUnique = await slugSingletonService.isSlugAvailable(slug, tenantId);
    }

    // Generate suggestions (alternative slugs)
    const suggestions: string[] = [slug];
    
    if (!isUnique && location) {
      // Add more specific suggestions
      if (location.city && location.state) {
        const withState = await slugSingletonService.generateSlug(
          text,
          { city: location.city, state: location.state },
          tenantId
        );
        if (withState !== slug) suggestions.push(withState);
      }
      
      if (location.city && location.state && location.country) {
        const withCountry = await slugSingletonService.generateSlug(
          text,
          location,
          tenantId
        );
        if (withCountry !== slug) suggestions.push(withCountry);
      }
    }

    return res.json({
      slug,
      isUnique,
      suggestions: [...new Set(suggestions)], // Remove duplicates
    });
  } catch (error: any) {
    console.error('[POST /api/slugs/generate] Error:', error);
    return res.status(500).json({ 
      error: 'slug_generation_failed',
      message: error.message 
    });
  }
});

/**
 * GET /api/slugs/tenant/:tenantId
 * Get or create slug for a tenant
 * 
 * Response:
 * {
 *   "slug": "business-name-new-york-ny",
 *   "tenantId": "tid-12345",
 *   "isPublished": false,
 *   "createdAt": "2024-01-01T00:00:00.000Z",
 *   "updatedAt": "2024-01-01T00:00:00.000Z"
 * }
 */
router.get('/tenant/:tenantId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_id_required' });
    }

    // Get or create slug
    const slug = await slugSingletonService.getOrCreateSlug(tenantId);

    // Get full slug info with metadata
    const slugInfo = await slugSingletonService.getSlugInfo(tenantId);

    if (!slugInfo) {
      return res.json({
        slug,
        tenantId,
        isPublished: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return res.json({
      slug: slugInfo.slug,
      tenantId: slugInfo.tenantId,
      isPublished: slugInfo.isPublished,
      createdAt: slugInfo.createdAt,
      updatedAt: slugInfo.updatedAt,
    });
  } catch (error: any) {
    console.error('[GET /api/slugs/tenant/:tenantId] Error:', error);
    return res.status(500).json({ 
      error: 'failed_to_get_slug',
      message: error.message 
    });
  }
});

/**
 * PUT /api/slugs/tenant/:tenantId
 * Update slug for a tenant
 * 
 * Body:
 * {
 *   "slug": "new-business-name"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "slug": "new-business-name"
 * }
 */
router.put('/tenant/:tenantId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { slug } = req.body;

    if (!tenantId || !slug) {
      return res.status(400).json({ error: 'tenant_id_and_slug_required' });
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return res.status(400).json({ 
        error: 'invalid_slug_format',
        message: 'Slug must contain only lowercase letters, numbers, and hyphens'
      });
    }

    // Update slug
    await slugSingletonService.updateSlug(tenantId, slug);

    return res.json({
      success: true,
      slug,
    });
  } catch (error: any) {
    console.error('[PUT /api/slugs/tenant/:tenantId] Error:', error);
    
    if (error.message.includes('already taken')) {
      return res.status(409).json({ 
        error: 'slug_already_taken',
        message: error.message 
      });
    }
    
    return res.status(500).json({ 
      error: 'failed_to_update_slug',
      message: error.message 
    });
  }
});

/**
 * POST /api/slugs/check-availability
 * Check if a slug is available
 * 
 * Body:
 * {
 *   "slug": "business-name",
 *   "excludeTenantId": "tid-12345"
 * }
 * 
 * Response:
 * {
 *   "slug": "business-name",
 *   "isAvailable": true
 * }
 */
router.post('/check-availability', authenticateToken, async (req: Request, res: Response) => {
  try {
    const parsed = checkAvailabilitySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'invalid_payload', 
        details: parsed.error.flatten() 
      });
    }

    const { slug, excludeTenantId } = parsed.data;

    const isAvailable = await slugSingletonService.isSlugAvailable(slug, excludeTenantId);

    return res.json({
      slug,
      isAvailable,
    });
  } catch (error: any) {
    console.error('[POST /api/slugs/check-availability] Error:', error);
    return res.status(500).json({ 
      error: 'availability_check_failed',
      message: error.message 
    });
  }
});

/**
 * POST /api/slugs/slugify
 * Simple slugify endpoint (no uniqueness check)
 * 
 * Body:
 * {
 *   "text": "Business Name"
 * }
 * 
 * Response:
 * {
 *   "slug": "business-name"
 * }
 */
router.post('/slugify', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text_required' });
    }

    const slug = slugSingletonService.slugify(text);

    return res.json({ slug });
  } catch (error: any) {
    console.error('[POST /api/slugs/slugify] Error:', error);
    return res.status(500).json({ 
      error: 'slugify_failed',
      message: error.message 
    });
  }
});

/**
 * POST /api/slugs/patterns
 * Get all available slug patterns for a business name and location
 * 
 * Body:
 * {
 *   "businessName": "Coffee Shop",
 *   "location": { "city": "Seattle", "state": "Washington", "country": "United States" },
 *   "tenantId": "tid-12345"
 * }
 * 
 * Response:
 * {
 *   "patterns": [
 *     { "pattern": "business_name", "slug": "coffee-shop", "isAvailable": false, "description": "Business name only (shortest, most memorable)" },
 *     { "pattern": "business_name_city", "slug": "coffee-shop-seattle", "isAvailable": true, "description": "Coffee Shop in Seattle" },
 *     { "pattern": "business_name_state", "slug": "coffee-shop-wa", "isAvailable": true, "description": "Coffee Shop in Washington" },
 *     { "pattern": "business_name_city_state", "slug": "coffee-shop-seattle-wa", "isAvailable": true, "description": "Coffee Shop in Seattle, Washington" }
 *   ]
 * }
 */
router.post('/patterns', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { businessName, location, tenantId } = req.body;

    if (!businessName || typeof businessName !== 'string') {
      return res.status(400).json({ error: 'business_name_required' });
    }

    const patterns = await slugSingletonService.getAllSlugPatterns(
      businessName,
      location || {},
      tenantId
    );

    return res.json({ patterns });
  } catch (error: any) {
    console.error('[POST /api/slugs/patterns] Error:', error);
    return res.status(500).json({ 
      error: 'pattern_generation_failed',
      message: error.message 
    });
  }
});

/**
 * POST /api/slugs/generate-with-pattern
 * Generate slug with specific pattern choice
 * 
 * Body:
 * {
 *   "businessName": "Coffee Shop",
 *   "location": { "city": "Seattle", "state": "Washington" },
 *   "pattern": "business_name_city_state",
 *   "tenantId": "tid-12345"
 * }
 * 
 * Response:
 * {
 *   "slug": "coffee-shop-seattle-wa"
 * }
 */
router.post('/generate-with-pattern', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { businessName, location, pattern, tenantId } = req.body;

    if (!businessName || !pattern) {
      return res.status(400).json({ error: 'business_name_and_pattern_required' });
    }

    const validPatterns = [
      'business_name',
      'business_name_city',
      'business_name_state',
      'business_name_city_state',
      'business_name_city_state_country',
      'business_name_autoid'
    ];

    if (!validPatterns.includes(pattern)) {
      return res.status(400).json({ 
        error: 'invalid_pattern',
        validPatterns 
      });
    }

    const slug = await slugSingletonService.generateSlugWithPattern(
      businessName,
      location || {},
      pattern,
      tenantId
    );

    return res.json({ slug });
  } catch (error: any) {
    console.error('[POST /api/slugs/generate-with-pattern] Error:', error);
    return res.status(400).json({ 
      error: 'pattern_generation_failed',
      message: error.message 
    });
  }
});

/**
 * POST /api/slugs/tenant/:tenantId/regenerate
 * Regenerate slug from current business name
 * Useful when business name changes
 * 
 * Body:
 * {
 *   "forceUpdate": true
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "slug": "new-business-name-seattle-wa",
 *   "message": "Slug regenerated from business name"
 * }
 */
router.post('/tenant/:tenantId/regenerate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { forceUpdate } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_id_required' });
    }

    const newSlug = await slugSingletonService.regenerateSlugFromBusinessName(
      tenantId,
      forceUpdate || false
    );

    return res.json({
      success: true,
      slug: newSlug,
      message: 'Slug regenerated from business name',
    });
  } catch (error: any) {
    console.error('[POST /api/slugs/tenant/:tenantId/regenerate] Error:', error);
    return res.status(500).json({ 
      error: 'regeneration_failed',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/slugs/tenant/:tenantId/cache
 * Invalidate slug cache for a tenant
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Cache invalidated for tenant tid-12345"
 * }
 */
router.delete('/tenant/:tenantId/cache', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_id_required' });
    }

    slugSingletonService.invalidateSlugCache(tenantId);

    return res.json({
      success: true,
      message: `Cache invalidated for tenant ${tenantId}`,
    });
  } catch (error: any) {
    console.error('[DELETE /api/slugs/tenant/:tenantId/cache] Error:', error);
    return res.status(500).json({ 
      error: 'cache_invalidation_failed',
      message: error.message 
    });
  }
});

export default router;
