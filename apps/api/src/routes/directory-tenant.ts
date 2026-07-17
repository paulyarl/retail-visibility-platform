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
import { logger } from '../logger';

const router = Router();

// Validation schemas
const updateListingSchema = z.object({
  seo_description: z.string().max(500).optional(),
  seo_keywords: z.array(z.string()).max(10).optional(),
  primary_category: z.string().optional(),
  secondary_categories: z.array(z.string()).max(5).optional(),
  is_featured: z.boolean().optional(),
  featured_until: z.string().datetime().optional(),
});

/**
 * GET /api/tenants/:id/directory/listing
 * Get directory listing for a tenant
 */
router.get('/:id/directory/listing', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id: tenantId } = req.params;

    // Get or create directory settings
    let settings = await prisma.directory_settings_list.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!settings) {
      // Auto-create settings from business profile
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        include: { tenant_business_profiles_list: true },
      });

      if (!tenant) {
        return res.status(404).json({ error: 'tenant_not_found' });
      }

      // Generate slug from business name
      const businessName = tenant.tenant_business_profiles_list?.business_name || tenant.name;
      const baseSlug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Ensure unique slug
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.directory_settings_list.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      settings = await prisma.directory_settings_list.upsert({
        where: { id: tenantId },
        update: {
          slug,
          updated_at: new Date(),
        },
        create: {
          id: tenantId,
          tenant_id: tenantId,
          slug,
          is_published: false,
          updated_at: new Date(),
        },
      });
    }

    // Check if currently featured
    const activeFeatured = await prisma.directory_featured_listings_list.findFirst({
      where: {
        tenant_id: tenantId,
        featured_until: { gt: new Date() },
      },
      orderBy: { featured_from: 'desc' },
    });

    // Get business profile for preview
    const businessProfile = await prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id: tenantId },
    });

    // If published, get the actual slug from the published listing
    let actualSlug = settings.slug;
    if (settings.is_published) {
      const pool = getDirectPool();
      const publishedListing = await pool.query(
        'SELECT slug FROM directory_listings_list WHERE tenant_id = $1 AND is_published = true LIMIT 1',
        [tenantId]
      );
      if (publishedListing.rows.length > 0) {
        actualSlug = publishedListing.rows[0].slug;
      }
    }

    // Transform snake_case to camelCase for frontend
    return res.json({
      id: settings.id,
      tenantId: settings.tenant_id,
      isPublished: settings.is_published,
      seoDescription: settings.seo_description,
      seoKeywords: settings.seo_keywords,
      primaryCategory: settings.primary_category,
      secondaryCategories: settings.secondary_categories,
      slug: actualSlug,
      createdAt: settings.created_at,
      updatedAt: settings.updated_at,
      isFeatured: !!activeFeatured,
      featuredUntil: activeFeatured?.featured_until,
      businessProfile: businessProfile ? {
        businessName: businessProfile.business_name,
        city: businessProfile.city,
        state: businessProfile.state,
        logoUrl: businessProfile.logo_url,
      } : undefined,
    });
  } catch (error: any) {
    logger.error('[GET /tenants/:id/directory/listing] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_get_listing' });
  }
});

/**
 * PATCH /api/tenants/:id/directory/listing
 * Update directory listing settings
 */
router.patch('/:id/directory/listing', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  // console.log('[PATCH /tenants/:id/directory/listing] ===== REQUEST RECEIVED =====');
  // console.log('[PATCH /tenants/:id/directory/listing] Tenant ID:', req.params.id);
  // console.log('[PATCH /tenants/:id/directory/listing] User:', req.user?.userId);
  // console.log('[PATCH /tenants/:id/directory/listing] Body:', JSON.stringify(req.body, null, 2));
  // console.log('[PATCH /tenants/:id/directory/listing] Headers:', {
  //   'content-type': req.headers['content-type'],
  //   'authorization': req.headers.authorization ? 'PRESENT' : 'MISSING',
  //   'x-csrf-token': req.headers['x-csrf-token'] ? 'PRESENT' : 'MISSING',
  //   'x-tenant-id': req.headers['x-tenant-id']
  // });
  try {
    const { id: tenantId } = req.params;
    
    // Extract only the snake_case fields we need (ignore camelCase duplicates)
    const cleanBody = {
      seo_description: req.body.seo_description,
      seo_keywords: req.body.seo_keywords,
      primary_category: req.body.primary_category,
      secondary_categories: req.body.secondary_categories,
      is_featured: req.body.is_featured,
      featured_until: req.body.featured_until,
    };
    
    const parsed = updateListingSchema.safeParse(cleanBody);

    if (!parsed.success) {
      logger.error('[PATCH /tenants/:id/directory/listing] Validation failed:', undefined, { error: { name: 'Error', message: String(parsed.error.flatten()) } });
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    // console.log('[PATCH /tenants/:id/directory/listing] Validation passed. Parsed data:', JSON.stringify(parsed.data, null, 2));
    // console.log('[PATCH /tenants/:id/directory/listing] About to upsert...');

    const updated = await prisma.directory_settings_list.upsert({
      where: { tenant_id: tenantId },
      update: {
        seo_description: parsed.data.seo_description,
        seo_keywords: parsed.data.seo_keywords,
        primary_category: parsed.data.primary_category,
        secondary_categories: parsed.data.secondary_categories,
        updated_at: new Date(),
      },
      create: {
        id: tenantId,
        tenant_id: tenantId,
        seo_description: parsed.data.seo_description,
        seo_keywords: parsed.data.seo_keywords,
        primary_category: parsed.data.primary_category,
        secondary_categories: parsed.data.secondary_categories,
        updated_at: new Date(),
      },
    });

    console.log('[PATCH /tenants/:id/directory/listing] Upsert completed successfully. Updated record:', JSON.stringify(updated, null, 2));
    
    const pool = getDirectPool();
    
    // Sync categories to directory_listing_categories table for materialized view
    if (parsed.data.primary_category || parsed.data.secondary_categories) {
      
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
    
    // Also update directory_listings_list if the listing is published
    // This ensures the public directory page reflects the changes immediately
    await pool.query(`
      UPDATE directory_listings_list
      SET 
        primary_category = $2,
        secondary_categories = $3,
        description = $4,
        is_featured = $5,
        updated_at = NOW()
      WHERE tenant_id = $1 AND is_published = true
    `, [
      tenantId,
      parsed.data.primary_category || null,
      parsed.data.secondary_categories || null,
      parsed.data.seo_description || null,
      parsed.data.is_featured || false
    ]);
    console.log('[PATCH /tenants/:id/directory/listing] Updated directory_listings_list');
    
    // Refresh directory_gbp_listings materialized view to sync featured status
    // This ensures the featured stores API reflects the changes immediately
    try {
      await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_listings');
      console.log('[PATCH /tenants/:id/directory/listing] Refreshed directory_gbp_listings MV');
    } catch (mvError: any) {
      // If concurrent refresh fails, try non-concurrent
      if (mvError?.code === '55000') {
        console.warn('[PATCH /tenants/:id/directory/listing] Concurrent MV refresh failed, trying blocking refresh');
        await pool.query('REFRESH MATERIALIZED VIEW directory_gbp_listings');
        console.log('[PATCH /tenants/:id/directory/listing] Refreshed directory_gbp_listings MV (blocking)');
      } else {
        logger.error('[PATCH /tenants/:id/directory/listing] MV refresh failed:', undefined, { error: { name: (mvError as any)?.name || 'Error', message: (mvError as any)?.message || String(mvError), stack: (mvError as any)?.stack } });
        // Don't fail the request for MV refresh errors
      }
    }
    
    // Refresh materialized view to reflect category changes in directory
    try {
      await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_products');
      console.log('[PATCH /tenants/:id/directory/listing] Refreshed directory_category_products MV');
    } catch (mvError: any) {
      // If concurrent refresh fails, try non-concurrent
      if (mvError?.code === '55000') {
        console.warn('[PATCH /tenants/:id/directory/listing] Concurrent MV refresh failed, trying blocking refresh');
        await pool.query('REFRESH MATERIALIZED VIEW directory_category_products');
        console.log('[PATCH /tenants/:id/directory/listing] Refreshed directory_category_products MV (blocking)');
      } else {
        logger.error('[PATCH /tenants/:id/directory/listing] MV refresh failed:', undefined, { error: { name: (mvError as any)?.name || 'Error', message: (mvError as any)?.message || String(mvError), stack: (mvError as any)?.stack } });
        // Don't fail the request for MV refresh errors
      }
    }
    
    // Refresh directory_gbp_stats MV to ensure featured stores API works
    try {
      await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY directory_gbp_stats');
      console.log('[PATCH /tenants/:id/directory/listing] Refreshed directory_gbp_stats MV');
    } catch (mvError: any) {
      // If concurrent refresh fails, try non-concurrent
      if (mvError?.code === '55000') {
        console.warn('[PATCH /tenants/:id/directory/listing] Concurrent GBP stats MV refresh failed, trying blocking refresh');
        await pool.query('REFRESH MATERIALIZED VIEW directory_gbp_stats');
        console.log('[PATCH /tenants/:id/directory/listing] Refreshed directory_gbp_stats MV (blocking)');
      } else {
        logger.error('[PATCH /tenants/:id/directory/listing] GBP stats MV refresh failed:', undefined, { error: { name: (mvError as any)?.name || 'Error', message: (mvError as any)?.message || String(mvError), stack: (mvError as any)?.stack } });
        // Don't fail the request for MV refresh errors
      }
    }
    
    // Return the updated record
    return res.json(updated);
  } catch (error: any) {
    logger.error('[PATCH /tenants/:id/directory/listing] ===== ERROR =====', undefined);
    logger.error('[PATCH /tenants/:id/directory/listing] Error details:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    logger.error('[PATCH /tenants/:id/directory/listing] Error message:', undefined, { error: { name: 'Error', message: String(error.message) } });
    logger.error('[PATCH /tenants/:id/directory/listing] Error stack:', undefined, { error: { name: 'Error', message: String(error.stack) } });
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
    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // if (tenant.subscription_tier === 'google_only') {
    //   return res.status(403).json({ error: 'directory_not_available_for_tier' });
    // }

    // Verify business profile is complete enough
    const profile = await prisma.tenant_business_profiles_list.findUnique({ where: { tenant_id: tenantId } });
    
    // Check required fields and provide specific error messages
    const missingFields = [];
    if (!profile?.business_name) missingFields.push('business name');
    if (!profile?.city) missingFields.push('city');
    if (!profile?.state) missingFields.push('state');
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'incomplete_profile',
        message: `Missing required fields: ${missingFields.join(', ')}. Please update your business profile.`
      });
    }

    // Update directory settings
    const updated = await prisma.directory_settings_list.upsert({
      where: { tenant_id: tenantId },
      update: { is_published: true, updated_at: new Date() },
      create: { 
        id: tenantId,
        tenant_id: tenantId, 
        is_published: true,
        updated_at: new Date(),
      },
    });

    // Also create/update the directory listing record
    // This is what actually shows up in the directory search
    await getDirectPool().query(`
      INSERT INTO directory_listings_list (
        id, tenant_id, business_name, slug, address, city, state, zip_code,
        phone, email, website, latitude, longitude, primary_category,
        secondary_categories, logo_url, description, keywords, is_published,
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
        -- Use Platform Directory Categories from directory settings instead of GBP categories
        ds.primary_category as primary_category,
        ds.secondary_categories as secondary_categories,
        bp.logo_url,
        ds.seo_description as description,
        ds.seo_keywords as keywords,
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
        keywords = EXCLUDED.keywords,
        business_hours = EXCLUDED.business_hours,
        is_published = true,
        subscription_tier = EXCLUDED.subscription_tier,
        updated_at = NOW()
    `, [tenantId]);

    return res.json({ success: true, listing: updated });
  } catch (error: any) {
    logger.error('[POST /tenants/:id/directory/publish] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_publish' });
  }
});

/**
 * POST /api/tenants/:id/directory/sync-profile
 * Sync profile data (logo, business name, etc.) to directory_listings_list
 */
router.post('/:id/directory/sync-profile', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id: tenantId } = req.params;
    
    console.log('[POST /tenants/:id/directory/sync-profile] Syncing profile data for tenant:', tenantId);
    
    // Check if directory listing exists and is published
    const existingListing = await getDirectPool().query(
      'SELECT id FROM directory_listings_list WHERE tenant_id = $1',
      [tenantId]
    );
    
    if (existingListing.rows.length === 0) {
      return res.status(404).json({ error: 'no_directory_listing', message: 'No directory listing found to sync' });
    }
    
    // Sync profile data to directory_listings_list
    const result = await getDirectPool().query(`
      UPDATE directory_listings_list dll
      SET 
        business_name = COALESCE(bp.business_name, t.name),
        address = bp.address_line1,
        city = bp.city,
        state = bp.state,
        zip_code = bp.postal_code,
        phone = bp.phone_number,
        email = bp.email,
        website = bp.website,
        latitude = bp.latitude,
        longitude = bp.longitude,
        logo_url = bp.logo_url,
        business_hours = bp.hours,
        updated_at = NOW()
      FROM tenants t
      LEFT JOIN tenant_business_profiles_list bp ON bp.tenant_id = t.id
      WHERE dll.tenant_id = $1 AND t.id = $1
      RETURNING dll.logo_url, dll.business_name
    `, [tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(500).json({ error: 'sync_failed', message: 'Failed to sync profile data' });
    }
    
    console.log('[POST /tenants/:id/directory/sync-profile] Synced profile data:', result.rows[0]);
    
    return res.json({ 
      success: true, 
      message: 'Profile data synced to directory listing',
      syncedData: {
        businessName: result.rows[0].business_name,
        logoUrl: result.rows[0].logo_url
      }
    });
  } catch (error: any) {
    logger.error('[POST /tenants/:id/directory/sync-profile] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_sync_profile', message: error.message });
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
    logger.error('[POST /tenants/:id/directory/refresh] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    const updated = await prisma.directory_settings_list.update({
      where: { tenant_id: tenantId },
      data: { is_published: false, updated_at: new Date() },
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
    logger.error('[POST /tenants/:id/directory/unpublish] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_unpublish' });
  }
});

/**
 * GET /api/tenants/:id/directory/quality-check
 * Self-service quality check for a tenant's own directory listing
 */
router.get('/:id/directory/quality-check', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {
  try {
    const { id: tenantId } = req.params;

    const profile = await prisma.tenant_business_profiles_list.findUnique({ where: { tenant_id: tenantId } });
    const settings = await prisma.directory_settings_list.findUnique({ where: { tenant_id: tenantId } });
    const itemCount = await prisma.inventory_items.count({
      where: { tenant_id: tenantId, item_status: 'active' },
    });

    const checks = {
      business_name: !!profile?.business_name,
      address: !!profile?.address_line1,
      cityState: !!(profile?.city && profile?.state),
      phone: !!profile?.phone_number,
      email: !!profile?.email,
      website: !!profile?.website,
      logo: !!profile?.logo_url,
      hours: !!profile?.hours,
      description: !!(settings?.seo_description && settings.seo_description.length > 100),
      category: !!settings?.primary_category,
      hasItems: itemCount > 0,
      hasMultipleItems: itemCount > 10,
    };

    const completedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const completenessPercent = Math.round((completedChecks / totalChecks) * 100);

    const recommendations: string[] = [];
    if (!checks.business_name) recommendations.push('Add business name');
    if (!checks.address) recommendations.push('Add street address');
    if (!checks.cityState) recommendations.push('Add city and state');
    if (!checks.phone) recommendations.push('Add phone number for better local SEO');
    if (!checks.email) recommendations.push('Add email address');
    if (!checks.website) recommendations.push('Add website URL');
    if (!checks.logo) recommendations.push('Upload business logo');
    if (!checks.hours) recommendations.push('Add business hours');
    if (!checks.description) recommendations.push('Add detailed description (150+ words)');
    if (!checks.category) recommendations.push('Select primary category');
    if (!checks.hasItems) recommendations.push('Add products to showcase');
    if (!checks.hasMultipleItems) recommendations.push('Add more products (10+ recommended)');

    return res.json({
      completenessPercent,
      checks,
      recommendations,
      itemCount,
      canPublish: checks.business_name && checks.cityState && checks.category,
    });
  } catch (error: any) {
    logger.error('[GET /tenants/:id/directory/quality-check] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_check_quality' });
  }
});

export default router;
