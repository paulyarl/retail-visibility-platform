/**
 * ARCHIVED — retired `/api/slugs` handlers.
 *
 * These routes were retired (see docs/SLUG_API_RETIREMENT.md) because a
 * consumer audit found no first-party caller, they carried no tenant
 * authorization (`authenticateToken` only), and they duplicated the
 * platform-standard `SlugSingletonService` write path.
 *
 * They remain MOUNTED and functional in `routes/slug-generation.ts` for a
 * deprecation window (Deprecation/Sunset headers + warning log). This file is
 * the frozen copy: `registerRetiredSlugRoutes` is intentionally never called.
 * When the deprecation window closes, delete the live registrations and this
 * file together.
 *
 * Do not import this module from the route registry.
 */
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middleware/auth';
import slugSingletonService from '../../services/SlugSingletonService';
import { z } from 'zod';
import { logger } from '../../logger';

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

export function registerRetiredSlugRoutes(router: Router): void {
  // POST /api/slugs/generate — retired
  router.post('/generate', authenticateToken, async (req: Request, res: Response) => {
    try {
      const parsed = generateSlugSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
      }

      const { text, location, tenantId, checkUniqueness } = parsed.data;
      const slug = await slugSingletonService.generateSlug(text, location || {}, tenantId);

      let isUnique = true;
      if (checkUniqueness) {
        isUnique = await slugSingletonService.isSlugAvailable(slug, tenantId);
      }

      const suggestions: string[] = [slug];
      if (!isUnique && location) {
        if (location.city && location.state) {
          const withState = await slugSingletonService.generateSlug(text, { city: location.city, state: location.state }, tenantId);
          if (withState !== slug) suggestions.push(withState);
        }
        if (location.city && location.state && location.country) {
          const withCountry = await slugSingletonService.generateSlug(text, location, tenantId);
          if (withCountry !== slug) suggestions.push(withCountry);
        }
      }

      return res.json({ slug, isUnique, suggestions: [...new Set(suggestions)] });
    } catch (error: any) {
      logger.error('[POST /api/slugs/generate] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return res.status(500).json({ error: 'slug_generation_failed', message: error.message });
    }
  });

  // PUT /api/slugs/tenant/:tenantId — retired (no tenant authorization)
  router.put('/tenant/:tenantId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { slug } = req.body;

      if (!tenantId || !slug) {
        return res.status(400).json({ error: 'tenant_id_and_slug_required' });
      }

      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(slug)) {
        return res.status(400).json({ error: 'invalid_slug_format', message: 'Slug must contain only lowercase letters, numbers, and hyphens' });
      }

      await slugSingletonService.updateSlug(tenantId, slug);
      return res.json({ success: true, slug });
    } catch (error: any) {
      logger.error('[PUT /api/slugs/tenant/:tenantId] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      if (error.message.includes('already taken')) {
        return res.status(409).json({ error: 'slug_already_taken', message: error.message });
      }
      return res.status(500).json({ error: 'failed_to_update_slug', message: error.message });
    }
  });

  // POST /api/slugs/slugify — retired
  router.post('/slugify', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'text_required' });
      }
      return res.json({ slug: slugSingletonService.slugify(text) });
    } catch (error: any) {
      logger.error('[POST /api/slugs/slugify] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return res.status(500).json({ error: 'slugify_failed', message: error.message });
    }
  });

  // POST /api/slugs/generate-with-pattern — retired
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
        'business_name_autoid',
      ];
      if (!validPatterns.includes(pattern)) {
        return res.status(400).json({ error: 'invalid_pattern', validPatterns });
      }

      const slug = await slugSingletonService.generateSlugWithPattern(businessName, location || {}, pattern, tenantId);
      return res.json({ slug });
    } catch (error: any) {
      logger.error('[POST /api/slugs/generate-with-pattern] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return res.status(400).json({ error: 'pattern_generation_failed', message: error.message });
    }
  });

  // POST /api/slugs/tenant/:tenantId/regenerate — retired (no tenant authorization)
  router.post('/tenant/:tenantId/regenerate', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { forceUpdate } = req.body;
      if (!tenantId) {
        return res.status(400).json({ error: 'tenant_id_required' });
      }
      const newSlug = await slugSingletonService.regenerateSlugFromBusinessName(tenantId, forceUpdate || false);
      return res.json({ success: true, slug: newSlug, message: 'Slug regenerated from business name' });
    } catch (error: any) {
      logger.error('[POST /api/slugs/tenant/:tenantId/regenerate] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return res.status(500).json({ error: 'regeneration_failed', message: error.message });
    }
  });

  // DELETE /api/slugs/tenant/:tenantId/cache — retired (no tenant authorization)
  router.delete('/tenant/:tenantId/cache', authenticateToken, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      if (!tenantId) {
        return res.status(400).json({ error: 'tenant_id_required' });
      }
      slugSingletonService.invalidateSlugCache(tenantId);
      return res.json({ success: true, message: `Cache invalidated for tenant ${tenantId}` });
    } catch (error: any) {
      logger.error('[DELETE /api/slugs/tenant/:tenantId/cache] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return res.status(500).json({ error: 'cache_invalidation_failed', message: error.message });
    }
  });
}
