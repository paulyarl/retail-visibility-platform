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
import slugSingletonService from './SlugSingletonService';
import { logger } from '../logger';

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

    // Use SlugSingletonService for consistent slug generation
    const slug = await slugSingletonService.getOrCreateSlug(tenantId);

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

      // 7. Update tenant with GBP categories and sync status using dedicated columns
      const syncStatus = unmappedCategories.length === 0 ? 'synced' : 'partial';
      
      await client.query(
        `UPDATE tenants 
         SET 
           gbp_primary_category_id = $1,
           gbp_primary_category_name = $2,
           gbp_secondary_categories = $3,
           gbp_categories_sync_status = $4,
           gbp_categories_last_synced_at = $5
         WHERE id = $6`,
        [
          gbpCategories.primary.id,
          gbpCategories.primary.name,
          JSON.stringify(gbpCategories.secondary || []),
          syncStatus,
          new Date().toISOString(),
          tenantId,
        ]
      );

      // 8. Refresh materialized view (async, don't wait)
      // Note: In production, this should be queued as a background job
      client.query('SELECT refresh_directory_category_listings()').catch(err => {
        logger.error('[GBP Sync] Failed to refresh MV:', undefined, { error: { name: (err as any)?.name || 'Error', message: (err as any)?.message || String(err), stack: (err as any)?.stack } });
      });

      await client.query('COMMIT');

      return {
        success: true,
        syncedCategories: mappedCategoryIds.length,
        unmappedCategories,
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[GBP Sync] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });

      // Update tenant with error status using dedicated columns
      try {
        await this.pool.query(
          `UPDATE tenants 
           SET 
             gbp_categories_sync_status = 'error',
             gbp_categories_last_synced_at = NOW()
           WHERE id = $1`,
          [tenantId]
        );
      } catch (updateError) {
        logger.error('[GBP Sync] Failed to update error status:', undefined, { error: { name: (updateError as any)?.name || 'Error', message: (updateError as any)?.message || String(updateError), stack: (updateError as any)?.stack } });
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
   * Refresh materialized views
   * Should be called after bulk sync operations
   */
  async refreshMaterializedViews(): Promise<void> {
    try {
      await this.pool.query('SELECT refresh_directory_category_listings()');
      console.log('[GBP Sync] Refreshed directory_category_listings MV');
    } catch (error) {
      logger.error('[GBP Sync] Failed to refresh directory MV:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }

    try {
      await this.pool.query('SELECT refresh_gbp_category_usage_stats()');
      console.log('[GBP Sync] Refreshed gbp_category_usage_stats MV');
    } catch (error) {
      logger.error('[GBP Sync] Failed to refresh usage stats MV:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }
}
