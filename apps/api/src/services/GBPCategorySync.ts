/**
 * GBP Category Sync Service
 * 
 * Handles syncing Google Business Profile categories to directory listings
 * - Maps GBP category IDs to platform categories
 * - Updates directory_listing_categories table
 * - Refreshes materialized views
 * - Tracks sync status in tenant metadata
 */

import { Pool, PoolClient } from 'pg';
import { getDirectPool } from '../utils/db-pool';

interface GBPCategory {
  id: string;
  name: string;
  platformCategoryId?: string;
}

interface GBPCategories {
  primary: GBPCategory;
  secondary: GBPCategory[];
}

interface GBPCategoryMapping {
  gbp_category_id: string;
  gbp_category_name: string;
  platform_category_id: string | null;
  mapping_confidence: string;
}

interface SyncResult {
  success: boolean;
  syncedCategories: number;
  unmappedCategories: string[];
  error?: string;
}

export class GBPCategorySyncService {
  private pool: Pool;

  constructor(pool?: Pool) {
    // Use centralized singleton pool by default, allow injection for testing
    this.pool = pool || getDirectPool();
  }

  /**
   * Get GBP category mappings for given category IDs
   */
  async getGBPMappings(gbpCategoryIds: string[]): Promise<GBPCategoryMapping[]> {
    if (gbpCategoryIds.length === 0) {
      return [];
    }

    const query = `
      SELECT 
        gbp_category_id,
        gbp_category_name,
        platform_category_id,
        mapping_confidence
      FROM gbp_category_mappings
      WHERE gbp_category_id = ANY($1)
        AND is_active = true
      ORDER BY 
        CASE mapping_confidence
          WHEN 'exact' THEN 1
          WHEN 'close' THEN 2
          WHEN 'suggested' THEN 3
          WHEN 'manual' THEN 4
        END
    `;

    const result = await this.pool.query(query, [gbpCategoryIds]);
    return result.rows;
  }

  /**
   * Get or create directory listing for a tenant
   */
  async getOrCreateDirectoryListing(tenantId: string, client?: PoolClient): Promise<string> {
    const db = client || this.pool;

    // Check if listing exists
    const checkQuery = `
      SELECT id 
      FROM directory_listings_list 
      WHERE tenant_id = $1 
      LIMIT 1
    `;

    const checkResult = await db.query(checkQuery, [tenantId]);

    if (checkResult.rows.length > 0) {
      return checkResult.rows[0].id;
    }

    // Get tenant info to create listing
    const tenantQuery = `
      SELECT 
        business_name,
        address,
        city,
        state,
        zip_code,
        phone,
        email,
        website,
        latitude,
        longitude,
        logo_url,
        description
      FROM tenants
      WHERE id = $1
    `;

    const tenantResult = await db.query(tenantQuery, [tenantId]);

    if (tenantResult.rows.length === 0) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const tenant = tenantResult.rows[0];

    // Create directory listing
    const insertQuery = `
      INSERT INTO directory_listings_list (
        tenant_id,
        business_name,
        slug,
        address,
        city,
        state,
        zip_code,
        phone,
        email,
        website,
        latitude,
        longitude,
        logo_url,
        description,
        is_published
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
      RETURNING id
    `;

    const slug = this.generateSlug(tenant.business_name, tenantId);

    const insertResult = await db.query(insertQuery, [
      tenantId,
      tenant.business_name,
      slug,
      tenant.address,
      tenant.city,
      tenant.state,
      tenant.zip_code,
      tenant.phone,
      tenant.email,
      tenant.website,
      tenant.latitude,
      tenant.longitude,
      tenant.logo_url,
      tenant.description,
    ]);

    return insertResult.rows[0].id;
  }

  /**
   * Sync GBP categories to directory listing categories
   */
  async syncGBPToDirectory(tenantId: string, gbpCategories: GBPCategories): Promise<SyncResult> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Get all GBP category IDs
      const gbpCategoryIds = [
        gbpCategories.primary.id,
        ...gbpCategories.secondary.map(s => s.id),
      ];

      // 2. Get platform category mappings
      const mappings = await this.getGBPMappings(gbpCategoryIds);

      // Track unmapped categories
      const unmappedCategories: string[] = [];
      const mappedCategoryIds: string[] = [];

      // 3. Get or create directory listing
      const listingId = await this.getOrCreateDirectoryListing(tenantId, client);

      // 4. Clear existing category assignments
      await client.query(
        'DELETE FROM directory_listing_categories WHERE listing_id = $1',
        [listingId]
      );

      // 5. Assign primary category
      const primaryMapping = mappings.find(m => m.gbp_category_id === gbpCategories.primary.id);
      
      if (primaryMapping?.platform_category_id) {
        await client.query(
          `INSERT INTO directory_listing_categories (listing_id, category_id, is_primary) 
           VALUES ($1, $2, true)`,
          [listingId, primaryMapping.platform_category_id]
        );
        mappedCategoryIds.push(primaryMapping.platform_category_id);
      } else {
        unmappedCategories.push(gbpCategories.primary.name);
      }

      // 6. Assign secondary categories
      for (const secondary of gbpCategories.secondary) {
        const mapping = mappings.find(m => m.gbp_category_id === secondary.id);
        
        if (mapping?.platform_category_id) {
          // Avoid duplicates
          if (!mappedCategoryIds.includes(mapping.platform_category_id)) {
            await client.query(
              `INSERT INTO directory_listing_categories (listing_id, category_id, is_primary) 
               VALUES ($1, $2, false)`,
              [listingId, mapping.platform_category_id]
            );
            mappedCategoryIds.push(mapping.platform_category_id);
          }
        } else {
          unmappedCategories.push(secondary.name);
        }
      }

      // 7. Update tenant metadata with sync status
      const syncStatus = unmappedCategories.length === 0 ? 'synced' : 'partial';
      
      await client.query(
        `UPDATE tenants 
         SET metadata = jsonb_set(
           jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{gbp_categories,sync_status}',
             $1::jsonb
           ),
           '{gbp_categories,last_synced_at}',
           $2::jsonb
         )
         WHERE id = $3`,
        [
          JSON.stringify(syncStatus),
          JSON.stringify(new Date().toISOString()),
          tenantId,
        ]
      );

      // 8. Refresh materialized view (async, don't wait)
      // Note: In production, this should be queued as a background job
      client.query('SELECT refresh_directory_category_listings()').catch(err => {
        console.error('[GBP Sync] Failed to refresh MV:', err);
      });

      await client.query('COMMIT');

      return {
        success: true,
        syncedCategories: mappedCategoryIds.length,
        unmappedCategories,
      };

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[GBP Sync] Error:', error);

      // Update tenant metadata with error status
      try {
        await this.pool.query(
          `UPDATE tenants 
           SET metadata = jsonb_set(
             jsonb_set(
               COALESCE(metadata, '{}'::jsonb),
               '{gbp_categories,sync_status}',
               '"error"'::jsonb
             ),
             '{gbp_categories,directory_sync_error}',
             $1::jsonb
           )
           WHERE id = $2`,
          [
            JSON.stringify(error instanceof Error ? error.message : 'Unknown error'),
            tenantId,
          ]
        );
      } catch (updateError) {
        console.error('[GBP Sync] Failed to update error status:', updateError);
      }

      return {
        success: false,
        syncedCategories: 0,
        unmappedCategories: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };

    } finally {
      client.release();
    }
  }

  /**
   * Update GBP category usage statistics
   * Updates the tenant_count in gbp_category_mappings
   */
  async updateUsageStats(gbpCategoryIds: string[]): Promise<void> {
    if (gbpCategoryIds.length === 0) {
      return;
    }

    const query = `
      UPDATE gbp_category_mappings
      SET 
        tenant_count = (
          SELECT COUNT(DISTINCT tgc.tenant_id)
          FROM tenant_gbp_categories tgc
          WHERE tgc.gbp_category_id = gbp_category_mappings.gbp_category_id
        ),
        last_used_at = NOW(),
        updated_at = NOW()
      WHERE gbp_category_id = ANY($1)
    `;

    await this.pool.query(query, [gbpCategoryIds]);
  }

  /**
   * Generate a URL-friendly slug from business name
   */
  private generateSlug(businessName: string, tenantId: string): string {
    const baseSlug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Add tenant ID suffix to ensure uniqueness
    const suffix = tenantId.split('-').pop() || '';
    return `${baseSlug}-${suffix}`;
  }

  /**
   * Refresh materialized views
   * Should be called after bulk sync operations
   */
  async refreshMaterializedViews(): Promise<void> {
    try {
      await this.pool.query('SELECT refresh_directory_category_listings()');
      console.log('[GBP Sync] Refreshed directory_category_listings MV');
    } catch (error) {
      console.error('[GBP Sync] Failed to refresh directory MV:', error);
      throw error;
    }

    try {
      await this.pool.query('SELECT refresh_gbp_category_usage_stats()');
      console.log('[GBP Sync] Refreshed gbp_category_usage_stats MV');
    } catch (error) {
      console.error('[GBP Sync] Failed to refresh usage stats MV:', error);
      throw error;
    }
  }
}
