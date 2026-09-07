import { Router, Request, Response } from 'express';
import { z } from 'zod';
import CategoryMarketEnrichmentService from '../services/CategoryMarketEnrichmentService';
import { authenticateToken, requirePlatformStaffOrAdmin, requirePlatformAdmin } from '../middleware/auth';
import { logger } from '../logger';
import type { RequestCtx } from '../context';

const router = Router();

function getCtx(req: Request): RequestCtx {
  return {
    region: 'us-east-1',
    userId: (req as any).user?.id,
    ip: req.ip || undefined,
    userAgent: req.get('User-Agent') || undefined,
  };
}

const enrichMarketSchema = z.object({
  category: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
});

const overrideMarketSchema = z.object({
  operator_override_description: z.string().max(1000).optional(),
  operator_override_meta_title: z.string().max(70).optional(),
  operator_override_keywords: z.array(z.string().max(50)).max(15).optional(),
  reset_description: z.boolean().optional(),
  reset_meta_title: z.boolean().optional(),
  reset_keywords: z.boolean().optional(),
});

/**
 * GET /api/admin/directory/category-enrichment/markets
 * List enriched markets. Query params category/city/state are optional;
 * omitted returns the most-recently-enriched markets first.
 */
router.get(
  '/markets',
  authenticateToken,
  requirePlatformStaffOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const { category, city, state } = req.query;
      const markets = await CategoryMarketEnrichmentService.getInstance().listMarkets({
        category: typeof category === 'string' ? category : undefined,
        city: typeof city === 'string' ? city : undefined,
        state: typeof state === 'string' ? state : undefined,
        limit: 50,
      });
      res.json({ success: true, markets });
    } catch (error) {
      logger.error('[GET /admin/directory/category-enrichment/markets] Error:', getCtx(req), {
        error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
      });
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

/**
 * POST /api/admin/directory/category-enrichment/markets
 * Operator-triggered market enrichment. Resolves profiles and writes the
 * category-level packet plus listing-level enrichment for all matching listings.
 */
router.post(
  '/markets',
  authenticateToken,
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const parsed = enrichMarketSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          error: 'invalid_input',
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const result = await CategoryMarketEnrichmentService.getInstance().enrichMarket(
        parsed.data.category,
        parsed.data.city,
        parsed.data.state,
        { triggerSource: 'manual', enrichedBy: (req as any).user?.id },
        getCtx(req),
      );

      res.json({ success: true, result });
    } catch (error) {
      logger.error('[POST /admin/directory/category-enrichment/markets] Error:', getCtx(req), {
        error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
      });
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

/**
 * PATCH /api/admin/directory/category-enrichment/markets/:categoryKey/:city/:state
 * Operator override / reset for a category market.
 */
router.patch(
  '/markets/:categoryKey/:city/:state',
  authenticateToken,
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const parsed = overrideMarketSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          error: 'invalid_input',
          issues: parsed.error.flatten().fieldErrors,
        });
      }

      const { categoryKey, city, state } = req.params;
      const result = await CategoryMarketEnrichmentService.getInstance().overrideMarket(
        categoryKey,
        city,
        state,
        {
          overrideDescription: parsed.data.operator_override_description,
          overrideMetaTitle: parsed.data.operator_override_meta_title,
          overrideKeywords: parsed.data.operator_override_keywords,
          resetDescription: parsed.data.reset_description,
          resetMetaTitle: parsed.data.reset_meta_title,
          resetKeywords: parsed.data.reset_keywords,
        },
        (req as any).user?.id,
        getCtx(req),
      );

      res.json({ success: true, result });
    } catch (error: any) {
      const statusMap: Record<string, number> = {
        market_not_found: 404,
        description_too_long: 400,
        meta_title_too_long: 400,
        keywords_too_long: 400,
        invalid_market_key: 400,
      };
      const status = statusMap[error?.message] || 500;
      if (status === 500) {
        logger.error('[PATCH /admin/directory/category-enrichment/markets/:categoryKey/:city/:state] Error:', getCtx(req), {
          error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
        });
      }
      res.status(status).json({ error: error?.message || 'internal_error' });
    }
  },
);

export default router;
