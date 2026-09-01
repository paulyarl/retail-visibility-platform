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
import { z } from 'zod';
import multer from 'multer';
import DirectoryClaimService from '../services/DirectoryClaimService';
import DirectorySuggestionService, { suggestionInputSchema } from '../services/DirectorySuggestionService';
import DirectoryPresenceSeedService from '../services/DirectoryPresenceSeedService';
import GrowthEngineAnalyticsService from '../services/GrowthEngineAnalyticsService';
import { slugify } from '../utils/slug';
import { prisma } from '../prisma';
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';
import { unifiedConfig } from '../config/unifiedConfig';
import { validateAttachment } from '../validators/recovery-intake.schema';
import { optionalCustomerAuth, optionalAuth } from '../middleware/auth';
import crypto from 'crypto';

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
        ...summary,
        // keep internal tenantId out of public response
        tenantId: undefined,
      },
    });
  } catch (error) {
    logger.error('[GET /api/public/directory/claim/:token] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/public/directory/suggestions — suggest a missing business */
router.post('/suggestions', async (req: Request, res: Response) => {
  try {
    const parse = suggestionInputSchema.safeParse(req.body || {});
    if (!parse.success) {
      return res.status(400).json({
        error: 'invalid_input',
        issues: parse.error.flatten().fieldErrors,
      });
    }

    const forwarded = req.headers['x-forwarded-for'] as string | undefined;
    const submitterIp = forwarded || req.socket?.remoteAddress || (req as any).ip;

    const result = await DirectorySuggestionService.createSuggestion(parse.data, submitterIp);

    if (result.duplicate) {
      return res.status(409).json({
        error: 'already_listed',
        message: 'This business appears to already be in the directory.',
        existing: {
          id: result.duplicate.id,
          businessName: result.duplicate.businessName,
          slug: result.duplicate.slug,
          city: result.duplicate.city,
          state: result.duplicate.state,
        },
      });
    }

    if (result.error) {
      return res.status(result.statusCode).json({ error: result.error });
    }

    res.status(201).json({
      success: true,
      suggestionId: result.suggestion?.id,
      message: 'Suggestion received. It will be reviewed before publishing.',
    });
  } catch (error) {
    logger.error('[POST /api/public/directory/suggestions] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/public/directory/claim/:token/initiate — initiate claim (sends OTP if required) */
router.post('/claim/:token/initiate', optionalAuth, optionalCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token_required' });
    }

    // Extract customer info (if authenticated) for operator-approval requests
    let customer = (req as any).customer;
    const platformUser = (req as any).user;

    // Claimant verification fields (from the claim form body)
    const body = req.body || {};
    const claimantFirstName = body.claimantFirstName?.trim() || undefined;
    const claimantMiddleName = body.claimantMiddleName?.trim() || undefined;
    const claimantLastName = body.claimantLastName?.trim() || undefined;
    const claimantPhone = body.claimantPhone?.trim() || undefined;
    const claimantBusinessAddress = body.claimantBusinessAddress?.trim() || undefined;

    // Direct JWT fallback: if optionalCustomerAuth didn't set req.customer,
    // try to parse the customer JWT from the Authorization header directly.
    // PublicApiSingleton may not forward the header through makeDefaultRequest,
    // but if it does, the middleware should have already handled it.
    if (!customer) {
      try {
        const { CustomerTokenService } = await import('../services/CustomerTokenService');
        const tokenService = CustomerTokenService.getInstance();
        const bearerToken = CustomerTokenService.extractBearerToken(req);
        if (bearerToken) {
          const payload = tokenService.verifyAccessToken(bearerToken);
          if (payload?.customerId) {
            // Fetch customer details to get email + name
            const { prisma } = await import('../prisma');
            const custRows = await prisma.$queryRaw<any[]>`
              SELECT id, email, first_name, last_name FROM customers WHERE id = ${payload.customerId} LIMIT 1
            `;
            if (custRows[0]) {
              customer = {
                id: custRows[0].id,
                email: custRows[0].email,
                firstName: custRows[0].first_name,
                lastName: custRows[0].last_name,
              };
            }
          }
        }
      } catch {
        // Token invalid or expired — continue with body fallback
      }
    }

    // Use JWT-parsed identity if available; fall back to frontend-provided
    // values (the PublicApiSingleton may not forward the Authorization header
    // through makeDefaultRequest, so optionalCustomerAuth might not set
    // req.customer even when the customer is logged in on the frontend).
    // Final fallback: x-customer-id / x-customer-email headers sent from
    // localStorage customer_identity_cache.
    const headerCustomerId = req.get('x-customer-id') || undefined;
    const headerCustomerEmail = req.get('x-customer-email') || undefined;
    const actorId = customer?.id || platformUser?.id || body.customerId || headerCustomerId || undefined;
    const customerEmail = customer?.email || platformUser?.email || body.customerEmail || headerCustomerEmail || undefined;
    const customerName = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || undefined;

    const result = await DirectoryClaimService.initiateClaim(token, {
      actorType: 'customer',
      actorId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      customerEmail,
      customerName,
      claimantFirstName,
      claimantMiddleName,
      claimantLastName,
      claimantPhone,
      claimantBusinessAddress,
    } as any);

    if (result.error) {
      const statusMap: Record<string, number> = {
        invalid_token: 404,
        token_expired: 410,
        already_claimed: 409,
      };
      return res.status(statusMap[result.error] || 400).json({ error: result.error });
    }

    res.json({
      success: true,
      verificationRequired: result.verificationRequired,
      sentTo: result.sentTo,
      operatorApprovalRequired: result.operatorApprovalRequired,
      requestId: result.requestId,
    });
  } catch (error) {
    logger.error('[POST /api/public/directory/claim/:token/initiate] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/public/directory/claim/:token/accept — bind owner (requires auth) */
router.post('/claim/:token/accept', optionalAuth, optionalCustomerAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token_required' });
    }

    // Auth: the caller must be authenticated. We accept both customer JWT
    // and platform user auth. The middleware that sets req.user or
    // req.customer should have run before this route.
    const platformUser = (req as any).user;
    const customer = (req as any).customer;
    const userId = platformUser?.id || customer?.id || null;
    const isCustomer = !platformUser && !!customer;

    if (!userId) {
      return res.status(401).json({ error: 'authentication_required' });
    }

    const { otpCode } = req.body || {};

    const result = await DirectoryClaimService.acceptClaim(token, userId, isCustomer, {
      actorType: isCustomer ? 'customer' : 'user',
      actorId: userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    } as any, otpCode);

    if (!result.success) {
      const statusMap: Record<string, number> = {
        invalid_token: 404,
        token_expired: 410,
        already_claimed: 409,
        otp_required: 400,
        otp_not_found: 400,
        otp_expired: 410,
        invalid_otp: 403,
        otp_max_attempts: 429,
        pending_operator_approval: 202,
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
      userTokens: result.userTokens,
      requiresPasswordSetup: result.requiresPasswordSetup,
      platformUserId: result.platformUserId,
      // Gateway upgrade preview (claim handoff spec) — embedded so the
      // success screen can render Entry Presence mode cards without a
      // platform (Auth0) session.
      currentTier: result.currentTier,
      isGatewayUpgrade: result.isGatewayUpgrade,
      upgradeOptions: result.upgradeOptions,
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
// Reuses platform_categories as the canonical category source (same system
// as the tenant directory settings at /t/[tenantId]/settings/directory and
// the GBP category settings at /t/[tenantId]/settings/gbp-category).
// directory_presence_seeds.category is a free-form string that matches
// platform_categories.name; we join to get proper slugs, hierarchy, and
// metadata rather than deriving slugs from the free-form string.

/** GET /api/public/directory/places — categories with published presence listings */
router.get('/places', async (req: Request, res: Response) => {
  try {
    const pool = getDirectPool();
    const result = await pool.query(
      `SELECT
         dps.category,
         pc.slug AS category_slug,
         pc.id AS category_id,
         pc.icon_emoji,
         pc.parent_id,
         pc.level,
         dps.city,
         dps.state,
         COUNT(*) as place_count
       FROM directory_presence_seeds dps
       JOIN directory_listings_list dll ON dll.id = dps.listing_id
       LEFT JOIN platform_categories pc ON LOWER(pc.name) = LOWER(dps.category)
       WHERE dps.status = 'published'
         AND dll.is_published = true
         AND dll.listing_origin = 'directory_seed'
       GROUP BY dps.category, pc.slug, pc.id, pc.icon_emoji, pc.parent_id, pc.level, dps.city, dps.state
       ORDER BY dps.category ASC, dps.city ASC`,
      [],
    );

    // Group by category with city breakdowns
    const categoryMap: Record<string, {
      category: string;
      slug: string;
      categoryId: string | null;
      iconEmoji: string | null;
      parentId: string | null;
      level: number | null;
      placeCount: number;
      cities: { city: string; state: string; placeCount: number }[];
    }> = {};

    for (const row of result.rows) {
      // Use platform_categories slug if available, otherwise fall back to name-based slug
      const slug = row.category_slug || row.category.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
      if (!categoryMap[slug]) {
        categoryMap[slug] = {
          category: row.category,
          slug,
          categoryId: row.category_id || null,
          iconEmoji: row.icon_emoji || null,
          parentId: row.parent_id || null,
          level: row.level !== null ? parseInt(row.level) : null,
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
    let paramIdx = 1;
    if (city) {
      cityClause = `AND dps.city = $${paramIdx}`;
      params.push(city);
      paramIdx++;
    }

    // Match by platform_categories.slug (preferred) or by name-based slug fallback
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
         pc.slug AS category_slug,
         pc.id AS category_id,
         pc.icon_emoji,
         (SELECT dct.token FROM directory_claim_tokens dct
          WHERE dct.seed_id = dps.id AND dct.consumed_at IS NULL AND dct.expires_at > now()
          LIMIT 1) as active_claim_token
       FROM directory_presence_seeds dps
       JOIN directory_listings_list dll ON dll.id = dps.listing_id
       LEFT JOIN platform_categories pc ON LOWER(pc.name) = LOWER(dps.category)
       WHERE dps.status = 'published'
         AND dll.is_published = true
         AND dll.listing_origin = 'directory_seed'
         AND (
           pc.slug = $${paramIdx}
           OR LOWER(REPLACE(REPLACE(LOWER(dps.category), '[^a-z0-9 ]', ''), ' ', '-')) = LOWER($${paramIdx})
           OR LOWER(dps.category) = LOWER(REPLACE(REPLACE(LOWER($${paramIdx}), '-', ' '), '  ', ' '))
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
      categorySlug: row.category_slug || decodedSlug,
      iconEmoji: row.icon_emoji || null,
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

// ====================
// Search, city pages, map data, sitemap (Sprint 5)
// ====================

/** GET /api/public/directory/places/search — full-text search across presence listings */
router.get('/places/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    const category = req.query.category as string | undefined;
    const city = req.query.city as string | undefined;
    const snapEbt = req.query.snapEbt === 'true';
    const sort = (req.query.sort as string) || 'name';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(48, Math.max(1, parseInt(req.query.perPage as string) || 24));
    const offset = (page - 1) * perPage;

    const pool = getDirectPool();

    // Build query with optional full-text search
    let whereClause = `WHERE dps.status = 'published' AND dll.is_published = true AND dll.listing_origin = 'directory_seed'`;
    const params: any[] = [];
    let paramIdx = 1;

    if (q) {
      whereClause += ` AND (
        to_tsvector('english', coalesce(dll.business_name,'') || ' ' || coalesce(dll.city,'') || ' ' || coalesce(dll.state,'') || ' ' || coalesce(dll.slug,'')) @@ plainto_tsquery('english', $${paramIdx})
        OR dll.business_name ILIKE '%' || $${paramIdx} || '%'
        OR similarity(dll.business_name, $${paramIdx}) > 0.3
      )`;
      params.push(q);
      paramIdx++;
    }
    if (category) {
      whereClause += ` AND LOWER(dps.category) = LOWER($${paramIdx})`;
      params.push(category);
      paramIdx++;
    }
    if (city) {
      whereClause += ` AND LOWER(dps.city) = LOWER($${paramIdx})`;
      params.push(city);
      paramIdx++;
    }
    if (snapEbt) {
      whereClause += ` AND dll.snap_ebt_reported = true`;
    }

    let orderBy = 'dll.business_name ASC';
    if (sort === 'city') orderBy = 'dll.city ASC, dll.business_name ASC';
    if (sort === 'recent') orderBy = 'dps.published_at DESC';
    if (sort === 'snap') orderBy = 'dll.snap_ebt_reported DESC, dll.business_name ASC';

    // Count total
    const countQuery = `SELECT COUNT(*) as total
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dll ON dll.id = dps.listing_id
      ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total) || 0;

    // Fetch page
    const dataQuery = `SELECT
        dll.id, dll.tenant_id, dll.business_name, dll.slug, dll.address,
        dll.city, dll.state, dll.zip_code, dll.phone, dll.latitude, dll.longitude,
        dll.logo_url, dll.description, dll.snap_ebt_reported, dll.snap_ebt_source,
        dll.public_disclaimer,
        dps.category, dps.city as seed_city, dps.state as seed_state,
        pc.slug AS category_slug, pc.icon_emoji
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dll ON dll.id = dps.listing_id
      LEFT JOIN platform_categories pc ON LOWER(pc.name) = LOWER(dps.category)
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(perPage, offset);

    const result = await pool.query(dataQuery, params);

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
      categorySlug: row.category_slug || (row.category || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-'),
      iconEmoji: row.icon_emoji || null,
    }));

    res.json({
      success: true,
      query: q,
      places,
      count: places.length,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    logger.error('[GET /api/public/directory/places/search] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/public/directory/places/city/:citySlug — all presence listings in a city, grouped by category */
router.get('/places/city/:citySlug', async (req: Request, res: Response) => {
  try {
    const { citySlug } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(48, Math.max(1, parseInt(req.query.perPage as string) || 24));
    const offset = (page - 1) * perPage;
    const sort = (req.query.sort as string) || 'name';

    const pool = getDirectPool();
    const decodedSlug = decodeURIComponent(citySlug);
    const cityName = decodedSlug.replace(/-/g, ' ');

    let orderBy = 'dll.business_name ASC';
    if (sort === 'recent') orderBy = 'dps.published_at DESC';
    if (sort === 'snap') orderBy = 'dll.snap_ebt_reported DESC, dll.business_name ASC';

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM directory_presence_seeds dps
       JOIN directory_listings_list dll ON dll.id = dps.listing_id
       WHERE dps.status = 'published' AND dll.is_published = true
         AND dll.listing_origin = 'directory_seed'
         AND LOWER(dps.city) = LOWER($1)`,
      [cityName],
    );
    const total = parseInt(countResult.rows[0].total) || 0;

    const result = await pool.query(
      `SELECT
         dll.id, dll.tenant_id, dll.business_name, dll.slug, dll.address,
         dll.city, dll.state, dll.zip_code, dll.phone, dll.latitude, dll.longitude,
         dll.logo_url, dll.description, dll.snap_ebt_reported, dll.snap_ebt_source,
         dll.public_disclaimer,
         dps.category, dps.city as seed_city, dps.state as seed_state,
         pc.slug AS category_slug, pc.id AS category_id, pc.icon_emoji
       FROM directory_presence_seeds dps
       JOIN directory_listings_list dll ON dll.id = dps.listing_id
       LEFT JOIN platform_categories pc ON LOWER(pc.name) = LOWER(dps.category)
       WHERE dps.status = 'published' AND dll.is_published = true
         AND dll.listing_origin = 'directory_seed'
         AND LOWER(dps.city) = LOWER($1)
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [cityName, perPage, offset],
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
      categorySlug: row.category_slug || (row.category || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-'),
      iconEmoji: row.icon_emoji || null,
    }));

    // Group by category
    const categoryMap: Record<string, { category: string; slug: string; iconEmoji: string | null; places: any[] }> = {};
    for (const p of places) {
      if (!categoryMap[p.category]) {
        categoryMap[p.category] = { category: p.category, slug: p.categorySlug, iconEmoji: p.iconEmoji, places: [] };
      }
      categoryMap[p.category].places.push(p);
    }

    res.json({
      success: true,
      city: cityName,
      citySlug: decodedSlug,
      categories: Object.values(categoryMap),
      places,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    logger.error('[GET /api/public/directory/places/city/:citySlug] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/public/directory/places-map — lightweight geo data for map pins */
router.get('/places-map', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const city = req.query.city as string | undefined;
    const pool = getDirectPool();

    let whereClause = `WHERE dps.status = 'published' AND dll.is_published = true AND dll.listing_origin = 'directory_seed' AND dll.latitude IS NOT NULL AND dll.longitude IS NOT NULL`;
    const params: any[] = [];
    let paramIdx = 1;

    if (category) {
      whereClause += ` AND LOWER(dps.category) = LOWER($${paramIdx})`;
      params.push(category);
      paramIdx++;
    }
    if (city) {
      whereClause += ` AND LOWER(dps.city) = LOWER($${paramIdx})`;
      params.push(city);
      paramIdx++;
    }

    const result = await pool.query(
      `SELECT
         dll.id, dll.business_name, dll.slug, dll.latitude, dll.longitude,
         dll.address, dll.city, dll.state, dll.snap_ebt_reported,
         dps.category,
         pc.slug AS category_slug
       FROM directory_presence_seeds dps
       JOIN directory_listings_list dll ON dll.id = dps.listing_id
       LEFT JOIN platform_categories pc ON LOWER(pc.name) = LOWER(dps.category)
       ${whereClause}
       LIMIT 500`,
      params,
    );

    const pins = result.rows.map((row: any) => ({
      id: row.id,
      businessName: row.business_name,
      slug: row.slug,
      lat: parseFloat(row.latitude),
      lng: parseFloat(row.longitude),
      address: row.address,
      city: row.city,
      state: row.state,
      snapEbt: row.snap_ebt_reported,
      category: row.category,
      categorySlug: row.category_slug || (row.category || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-'),
    }));

    res.json({ success: true, pins, count: pins.length });
  } catch (error) {
    logger.error('[GET /api/public/directory/places-map] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/public/directory/places-sitemap.xml — XML sitemap for all presence pages */
router.get('/places-sitemap.xml', async (req: Request, res: Response) => {
  try {
    const pool = getDirectPool();
    const baseUrl = (req as any).protocol + '://' + req.get('host');

    // Fetch all published presence listing slugs
    const listingsResult = await pool.query(
      `SELECT dll.slug, dll.updated_at
       FROM directory_presence_seeds dps
       JOIN directory_listings_list dll ON dll.id = dps.listing_id
       WHERE dps.status = 'published' AND dll.is_published = true
         AND dll.listing_origin = 'directory_seed'`,
    );

    // Fetch all categories with published listings
    const categoriesResult = await pool.query(
      `SELECT DISTINCT pc.slug AS category_slug
       FROM directory_presence_seeds dps
       JOIN directory_listings_list dll ON dll.id = dps.listing_id
       LEFT JOIN platform_categories pc ON LOWER(pc.name) = LOWER(dps.category)
       WHERE dps.status = 'published' AND dll.is_published = true
         AND dll.listing_origin = 'directory_seed' AND pc.slug IS NOT NULL`,
    );

    // Fetch all cities with published listings
    const citiesResult = await pool.query(
      `SELECT DISTINCT LOWER(dps.city) AS city_slug
       FROM directory_presence_seeds dps
       JOIN directory_listings_list dll ON dll.id = dps.listing_id
       WHERE dps.status = 'published' AND dll.is_published = true
         AND dll.listing_origin = 'directory_seed'`,
    );

    const urls: string[] = [];

    // Index page
    urls.push(`  <url>
    <loc>${baseUrl}/place</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`);

    // Category pages
    for (const row of categoriesResult.rows) {
      urls.push(`  <url>
    <loc>${baseUrl}/place/category/${encodeURIComponent(row.category_slug)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }

    // City pages
    for (const row of citiesResult.rows) {
      const citySlug = (row.city_slug as string).replace(/\s+/g, '-');
      urls.push(`  <url>
    <loc>${baseUrl}/place/city/${encodeURIComponent(citySlug)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }

    // Individual listing pages
    for (const row of listingsResult.rows) {
      const lastmod = new Date(row.updated_at).toISOString().split('T')[0];
      urls.push(`  <url>
    <loc>${baseUrl}/place/${encodeURIComponent(row.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
    }

    // Log sitemap generation
    const totalUrls = 1 + categoriesResult.rows.length + citiesResult.rows.length + listingsResult.rows.length;
    await pool.query(
      'INSERT INTO directory_places_sitemap_log (generated_at, url_count) VALUES (now(), $1)',
      [totalUrls],
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    logger.error('[GET /api/public/directory/places-sitemap.xml] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** POST /api/public/directory/search-demand — log a search demand event (public, no auth) */
router.post('/search-demand', async (req: Request, res: Response) => {
  try {
    const { searchQuery, resolvedCategory, resolvedCity, resultCount } = req.body || {};
    if (!searchQuery || typeof searchQuery !== 'string') {
      return res.status(400).json({ error: 'search_query_required' });
    }

    // Hash IP for dedup (not for tracking)
    const ip = req.ip || '';
    const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32) : null;
    const userAgent = req.get('User-Agent') || '';
    const userAgentHash = userAgent ? crypto.createHash('sha256').update(userAgent).digest('hex').slice(0, 32) : null;

    await GrowthEngineAnalyticsService.logSearchDemand({
      searchQuery: searchQuery.slice(0, 255),
      resolvedCategory: resolvedCategory || null,
      resolvedCity: resolvedCity || null,
      resultCount: typeof resultCount === 'number' ? resultCount : 0,
      ipHash,
      userAgentHash,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('[POST /api/public/directory/search-demand] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

// Multipart upload config for claim proof attachments
const claimUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: unifiedConfig.recoveryMaxAttachmentBytes },
});

/** POST /api/public/directory/claim/:token/proof — upload proof of ownership (multipart) */
router.post(
  '/claim/:token/proof',
  claimUpload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ success: false, error: 'token_required' });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const validation = validateAttachment({
        mimetype: req.file.mimetype,
        size: req.file.size,
        originalname: req.file.originalname,
      });
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      const result = await DirectoryClaimService.uploadProofAttachment(token, {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        size: req.file.size,
        originalname: req.file.originalname,
      });

      res.json({
        success: true,
        attachmentId: result.attachmentId,
        fileName: result.fileName,
        fileType: result.fileType,
        fileSize: result.fileSize,
      });
    } catch (error: any) {
      const msg = (error as Error).message;
      if (msg.includes('expired') || msg.includes('No pending') || msg.includes('consumed')) {
        return res.status(400).json({ success: false, error: msg });
      }
      logger.error('[POST /api/public/directory/claim/:token/proof] Error:', undefined, {
        error: { name: (error as any)?.name || 'Error', message: msg },
      });
      res.status(500).json({ success: false, error: 'Failed to upload proof' });
    }
  },
);

const socialLinkSchema = z.object({
  platform: z.string(),
  url: z.string(),
});

const claimListingUpdateSchema = z.object({
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional().or(z.literal('').transform(() => null)),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional().or(z.literal('')),
  latitude: z.number().optional().or(z.null()),
  longitude: z.number().optional().or(z.null()),
  businessHours: z.any().optional(),
  primaryCategory: z.string().optional().or(z.literal('').transform(() => null)),
  secondaryCategories: z.array(z.string()).optional(),
  notes: z.string().optional(),
  socialLinks: z.array(socialLinkSchema).optional(),
  slug: z.string().optional(),
});

/** PUT /api/public/directory/claim/:token/listing — owner pre-approval edits (token auth) */
router.put('/claim/:token/listing', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const summary = await DirectoryClaimService.getTokenSummary(token);
    if (!summary) return res.status(404).json({ error: 'token_not_found' });
    if (summary.isExpired) return res.status(410).json({ error: 'token_expired' });
    if (summary.isConsumed) return res.status(409).json({ error: 'already_claimed' });

    const validation = claimListingUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'invalid_input', details: validation.error.issues });
    }

    const data = validation.data;
    const fields: any = {};
    if (data.address !== undefined) fields.address = data.address;
    if (data.city !== undefined) fields.city = data.city;
    if (data.state !== undefined) fields.state = data.state;
    if (data.zipCode !== undefined) fields.zipCode = data.zipCode;
    if (data.phone !== undefined) fields.phone = data.phone;
    if (data.email !== undefined) fields.email = data.email || null;
    if (data.website !== undefined) fields.website = data.website || undefined;
    if (data.latitude !== undefined) fields.latitude = data.latitude;
    if (data.longitude !== undefined) fields.longitude = data.longitude;
    if (data.businessHours !== undefined) fields.businessHours = data.businessHours;
    if (data.primaryCategory !== undefined) fields.primaryCategory = data.primaryCategory;
    if (data.secondaryCategories !== undefined) fields.secondaryCategories = data.secondaryCategories;
    if (data.slug !== undefined) fields.slug = data.slug;

    if (data.slug) {
      const takenInSettings = await prisma.directory_settings_list.findFirst({
        where: { slug: data.slug, NOT: { tenant_id: summary.tenantId } },
      });
      const takenInListings = await prisma.directory_listings_list.findFirst({
        where: { slug: data.slug, NOT: { tenant_id: summary.tenantId } },
      });
      if (takenInSettings || takenInListings) {
        return res.status(409).json({ error: 'slug_taken' });
      }

      await prisma.directory_settings_list.upsert({
        where: { tenant_id: summary.tenantId },
        update: { slug: data.slug, updated_at: new Date() },
        create: {
          id: `${summary.tenantId}_settings`,
          tenant_id: summary.tenantId,
          slug: data.slug,
          updated_at: new Date(),
        },
      });
    }

    await DirectoryPresenceSeedService.updateFields(summary.seedId, fields, [], {
      actorType: 'customer',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Delegate owner-provided email/social to the canonical tenant business
    // profile, mirroring the Edit Business Profile pattern.
    const profileUpdate: any = {};
    if (data.email !== undefined) profileUpdate.email = data.email || null;
    if (data.socialLinks !== undefined) profileUpdate.social_links = data.socialLinks || [];

    if (Object.keys(profileUpdate).length > 0) {
      await prisma.tenant_business_profiles_list.upsert({
        where: { tenant_id: summary.tenantId },
        update: { ...profileUpdate, updated_at: new Date() },
        create: {
          tenant_id: summary.tenantId,
          business_name: summary.businessName || '',
          business_description: '',
          address_line1: summary.address || '',
          city: summary.city || '',
          state: summary.state || null,
          postal_code: summary.zipCode || '',
          country_code: summary.state ? 'US' : null,
          phone_number: summary.phone || null,
          website: summary.website || null,
          ...profileUpdate,
          updated_at: new Date(),
        },
      });
    }

    // Store free-form correction notes on the seed for operator review.
    if (data.notes !== undefined) {
      await prisma.$executeRaw`
        UPDATE directory_presence_seeds
        SET notes = ${data.notes || null}, updated_at = now()
        WHERE id = ${summary.seedId}
      `;
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[PUT /api/public/directory/claim/:token/listing] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/** GET /api/public/directory/claim/:token/slug-patterns — available slug patterns */
router.get('/claim/:token/slug-patterns', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const summary = await DirectoryClaimService.getTokenSummary(token);
    if (!summary) return res.status(404).json({ error: 'token_not_found' });
    if (summary.isExpired) return res.status(410).json({ error: 'token_expired' });
    if (summary.isConsumed) return res.status(409).json({ error: 'already_claimed' });

    const baseSlug = slugify(summary.businessName);
    const citySlug = summary.city ? slugify(summary.city) : '';
    const stateSlug = summary.state ? summary.state.toLowerCase() : '';

    const rawPatterns: { pattern: string; slug: string; description: string }[] = [
      { pattern: 'business_name', slug: baseSlug, description: 'Business name only (shortest, most memorable)' },
    ];

    if (citySlug) {
      rawPatterns.push({
        pattern: 'business_name_city',
        slug: `${baseSlug}-${citySlug}`,
        description: `${summary.businessName} in ${summary.city}`,
      });
    }
    if (stateSlug) {
      rawPatterns.push({
        pattern: 'business_name_state',
        slug: `${baseSlug}-${stateSlug}`,
        description: `${summary.businessName} in ${summary.state}`,
      });
    }
    if (citySlug && stateSlug) {
      rawPatterns.push({
        pattern: 'business_name_city_state',
        slug: `${baseSlug}-${citySlug}-${stateSlug}`,
        description: `${summary.businessName} in ${summary.city}, ${summary.state}`,
      });
    }

    // Always add a unique-id pattern as a guaranteed-available fallback
    const shortId = summary.tenantId.slice(-6).toLowerCase();
    rawPatterns.push({
      pattern: 'business_name_autoid',
      slug: `${baseSlug}-${shortId}`,
      description: `${summary.businessName} (unique ID)`,
    });

    const slugs = rawPatterns.map((p) => p.slug);
    const [settingsRows, listingRows] = await Promise.all([
      prisma.directory_settings_list.findMany({
        where: { slug: { in: slugs }, NOT: { tenant_id: summary.tenantId } },
        select: { slug: true, tenant_id: true },
      }),
      prisma.directory_listings_list.findMany({
        where: { slug: { in: slugs }, NOT: { tenant_id: summary.tenantId } },
        select: { slug: true, tenant_id: true },
      }),
    ]);
    const takenSlugs = new Set([
      ...settingsRows.map((r) => r.slug),
      ...listingRows.map((r) => r.slug),
    ]);

    const currentListingSlug = await prisma.directory_listings_list.findFirst({
      where: { tenant_id: summary.tenantId },
      select: { slug: true },
    });
    const ownSlug = currentListingSlug?.slug ?? undefined;

    res.json({
      success: true,
      patterns: rawPatterns.map((p) => ({
        ...p,
        isAvailable: !takenSlugs.has(p.slug),
        isOwnSlug: p.slug === ownSlug,
      })),
    });
  } catch (error: any) {
    logger.error('[GET /api/public/directory/claim/:token/slug-patterns] Error:', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
