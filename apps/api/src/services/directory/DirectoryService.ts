/**
 * DirectoryService
 *
 * Business logic for directory search, featured stores, and slug lookup.
 * Encapsulates all SQL queries so route files contain zero direct database access.
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 4.2/4.3 and
 * .agents/skills/backend-dev-guidelines (§3 Controllers Coordinate, Services Decide).
 */

import { getDirectPool } from '../../utils/db-pool';

interface SearchParams {
  q?: string;
  category?: string;
  state?: string;
  city?: string;
  tier?: string;
  min_price?: string;
  max_price?: string;
  min_quality?: string;
  featured_only?: string;
  page?: string;
  limit?: string;
}

interface FeaturedStoresParams {
  limit?: string;
  category?: string;
  state?: string;
}

class DirectoryService {
  /**
   * Search directory listings using the directory_category_products materialized view.
   * Supports full-text search, category/state/city/tier/price/quality filters.
   */
  async search(params: SearchParams): Promise<{
    query: string;
    results: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    filters: Record<string, any>;
  }> {
    const {
      q: query,
      category,
      state,
      city,
      tier,
      min_price,
      max_price,
      min_quality,
      featured_only,
      page = '1',
      limit = '20',
    } = params;

    if (!query) {
      return null as any;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'is_published = true AND actual_product_count > 0';
    const sqlParams: any[] = [];
    let paramIndex = 1;

    whereClause += ` AND to_tsvector('english', category_name || ' ' || tenant_name || ' ' || COALESCE(listing_city, '') || ' ' || COALESCE(listing_state, '') || ' ' || COALESCE(address, '')) @@ to_tsvector('english', $${paramIndex++})`;
    sqlParams.push(query);

    if (category) {
      whereClause += ` AND category_slug = $${paramIndex++}`;
      sqlParams.push(category);
    }

    if (state) {
      whereClause += ` AND state = $${paramIndex++}`;
      sqlParams.push(state);
    }

    if (city) {
      whereClause += ` AND city ILIKE $${paramIndex++}`;
      sqlParams.push(`%${city}%`);
    }

    if (tier) {
      whereClause += ` AND subscription_tier = $${paramIndex++}`;
      sqlParams.push(tier);
    }

    if (min_price) {
      whereClause += ` AND avg_price_dollars >= $${paramIndex++}`;
      sqlParams.push(parseFloat(min_price));
    }

    if (max_price) {
      whereClause += ` AND avg_price_dollars <= $${paramIndex++}`;
      sqlParams.push(parseFloat(max_price));
    }

    if (min_quality) {
      whereClause += ` AND quality_score >= $${paramIndex++}`;
      sqlParams.push(parseFloat(min_quality));
    }

    if (featured_only === 'true') {
      whereClause += ` AND is_featured = true`;
    }

    const searchQuery = `
      SELECT 
        tenant_id,
        tenant_name,
        tenant_slug,
        subscription_tier,
        city,
        state,
        category_name,
        category_slug,
        category_icon,
        actual_product_count,
        quality_score,
        rating_avg,
        rating_count,
        is_featured,
        store_tier,
        avg_price_dollars,
        recently_updated_products,
        address,
        zip_code,
        is_demo,
        demo_expires_at
      FROM directory_category_products
      WHERE ${whereClause}
      ORDER BY actual_product_count DESC, quality_score DESC, rating_avg DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const countQuery = `
      SELECT COUNT(*) as count
      FROM directory_category_products
      WHERE ${whereClause}
    `;

    const [searchResult, countResult] = await Promise.all([
      getDirectPool().query(searchQuery, [...sqlParams, limitNum, offset]),
      getDirectPool().query(countQuery, sqlParams),
    ]);

    const totalCount = parseInt(countResult.rows[0]?.count || '0');
    const totalPages = Math.ceil(totalCount / limitNum);

    return {
      query: query as string,
      results: searchResult.rows,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      filters: {
        category,
        state,
        city,
        tier,
        min_price,
        max_price,
        min_quality,
        featured_only,
      },
    };
  }

  /**
   * Get featured stores using the directory_category_products materialized view.
   */
  async getFeaturedStores(params: FeaturedStoresParams): Promise<any[]> {
    const { limit = '20', category, state } = params;
    const limitNum = parseInt(limit);

    let whereClause = 'is_published = true AND actual_product_count > 0';
    const sqlParams: any[] = [];
    let paramIndex = 1;

    if (category) {
      whereClause += ` AND category_slug = $${paramIndex++}`;
      sqlParams.push(category);
    }

    if (state) {
      whereClause += ` AND state = $${paramIndex++}`;
      sqlParams.push(state);
    }

    const query = `
      SELECT DISTINCT
        tenant_id,
        tenant_name,
        tenant_slug,
        subscription_tier,
        city,
        state,
        rating_avg,
        rating_count,
        is_featured,
        store_tier,
        quality_score,
        avg_price_dollars,
        recently_updated_products,
        address,
        zip_code,
        latitude,
        longitude,
        STRING_AGG(DISTINCT category_name, ', ') as categories,
        COUNT(*) OVER (PARTITION BY tenant_id) as category_count
      FROM directory_category_products
      WHERE ${whereClause}
      ORDER BY 
        is_featured DESC,
        rating_avg DESC,
        quality_score DESC,
        actual_product_count DESC
      LIMIT $${paramIndex++}
    `;

    const result = await getDirectPool().query(query, [...sqlParams, limitNum]);
    return result.rows;
  }

  /**
   * Get a single directory listing by slug or tenant_id.
   * Transforms raw DB row into the expected API response format.
   */
  async getListingBySlug(slug: string): Promise<any | null> {
    const pool = getDirectPool();

    const query = `
      SELECT * FROM directory_listings_list 
      WHERE (tenant_id = $1 OR slug = $1) AND is_published = true 
      LIMIT 1
    `;

    const result = await pool.query(query, [slug]);

    if (result.rows.length === 0) {
      return null;
    }

    const listing = result.rows[0];

    // Transform categories
    const categories = this.parseCategories(listing);

    return {
      id: listing.id,
      tenantId: listing.tenant_id,
      businessName: listing.business_name,
      slug: listing.slug,
      address: listing.address,
      city: listing.city,
      state: listing.state,
      zipCode: listing.zip_code,
      phone: listing.phone,
      email: listing.email,
      website: listing.website,
      latitude: listing.latitude,
      longitude: listing.longitude,
      primaryCategory: listing.primary_category,
      secondaryCategories: listing.secondary_categories,
      logoUrl: listing.logo_url,
      description: listing.description,
      businessHours: listing.business_hours,
      ratingAvg: listing.rating_avg,
      ratingCount: listing.rating_count,
      productCount: listing.product_count,
      isFeatured: listing.is_featured,
      subscriptionTier: listing.subscription_tier,
      useCustomWebsite: listing.use_custom_website,
      canUseExternalLink: (listing as any).canUseExternalLink || false,
      isPublished: listing.is_published,
      createdAt: listing.created_at,
      updatedAt: listing.updated_at,
      keywords: listing.keywords,
      categories,
    };
  }

  /**
   * Parse primary and secondary categories from a listing row into a unified array.
   */
  private parseCategories(listing: any): any[] {
    const categories: any[] = [];

    if (listing.primary_category) {
      try {
        let primary: any;
        if (typeof listing.primary_category === 'string') {
          try {
            primary = JSON.parse(listing.primary_category);
          } catch {
            primary = { name: listing.primary_category };
          }
        } else {
          primary = listing.primary_category;
        }

        if (primary && primary.name) {
          const catSlug = primary.id
            ? primary.id.replace('gcid:', '').replace(/_/g, '-')
            : primary.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');

          categories.push({
            id: primary.id || `gcid:${catSlug}`,
            name: primary.name,
            slug: catSlug,
            isPrimary: true,
          });
        }
      } catch {
        // best-effort parse
      }
    }

    if (listing.secondary_categories) {
      try {
        let secondary: any;
        if (typeof listing.secondary_categories === 'string') {
          try {
            secondary = JSON.parse(listing.secondary_categories);
          } catch {
            secondary = [listing.secondary_categories];
          }
        } else {
          secondary = listing.secondary_categories;
        }

        if (Array.isArray(secondary)) {
          secondary.forEach((cat: any) => {
            const categoryData = typeof cat === 'string' ? { name: cat } : cat;

            if (categoryData && categoryData.name) {
              const catSlug = categoryData.id
                ? categoryData.id.replace('gcid:', '').replace(/_/g, '-')
                : categoryData.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');

              categories.push({
                id: categoryData.id || `gcid:${catSlug}`,
                name: categoryData.name,
                slug: catSlug,
                isPrimary: false,
              });
            }
          });
        }
      } catch {
        // best-effort parse
      }
    }

    return categories;
  }
}

export const directoryService = new DirectoryService();
