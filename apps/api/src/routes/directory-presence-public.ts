/**
 * Public Directory Presence Routes
 *
 *   GET  /api/public/directory/claim/:token        — token summary (no auth)
 *   POST /api/public/directory/claim/:token/accept — bind owner (requires auth)
 *   GET  /api/public/directory/places               — categories with published presence listings
 *   GET  /api/public/directory/places/:categorySlug — published presence listings by category
 *   GET  /api/public/directory/places/:categorySlug/:city — filter by city within category
 *
 * The GET claim is fully public so a business owner can see what listing they'd be
 * claiming before authenticating. The POST requires authentication (customer
 * or platform user) to bind the owner identity.
 * The places endpoints are public browse routes for the /place category pages.
 */

import { Router, Request, Response } from 'express';
import DirectoryClaimService from '../services/DirectoryClaimService';
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

const router = Router();

/** GET /api/public/directory/claim/:token — public token summary */
router.get('/claim/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token_required' });
    }

    const summary = await DirectoryClaimService.getTokenSummary(token);
    if (!summary) {
      return res.status(404).json({ error: 'token_not_found' });
    }

    // Don't expose tenant_id in the public summary
    res.json({
      success: true,
      summary: {
        seedId: summary.seedId,
        slug: summary.slug,
        businessName: summary.businessName,
        category: summary.category,
        city: summary.city,
        state: summary.state,
        address: summary.address,
        phone: summary.phone,
        snapEbtReported: summary.snapEbtReported,
        isExpired: summary.isExpired,
        isConsumed: summary.isConsumed,
        expiresAt: summary.expiresAt,
        consumedAt: summary.consumedAt,
      },
    });
  } catch (error) {
    logger.error('[GET /api/public/directory/claim/:token] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/public/directory/claim/:token/accept — bind owner (requires auth) */
router.post('/claim/:token/accept', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token_required' });
    }

    // Auth: the caller must be authenticated. We accept both customer JWT
    // and platform user auth. The middleware that sets req.user or
    // req.customer should have run before this route.
    const userId =
      (req as any).user?.id ||
      (req as any).customer?.id ||
      null;

    if (!userId) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    const result = await DirectoryClaimService.acceptClaim(token, userId, {
      actorType: 'customer',
      actorId: userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    } as any);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        invalid_token: 404,
        token_expired: 410,
        already_claimed: 409,
      };
      return res.status(statusMap[result.message] || 400).json({
        error: result.message,
      });
    }

    res.json({
      success: true,
      tenantId: result.tenantId,
      seedId: result.seedId,
      message: 'claimed',
    });
  } catch (error) {
    logger.error('[POST /api/public/directory/claim/:token/accept] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

// ====================
// Public presence browse endpoints (for /place category pages)
// ====================

/**
 * Build a slug from a category name (mirrors the frontend slugify logic).
 */
function categorySlugFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
}

/** GET /api/public/directory/places — categories with published presence listings */
router.get('/places', async (req: Request, res: Response) => {
  try {
    const pool = getDirectPool();
    const result = await pool.query(
      `SELECT
         dps.category,
         dps.city,
         dps.state,
         COUNT(*) as place_count
       FROM directory_presence_seeds dps
       JOIN directory_listings_list dll ON dll.id = dps.listing_id
       WHERE dps.status = 'published'
         AND dll.is_published = true
         AND dll.listing_origin = 'directory_seed'
       GROUP BY dps.category, dps.city, dps.state
       ORDER BY dps.category ASC, dps.city ASC`,
      [],
    );

    // Group by category with city breakdowns
    const categoryMap: Record<string, {
      category: string;
      slug: string;
      placeCount: number;
      cities: { city: string; state: string; placeCount: number }[];
    }> = {};

    for (const row of result.rows) {
      const slug = categorySlugFromName(row.category);
      if (!categoryMap[slug]) {
        categoryMap[slug] = {
          category: row.category,
          slug,
          placeCount: 0,
          cities: [],
        };
      }
      categoryMap[slug].placeCount += parseInt(row.place_count);
      categoryMap[slug].cities.push({
        city: row.city,
        state: row.state,
        placeCount: parseInt(row.place_count),
      });
    }

    const categories = Object.values(categoryMap).sort((a, b) => b.placeCount - a.placeCount);

    res.json({
      success: true,
      categories,
      totalPlaces: categories.reduce((sum, c) => sum + c.placeCount, 0),
    });
  } catch (error) {
    logger.error('[GET /api/public/directory/places] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/public/directory/places/:categorySlug — published presence listings by category */
router.get('/places/:categorySlug', async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    const city = req.query.city as string | undefined;
    const pool = getDirectPool();

    // Decode slug (e.g., african-grocery -> african grocery)
    const decodedSlug = decodeURIComponent(categorySlug);

    // Build query with optional city filter
    let cityClause = '';
    const params: any[] = [];
    if (city) {
      cityClause = `AND dps.city = $1`;
      params.push(city);
    }

    const result = await pool.query(
      `SELECT
         dll.id,
         dll.tenant_id,
         dll.business_name,
         dll.slug,
         dll.address,
         dll.city,
         dll.state,
         dll.zip_code,
         dll.phone,
         dll.latitude,
         dll.longitude,
         dll.logo_url,
         dll.description,
         dll.snap_ebt_reported,
         dll.snap_ebt_source,
         dll.public_disclaimer,
         dps.category,
         dps.city as seed_city,
         dps.state as seed_state,
         (SELECT dct.token FROM directory_claim_tokens dct
          WHERE dct.seed_id = dps.id AND dct.consumed_at IS NULL AND dct.expires_at > now()
          LIMIT 1) as active_claim_token
       FROM directory_presence_seeds dps
       JOIN directory_listings_list dll ON dll.id = dps.listing_id
       WHERE dps.status = 'published'
         AND dll.is_published = true
         AND dll.listing_origin = 'directory_seed'
         AND (
           LOWER(REPLACE(REPLACE(LOWER(dps.category), '[^a-z0-9 ]', ''), ' ', '-')) = LOWER($${params.length + 1})
           OR LOWER(dps.category) = LOWER(REPLACE(REPLACE(LOWER($${params.length + 1}), '-', ' '), '  ', ' '))
         )
         ${cityClause}
       ORDER BY dll.business_name ASC`,
      [...params, decodedSlug],
    );

    const places = result.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      businessName: row.business_name,
      slug: row.slug,
      address: row.address,
      city: row.city || row.seed_city,
      state: row.state || row.seed_state,
      zipCode: row.zip_code,
      phone: row.phone,
      latitude: row.latitude,
      longitude: row.longitude,
      logoUrl: row.logo_url,
      description: row.description,
      snapEbtReported: row.snap_ebt_reported,
      snapEbtSource: row.snap_ebt_source,
      publicDisclaimer: row.public_disclaimer,
      category: row.category,
      claimToken: row.active_claim_token,
    }));

    res.json({
      success: true,
      categorySlug: decodedSlug,
      places,
      count: places.length,
    });
  } catch (error) {
    logger.error('[GET /api/public/directory/places/:categorySlug] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
