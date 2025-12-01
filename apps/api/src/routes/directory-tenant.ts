/**
 * Directory Tenant Routes
 * Tenant-facing directory listing management
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { z } from 'zod';
import { getDirectPool } from '../utils/db-pool';

const router = Router();

// Validation schemas
const updateListingSchema = z.object({
  seo_description: z.string().max(500).optional(),
  seo_keywords: z.array(z.string()).max(10).optional(),
  primary_category: z.string().optional(),
  secondary_categories: z.array(z.string()).max(5).optional(),
});

/**
 * GET /api/tenants/:id/directory/listing
 * Get directory listing for a tenant
 */
router.get('/:id/directory/listing', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id: tenantId } = req.params;

    // Get or create directory settings
    let settings = await prisma.directorySettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      // Auto-create settings from business profile
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { tenantBusinessProfile: true },
      });

      if (!tenant) {
        return res.status(404).json({ error: 'tenant_not_found' });
      }

      // Generate slug from business name
      const businessName = tenant.tenantBusinessProfile?.businessName || tenant.name;
      const baseSlug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Ensure unique slug
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.directorySettings.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      settings = await prisma.directorySettings.upsert({
        where: { id: `dir_${tenantId}` },
        update: {
          slug,
          updatedAt: new Date(),
        },
        create: {
          id: `dir_${tenantId}`,
          tenantId,
          slug,
          isPublished: false,
          updatedAt: new Date(),
        },
      });
    }

    // Check if currently featured
    const activeFeatured = await prisma.directoryFeaturedListings.findFirst({
      where: {
        tenantId,
        featuredUntil: { gt: new Date() },
      },
      orderBy: { featuredFrom: 'desc' },
    });

    // Get business profile for preview
    const businessProfile = await prisma.tenantBusinessProfile.findUnique({
      where: { tenantId },
    });

    return res.json({
      ...settings,
      isFeatured: !!activeFeatured,
      featuredUntil: activeFeatured?.featuredUntil,
      businessProfile,
    });
  } catch (error: any) {
    console.error('[GET /tenants/:id/directory/listing] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_listing' });
  }
});

/**
 * PATCH /api/tenants/:id/directory/listing
 * Update directory listing settings
 */
router.patch('/:id/directory/listing', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  console.log('[PATCH /tenants/:id/directory/listing] ===== REQUEST RECEIVED =====');
  console.log('[PATCH /tenants/:id/directory/listing] Tenant ID:', req.params.id);
  console.log('[PATCH /tenants/:id/directory/listing] User:', req.user?.userId);
  console.log('[PATCH /tenants/:id/directory/listing] Body:', JSON.stringify(req.body, null, 2));
  console.log('[PATCH /tenants/:id/directory/listing] Headers:', {
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'PRESENT' : 'MISSING',
    'x-csrf-token': req.headers['x-csrf-token'] ? 'PRESENT' : 'MISSING',
    'x-tenant-id': req.headers['x-tenant-id']
  });
  try {
    const { id: tenantId } = req.params;
    
    // Extract only the snake_case fields we need (ignore camelCase duplicates)
    const cleanBody = {
      seo_description: req.body.seo_description,
      seo_keywords: req.body.seo_keywords,
      primary_category: req.body.primary_category,
      secondary_categories: req.body.secondary_categories,
    };
    
    const parsed = updateListingSchema.safeParse(cleanBody);

    if (!parsed.success) {
      console.error('[PATCH /tenants/:id/directory/listing] Validation failed:', parsed.error.flatten());
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    console.log('[PATCH /tenants/:id/directory/listing] Validation passed. Parsed data:', JSON.stringify(parsed.data, null, 2));
    console.log('[PATCH /tenants/:id/directory/listing] About to upsert...');

    const updated = await prisma.directorySettings.upsert({
      where: { tenantId },
      update: {
        seoDescription: parsed.data.seo_description,
        seoKeywords: parsed.data.seo_keywords,
        primaryCategory: parsed.data.primary_category,
        secondaryCategories: parsed.data.secondary_categories,
        updatedAt: new Date(),
      },
      create: {
        id: `dir_${tenantId}`,
        tenantId,
        seoDescription: parsed.data.seo_description,
        seoKeywords: parsed.data.seo_keywords,
        primaryCategory: parsed.data.primary_category,
        secondaryCategories: parsed.data.secondary_categories,
        updatedAt: new Date(),
      },
    });

    console.log('[PATCH /tenants/:id/directory/listing] Upsert completed successfully. Updated record:', JSON.stringify(updated, null, 2));
    
    // Sync categories to directory_listing_categories table for materialized view
    if (parsed.data.primary_category || parsed.data.secondary_categories) {
      const pool = getDirectPool();
      
      // Delete existing category associations
      await pool.query(
        'DELETE FROM directory_listing_categories WHERE listing_id = $1',
        [tenantId]
      );
      
      // Find platform category IDs by slug/name
      const categories = [
        ...(parsed.data.primary_category ? [{ name: parsed.data.primary_category, isPrimary: true }] : []),
        ...(parsed.data.secondary_categories || []).map(name => ({ name, isPrimary: false }))
      ];
      
      for (const cat of categories) {
        // Find category by slug or name
        const categoryResult = await pool.query(
          `SELECT id FROM platform_categories 
           WHERE slug = $1 OR name = $1 
           LIMIT 1`,
          [cat.name]
        );
        
        if (categoryResult.rows.length > 0) {
          const categoryId = categoryResult.rows[0].id;
          
          // Insert into directory_listing_categories
          await pool.query(
            `INSERT INTO directory_listing_categories (listing_id, category_id, is_primary)
             VALUES ($1, $2, $3)
             ON CONFLICT (listing_id, category_id) DO UPDATE
             SET is_primary = EXCLUDED.is_primary`,
            [tenantId, categoryId, cat.isPrimary]
          );
        }
      }
      
      console.log('[PATCH /tenants/:id/directory/listing] Synced categories to directory_listing_categories');
    }
    
    return res.json(updated);
  } catch (error: any) {
    console.error('[PATCH /tenants/:id/directory/listing] ===== ERROR =====');
    console.error('[PATCH /tenants/:id/directory/listing] Error details:', error);
    console.error('[PATCH /tenants/:id/directory/listing] Error message:', error.message);
    console.error('[PATCH /tenants/:id/directory/listing] Error stack:', error.stack);
    return res.status(500).json({ error: 'failed_to_update_listing' });
  }
});

/**
 * POST /api/tenants/:id/directory/publish
 * Publish listing to directory
 */
router.post('/:id/directory/publish', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id: tenantId } = req.params;

    // Check tier access (google_only doesn't get directory)
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    if (tenant.subscriptionTier === 'google_only') {
      return res.status(403).json({ error: 'directory_not_available_for_tier' });
    }

    // Verify business profile is complete enough
    const profile = await prisma.tenantBusinessProfile.findUnique({ where: { tenantId } });
    if (!profile || !profile.businessName || !profile.city || !profile.state) {
      return res.status(400).json({ 
        error: 'incomplete_profile',
        message: 'Business name, city, and state are required to publish to directory'
      });
    }

    // Update directory settings
    const updated = await prisma.directorySettings.upsert({
      where: { tenantId },
      update: { isPublished: true, updatedAt: new Date() },
      create: { 
        id: `dir_${tenantId}`,
        tenantId, 
        isPublished: true,
        updatedAt: new Date(),
      },
    });

    // Also create/update the directory listing record
    // This is what actually shows up in the directory search
    await getDirectPool().query(`
      INSERT INTO directory_listings_list (
        id, tenant_id, business_name, slug, address, city, state, zip_code,
        phone, email, website, latitude, longitude, primary_category,
        secondary_categories, logo_url, description, is_published,
        subscription_tier, product_count, rating_avg, rating_count,
        business_hours, created_at, updated_at
      )
      SELECT 
        t.id,
        t.id as tenant_id,
        COALESCE(bp.business_name, t.name) as business_name,
        COALESCE(ds.slug, t.slug) as slug,
        bp.address_line1 as address,
        bp.city,
        bp.state,
        bp.postal_code as zip_code,
        bp.phone_number as phone,
        bp.email,
        bp.website,
        bp.latitude,
        bp.longitude,
        -- Use Platform Directory Categories instead of GBP categories
        COALESCE(
          (SELECT dc.name FROM directory_categories_list dc 
           WHERE dc.tenant_id = t.id AND dc.is_active = true 
           ORDER BY dc.sort_order ASC LIMIT 1), 
          'Uncategorized'
        ) as primary_category,
        COALESCE(
          ARRAY(
            SELECT dc.name FROM directory_categories_list dc 
            WHERE dc.tenant_id = t.id AND dc.is_active = true 
            ORDER BY dc.sort_order ASC OFFSET 1
          ),
          ARRAY[]::text[]
        ) as secondary_categories,
        bp.logo_url,
        ds.seo_description as description,
        true as is_published,
        t.subscription_tier,
        COALESCE((SELECT COUNT(*) FROM inventory_items WHERE tenant_id = t.id AND item_status = 'active'), 0) as product_count,
        0.0 as rating_avg,
        0 as rating_count,
        bp.hours as business_hours,
        NOW() as created_at,
        NOW() as updated_at
      FROM tenants t
      LEFT JOIN tenant_business_profiles_list bp ON bp.tenant_id = t.id
      LEFT JOIN directory_settings_list ds ON ds.tenant_id = t.id
      WHERE t.id = $1
      ON CONFLICT (id) DO UPDATE SET
        business_name = EXCLUDED.business_name,
        slug = EXCLUDED.slug,
        address = EXCLUDED.address,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        zip_code = EXCLUDED.zip_code,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        website = EXCLUDED.website,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        primary_category = EXCLUDED.primary_category,
        secondary_categories = EXCLUDED.secondary_categories,
        logo_url = EXCLUDED.logo_url,
        description = EXCLUDED.description,
        business_hours = EXCLUDED.business_hours,
        is_published = true,
        subscription_tier = EXCLUDED.subscription_tier,
        updated_at = NOW()
    `, [tenantId]);

    return res.json({ success: true, listing: updated });
  } catch (error: any) {
    console.error('[POST /tenants/:id/directory/publish] Error:', error);
    return res.status(500).json({ error: 'failed_to_publish' });
  }
});

/**
 * POST /api/tenants/:id/directory/refresh
 * Manually refresh materialized views for this tenant
 */
router.post('/:id/directory/refresh', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id: tenantId } = req.params;
    
    console.log('[POST /tenants/:id/directory/refresh] Manually refreshing materialized views...');
    
    // Force refresh of materialized views (bypasses debounce)
    const pool = getDirectPool();
    
    // Product category views
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_listings');
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stats');
    
    // GBP category views
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_listings');
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_stats');
    
    console.log('[POST /tenants/:id/directory/refresh] All materialized views refreshed successfully');
    
    return res.json({ 
      success: true, 
      message: 'Directory materialized views refreshed',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[POST /tenants/:id/directory/refresh] Error:', error);
    return res.status(500).json({ error: 'failed_to_refresh_views', message: error.message });
  }
});

/**
 * POST /api/tenants/:id/directory/unpublish
 * Remove listing from directory
 */
router.post('/:id/directory/unpublish', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id: tenantId } = req.params;

    // Update directory settings
    const updated = await prisma.directorySettings.update({
      where: { tenantId },
      data: { isPublished: false, updatedAt: new Date() },
    });

    // Also update the directory listing to unpublish it
    await getDirectPool().query(
      `UPDATE directory_listings_list
       SET is_published = false, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId]
    );

    return res.json({ success: true, listing: updated });
  } catch (error: any) {
    console.error('[POST /tenants/:id/directory/unpublish] Error:', error);
    return res.status(500).json({ error: 'failed_to_unpublish' });
  }
});

export default router;
