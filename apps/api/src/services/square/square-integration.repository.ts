/**
 * Square Integration Repository
 * Database operations for Square integrations
 * Phase 2: Backend Implementation
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateIntegrationData {
  tenantId: string;
  accessToken: string;
  refreshToken?: string;
  merchantId: string;
  locationId?: string;
  tokenExpiresAt?: Date;
  scopes?: string[];
  mode: 'sandbox' | 'production';
}

export interface UpdateIntegrationData {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  lastSyncAt?: Date;
  lastError?: string;
  enabled?: boolean;
}

export interface CreateProductMappingData {
  tenantId: string;
  integrationId: string;
  inventoryItemId: string;
  squareCatalogObjectId: string;
  squareItemVariationId?: string;
}

export interface CreateSyncLogData {
  tenantId: string;
  integrationId: string;
  mappingId?: string;
  syncType: 'inventory' | 'catalog' | 'webhook' | 'manual';
  direction: 'to_square' | 'from_square';
  operation: 'create' | 'update' | 'delete' | 'sync';
  status: 'pending' | 'success' | 'error' | 'skipped';
  errorMessage?: string;
  errorCode?: string;
  requestPayload?: any;
  responsePayload?: any;
  itemsAffected?: number;
  durationMs?: number;
}

export class SquareIntegrationRepository {
  /**
   * Create a new Square integration
   */
  async createIntegration(data: CreateIntegrationData) {
    // Check if integration exists
    const existing = await prisma.squareIntegrations.findFirst({
      where: { tenantId: data.tenantId }
    });

    if (existing) {
      // Update existing
      return await prisma.squareIntegrations.update({
        where: { id: existing.id },
        data: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken || null,
          merchantId: data.merchantId,
          locationId: data.locationId || null,
          tokenExpiresAt: data.tokenExpiresAt || null,
          scopes: data.scopes || [],
          mode: data.mode,
        }
      });
    } else {
      // Create new
      return await prisma.squareIntegrations.create({
        data: {
          tenantId: data.tenantId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken || null,
          merchantId: data.merchantId,
          locationId: data.locationId || null,
          tokenExpiresAt: data.tokenExpiresAt || null,
          scopes: data.scopes || [],
          mode: data.mode,
        } as any
      });
    }
  }

  /**
   * Get integration by tenant ID
   */
  async getIntegrationByTenantId(tenantId: string) {
    return await prisma.squareIntegrations.findFirst({
      where: { tenantId },
    });
  }

  /**
   * Get integration by ID
   */
  async getIntegrationById(integrationId: string) {
    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM square_integrations
      WHERE id = ${integrationId}::uuid
      LIMIT 1
    `;
    return result[0] || null;
  }

  /**
   * Update integration
   */
  async updateIntegration(integrationId: string, data: UpdateIntegrationData) {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.accessToken !== undefined) {
      updates.push(`access_token = $${values.length + 1}`);
      values.push(data.accessToken);
    }
    if (data.refreshToken !== undefined) {
      updates.push(`refresh_token = $${values.length + 1}`);
      values.push(data.refreshToken);
    }
    if (data.tokenExpiresAt !== undefined) {
      updates.push(`token_expires_at = $${values.length + 1}::timestamptz`);
      values.push(data.tokenExpiresAt);
    }
    if (data.lastSyncAt !== undefined) {
      updates.push(`last_sync_at = $${values.length + 1}::timestamptz`);
      values.push(data.lastSyncAt);
    }
    if (data.lastError !== undefined) {
      updates.push(`last_error = $${values.length + 1}`);
      values.push(data.lastError);
    }
    if (data.enabled !== undefined) {
      updates.push(`enabled = $${values.length + 1}`);
      values.push(data.enabled);
    }

    updates.push('updated_at = NOW()');

    if (updates.length === 1) return; // Only updated_at, skip

    return prisma.$executeRawUnsafe(`
      UPDATE square_integrations
      SET ${updates.join(', ')}
      WHERE id = $${values.length + 1}::uuid
    `, ...values, integrationId);
  }

  /**
   * Delete integration
   */
  async deleteIntegration(integrationId: string) {
    return prisma.$executeRaw`
      DELETE FROM square_integrations
      WHERE id = ${integrationId}::uuid
    `;
  }

  /**
   * Create product mapping
   */
  async createProductMapping(data: CreateProductMappingData) {
    return prisma.$executeRaw`
      INSERT INTO square_product_mappings (
        tenantId, integration_id, inventory_item_id,
        square_catalog_object_id, square_item_variation_id
      ) VALUES (
        ${data.tenantId}::uuid,
        ${data.integrationId}::uuid,
        ${data.inventoryItemId}::uuid,
        ${data.squareCatalogObjectId},
        ${data.squareItemVariationId || null}
      )
      ON CONFLICT (tenantId, inventory_item_id) DO UPDATE SET
        square_catalog_object_id = EXCLUDED.square_catalog_object_id,
        square_item_variation_id = EXCLUDED.square_item_variation_id,
        updated_at = NOW()
      RETURNING *
    `;
  }

  /**
   * Get product mapping by inventory item ID
   */
  async getProductMappingByInventoryItemId(tenantId: string, inventoryItemId: string) {
    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM square_product_mappings
      WHERE tenantId = ${tenantId}::uuid
        AND inventory_item_id = ${inventoryItemId}::uuid
      LIMIT 1
    `;
    return result[0] || null;
  }

  /**
   * Get product mapping by Square catalog object ID
   */
  async getProductMappingBySquareId(integrationId: string, squareCatalogObjectId: string) {
    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM square_product_mappings
      WHERE integration_id = ${integrationId}::uuid
        AND square_catalog_object_id = ${squareCatalogObjectId}
      LIMIT 1
    `;
    return result[0] || null;
  }

  /**
   * Get all product mappings for a tenant
   */
  async getProductMappingsByTenantId(tenantId: string) {
    return prisma.$queryRaw<any[]>`
      SELECT * FROM square_product_mappings
      WHERE tenantId = ${tenantId}::uuid
      ORDER BY created_at DESC
    `;
  }

  /**
   * Delete product mapping
   */
  async deleteProductMapping(mappingId: string) {
    return prisma.$executeRaw`
      DELETE FROM square_product_mappings
      WHERE id = ${mappingId}::uuid
    `;
  }

  /**
   * Create sync log
   */
  async createSyncLog(data: CreateSyncLogData) {
    return prisma.$executeRaw`
      INSERT INTO square_sync_logs (
        tenantId, integration_id, mapping_id, sync_type, direction,
        operation, status, error_message, error_code, request_payload,
        response_payload, items_affected, duration_ms
      ) VALUES (
        ${data.tenantId}::uuid,
        ${data.integrationId}::uuid,
        ${data.mappingId || null}::uuid,
        ${data.syncType},
        ${data.direction},
        ${data.operation},
        ${data.status},
        ${data.errorMessage || null},
        ${data.errorCode || null},
        ${data.requestPayload ? JSON.stringify(data.requestPayload) : null}::jsonb,
        ${data.responsePayload ? JSON.stringify(data.responsePayload) : null}::jsonb,
        ${data.itemsAffected || 0},
        ${data.durationMs || null}
      )
      RETURNING *
    `;
  }

  /**
   * Get recent sync logs for a tenant
   */
  async getSyncLogsByTenantId(tenantId: string, limit: number = 100) {
    return prisma.$queryRaw<any[]>`
      SELECT * FROM square_sync_logs
      WHERE tenantId = ${tenantId}::uuid
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  /**
   * Get sync logs by status
   */
  async getSyncLogsByStatus(tenantId: string, status: string, limit: number = 100) {
    return prisma.$queryRaw<any[]>`
      SELECT * FROM square_sync_logs
      WHERE tenantId = ${tenantId}::uuid
        AND status = ${status}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }
}

/**
 * Singleton instance
 */
export const squareIntegrationRepository = new SquareIntegrationRepository();
