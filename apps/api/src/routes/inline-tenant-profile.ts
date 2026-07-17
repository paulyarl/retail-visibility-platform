import { Router } from 'express';
import { z } from 'zod';
import { prisma, basePrisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

const router = Router();

// POST /api/tenant/profile
const tenantProfileSchema = z.object({
  tenant_id: z.string(),
  business_name: z.string().min(1).optional(),
  business_description: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country_code: z.string().optional(),
  phone_number: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().optional(),
  logo_url: z.string().optional(),
  banner_url: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  map_privacy_mode: z.enum(["precise", "neighborhood"]).optional(),
});
router.post("/api/tenant/profile", authenticateToken, async (req, res) => {
  const parsed = tenantProfileSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    logger.error('[POST /tenant/profile] Validation failed:', undefined, { error: { name: 'Error', message: String(parsed.error.flatten()) } });
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  try {
    const { tenant_id, ...profileData } = parsed.data;

    const existing = await prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id }
    });

    if (existing) {
      const updated = await prisma.tenant_business_profiles_list.update({
        where: { tenant_id },
        data: {
          business_name: profileData.business_name,
          business_description: profileData.business_description,
          address_line1: profileData.address_line1,
          address_line2: profileData.address_line2,
          city: profileData.city,
          state: profileData.state,
          postal_code: profileData.postal_code,
          country_code: profileData.country_code,
          phone_number: profileData.phone_number,
          email: profileData.email,
          website: profileData.website,
          logo_url: profileData.logo_url,
          banner_url: profileData.banner_url,
          latitude: profileData.latitude,
          longitude: profileData.longitude,
          map_privacy_mode: profileData.map_privacy_mode,
          updated_at: new Date(),
        }
      });
      return res.json({ success: true, profile: updated });
    } else {
      const created = await prisma.tenant_business_profiles_list.create({
        data: {
          tenant_id,
          business_name: profileData.business_name || '',
          business_description: profileData.business_description || null,
          address_line1: profileData.address_line1 || '',
          address_line2: profileData.address_line2 || null,
          city: profileData.city || '',
          state: profileData.state || null,
          postal_code: profileData.postal_code || '',
          country_code: profileData.country_code || '',
          phone_number: profileData.phone_number || null,
          email: profileData.email || null,
          website: profileData.website || null,
          logo_url: profileData.logo_url || null,
          banner_url: profileData.banner_url || null,
          latitude: profileData.latitude || null,
          longitude: profileData.longitude || null,
          map_privacy_mode: profileData.map_privacy_mode || undefined,
          updated_at: new Date(),
        }
      });
      return res.json({ success: true, profile: created });
    }
  } catch (error: any) {
    logger.error('[POST /tenant/profile] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_update_profile", details: (error as any)?.message });
  }
});

// GET /api/tenant/profile
router.get("/api/tenant/profile", authenticateToken, async (req, res) => {
  try {
    const tenant_id = (req.query.tenant_id as string) || (req.query.tenant_id as string);
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });

    const profile = await prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id }
    });

    if (!profile) {
      return res.status(404).json({ error: "profile_not_found" });
    }

    res.json(profile);
  } catch (error) {
    logger.error('[GET /tenant/profile] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_profile" });
  }
});

// PUT /api/tenant/gbp-category
router.put("/api/tenant/gbp-category", authenticateToken, async (req, res) => {
  try {
    const { tenantId, primary, secondary } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: "tenantId_required" });
    }

    const pool = getDirectPool();

    await pool.query('DELETE FROM tenant_gbp_categories WHERE tenant_id = $1', [tenantId]);

    if (primary) {
      await pool.query(
        'INSERT INTO tenant_gbp_categories (tenant_id, gbp_category_id, category_type) VALUES ($1, $2, $3)',
        [tenantId, primary, 'primary']
      );
    }

    if (secondary && Array.isArray(secondary)) {
      for (const catId of secondary) {
        await pool.query(
          'INSERT INTO tenant_gbp_categories (tenant_id, gbp_category_id, category_type) VALUES ($1, $2, $3)',
          [tenantId, catId, 'secondary']
        );
      }
    }

    res.json({ success: true, message: 'GBP categories updated' });
  } catch (error: any) {
    logger.error('[PUT /tenant/gbp-category] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_update_gbp_categories", details: (error as any)?.message });
  }
});

// GET /public/tenant/:tenant_id
router.get("/public/tenant/:tenant_id", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id },
      select: {
        id: true,
        name: true,
        slug: true,
        subscription_tier: true,
        location_status: true,
        directory_visible: true,
        metadata: true,
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: "tenant_not_found" });
    }

    res.json(tenant);
  } catch (error) {
    logger.error('[GET /public/tenant/:tenant_id] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_tenant" });
  }
});

// GET /tenant/:tenant_id/swis/preview
router.get("/tenant/:tenant_id/swis/preview", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    const limit = parseInt(req.query.limit as string) || 12;

    const items = await prisma.inventory_items.findMany({
      where: {
        tenant_id,
        item_status: 'active',
        visibility: 'public'
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        price: true,
        image_url: true,
        sku: true,
      }
    });

    res.json({ items, total: items.length });
  } catch (error) {
    logger.error('[GET /tenant/:tenant_id/swis/preview] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_swis_preview" });
  }
});

// GET /public/tenant/:tenant_id/profile
router.get("/public/tenant/:tenant_id/profile", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });

    const profile = await prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id }
    });

    if (!profile) {
      return res.status(404).json({ error: "profile_not_found" });
    }

    res.json(profile);
  } catch (error) {
    logger.error('[GET /public/tenant/:tenant_id/profile] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_profile" });
  }
});

// GET /public/tenant/:tenant_id/items
router.get("/public/tenant/:tenant_id/items", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 24;
    const offset = (page - 1) * limit;

    const items = await prisma.inventory_items.findMany({
      where: {
        tenant_id,
        item_status: 'active',
        visibility: 'public'
      },
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        image_url: true,
        description: true,
        brand: true,
        category_path: true,
      }
    });

    const total = await prisma.inventory_items.count({
      where: {
        tenant_id,
        item_status: 'active',
        visibility: 'public'
      }
    });

    res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error('[GET /public/tenant/:tenant_id/items] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_items" });
  }
});

// GET /public/tenant/:tenant_id/categories
router.get("/public/tenant/:tenant_id/categories", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });

    const { getCategoryCounts } = await import('../utils/category-counts');
    const categories = await getCategoryCounts(tenant_id as string, false);

    res.json({ categories });
  } catch (error) {
    logger.error('[GET /public/tenant/:tenant_id/categories] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_categories" });
  }
});

// GET /public/tenant/:tenant_id/payment-gateways
router.get("/public/tenant/:tenant_id/payment-gateways", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });

    const gateways = await prisma.tenant_payment_gateways.findMany({
      where: {
        tenant_id,
        is_active: true
      },
      select: {
        id: true,
        gateway_type: true,
        is_active: true,
        is_default: true,
        config: true,
      }
    });

    res.json({ gateways });
  } catch (error) {
    logger.error('[GET /public/tenant/:tenant_id/payment-gateways] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_payment_gateways" });
  }
});

// GET /public/tenant/:tenant_id/oauth-status/:gateway_type
router.get("/public/tenant/:tenant_id/oauth-status/:gateway_type", async (req, res) => {
  try {
    const { tenant_id, gateway_type } = req.params;
    if (!tenant_id || !gateway_type) {
      return res.status(400).json({ error: "tenant_id_and_gateway_type_required" });
    }

    const pool = getDirectPool();
    const result = await pool.query(
      'SELECT * FROM oauth_integrations WHERE tenant_id = $1 AND gateway_type = $2',
      [tenant_id, gateway_type]
    );

    const integration = result.rows[0];

    res.json({
      connected: !!integration,
      gateway_type,
      expires_at: integration?.expires_at || null,
    });
  } catch (error) {
    logger.error('[GET /public/tenant/:tenant_id/oauth-status/:gateway_type] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_oauth_status" });
  }
});

// GET /api/categories/tenant/:tenant_id
router.get("/api/categories/tenant/:tenant_id", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });

    const pool = getDirectPool();
    const result = await pool.query(`
      SELECT dc.id, dc.name, dc.slug, dc."isActive"
      FROM directory_category dc
      WHERE dc."tenantId" = $1 AND dc."isActive" = true
      ORDER BY dc.name
    `, [tenant_id]);

    res.json({ categories: result.rows });
  } catch (error) {
    logger.error('[GET /api/categories/tenant/:tenant_id] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_categories" });
  }
});

// GET /api/categories/product-level/:tenant_id
router.get("/api/categories/product-level/:tenant_id", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });

    const pool = getDirectPool();
    const result = await pool.query(`
      SELECT DISTINCT dc.id, dc.name, dc.slug
      FROM directory_category dc
      INNER JOIN inventory_items ii ON ii.directory_category_id = dc.id
      WHERE dc."tenantId" = $1 AND dc."isActive" = true
        AND ii.tenant_id = $1 AND ii.item_status = 'active' AND ii.visibility = 'public'
      ORDER BY dc.name
    `, [tenant_id]);

    res.json({ categories: result.rows });
  } catch (error) {
    logger.error('[GET /api/categories/product-level/:tenant_id] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_product_categories" });
  }
});

// GET /api/diagnostic/category-counts/:tenant_id
router.get("/api/diagnostic/category-counts/:tenant_id", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });

    const pool = getDirectPool();

    const rawProductsResult = await pool.query(`
      SELECT directory_category_id, COUNT(*) as total_count,
        COUNT(CASE WHEN item_status = 'active' AND visibility = 'public' THEN 1 END) as active_public_count
      FROM inventory_items WHERE tenant_id = $1
      GROUP BY directory_category_id ORDER BY directory_category_id
    `, [tenant_id]);

    const categoriesResult = await pool.query(`
      SELECT id, name, slug, "isActive", "tenantId" FROM directory_category WHERE "tenantId" = $1 ORDER BY name
    `, [tenant_id]);

    const joinCountResult = await pool.query(`
      SELECT dc.id, dc.name, dc.slug, COUNT(DISTINCT ii.id)::int as count
      FROM directory_category dc
      INNER JOIN inventory_items ii ON ii.directory_category_id = dc.id
      WHERE dc."tenantId" = $1 AND dc."isActive" = true AND ii.tenant_id = $1 AND ii.item_status = 'active' AND ii.visibility = 'public'
      GROUP BY dc.id, dc.name, dc.slug ORDER BY dc.name
    `, [tenant_id]);

    const storefrontFilterResult = await pool.query(`
      SELECT dc.id, dc.name, dc.slug, COUNT(DISTINCT ii.id)::int as count
      FROM inventory_items ii
      LEFT JOIN directory_category dc ON dc.id = ii.directory_category_id
      WHERE ii.tenant_id = $1 AND ii.item_status = 'active' AND ii.visibility = 'public' AND dc."tenantId" = $1 AND dc."isActive" = true
      GROUP BY dc.id, dc.name, dc.slug ORDER BY dc.name
    `, [tenant_id]);

    const invalidCategoriesResult = await pool.query(`
      SELECT COUNT(*) as count, array_agg(DISTINCT directory_category_id) as invalid_category_ids
      FROM inventory_items WHERE tenant_id = $1 AND directory_category_id IS NOT NULL
        AND directory_category_id NOT IN (SELECT id FROM directory_category WHERE "tenantId" = $1)
    `, [tenant_id]);

    let mvResult = null;
    try {
      mvResult = await pool.query(`
        SELECT category_id, category_name, category_slug, product_count
        FROM storefront_category_counts WHERE tenant_id = $1 AND category_type = 'tenant' ORDER BY category_name
      `, [tenant_id]);
    } catch (mvError) {
      console.log('Materialized view not accessible:', (mvError as Error)?.message || 'Unknown error');
    }

    const diagnostic = {
      tenant_id,
      timestamp: new Date().toISOString(),
      raw_products: rawProductsResult.rows,
      categories: categoriesResult.rows,
      join_counts: joinCountResult.rows,
      storefront_filter_counts: storefrontFilterResult.rows,
      invalid_categories: invalidCategoriesResult.rows[0],
      materialized_view: mvResult?.rows || null,
      summary: {
        total_raw_products: rawProductsResult.rows.reduce((sum, r) => sum + parseInt(r.total_count), 0),
        total_active_public: rawProductsResult.rows.reduce((sum, r) => sum + parseInt(r.active_public_count), 0),
        total_categories: categoriesResult.rows.length,
        total_with_valid_categories: joinCountResult.rows.reduce((sum, r) => sum + parseInt(r.count), 0),
        has_invalid_categories: invalidCategoriesResult.rows[0].count > 0
      }
    };

    res.json({ success: true, data: diagnostic });
  } catch (e: any) {
    logger.error("[Diagnostic] Error:", undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    return res.status(500).json({ error: "diagnostic_failed", message: e.message });
  }
});

// GET /api/categories/store-level/:tenant_id
router.get("/api/categories/store-level/:tenant_id", async (req, res) => {
  try {
    const { tenant_id } = req.params;
    if (!tenant_id) return res.status(400).json({ error: "tenant_required" });

    const pool = getDirectPool();

    const query = `
      SELECT gc.id, gc.name, gc.display_name, tgc.category_type, tgc.gbp_category_id,
        CASE WHEN tgc.category_type = 'primary' THEN true ELSE false END as is_primary,
        (SELECT COUNT(*) FROM inventory_items WHERE tenant_id = $1 AND item_status = 'active' AND visibility = 'public') as count
      FROM tenant_gbp_categories tgc
      INNER JOIN gbp_categories_list gc ON gc.id = tgc.gbp_category_id
      WHERE tgc.tenant_id = $1 AND tgc.category_type IN ('primary', 'secondary') AND gc.is_active = true
      ORDER BY CASE WHEN tgc.category_type = 'primary' THEN 0 ELSE 1 END, gc.display_name ASC
    `;

    const result = await pool.query(query, [tenant_id]);

    const storeCategories = result.rows.map((row: any) => ({
      id: row.id,
      name: row.display_name || row.name,
      slug: row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category_type: row.category_type === 'primary' ? 'gbp_primary' : 'gbp_secondary',
      is_primary: row.is_primary,
      gbp_category_id: row.gbp_category_id,
      count: parseInt(row.count) || 0
    }));

    const cleanResponse = {
      success: true,
      data: {
        tenant_id: tenant_id,
        categories: storeCategories,
        summary: {
          total_categories: storeCategories.length,
          total_products: storeCategories.length > 0 ? storeCategories[0].count : 0,
          category_type: 'store-level'
        }
      }
    };

    const jsonString = JSON.stringify(cleanResponse);
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);
  } catch (e: any) {
    logger.error("[GET /api/categories/store-level/:tenant_id] Error:", undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    return res.status(500).json({ error: "failed_to_get_store_categories" });
  }
});

// POST /public/debug-query
router.post("/public/debug-query", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "query_required" });
    }

    const pool = getDirectPool();
    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows,
      rowCount: result.rowCount,
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    logger.error('[POST /public/debug-query] Error:', undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    return res.status(500).json({ error: "failed_to_execute_query", details: e.message });
  }
});

// POST /public/refresh-materialized-views
router.post("/public/refresh-materialized-views", async (req, res) => {
  try {
    const pool = getDirectPool();
    await pool.query('REFRESH MATERIALIZED VIEW storefront_category_counts');

    res.json({
      success: true,
      message: 'Materialized views refreshed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    logger.error('[POST /public/refresh-materialized-views] Error:', undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    return res.status(500).json({ error: "failed_to_refresh_views", details: e.message });
  }
});

// GET /public/google-taxonomy/:categoryId
router.get("/public/google-taxonomy/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;
    if (!categoryId) return res.status(400).json({ error: "category_id_required" });

    const { getCategoryById } = await import('../lib/google/taxonomy');
    const category = getCategoryById(categoryId);

    if (!category) {
      return res.status(400).json({ error: "category_not_found" });
    }

    res.json(category);
  } catch (e: any) {
    logger.error("[GET /public/google-taxonomy/:categoryId] Error:", undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    return res.status(500).json({ error: "failed_to_get_category" });
  }
});

// GET /api/tenants/:tenant_id/categories
router.get("/api/tenants/:tenant_id/categories", authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.params;

    const { getCategoryCounts, getUncategorizedCount, getTotalProductCount } = await import('../utils/category-counts');

    const categories = await getCategoryCounts(tenant_id as string, true);
    const uncategorizedCount = await getUncategorizedCount(tenant_id as string, true);
    const totalCount = await getTotalProductCount(tenant_id as string, true);

    res.json({ categories, uncategorizedCount, totalCount });
  } catch (e: any) {
    logger.error("[GET /api/tenants/:tenant_id/categories] Error:", undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    return res.status(500).json({ error: "failed_to_get_categories" });
  }
});

export default router;
