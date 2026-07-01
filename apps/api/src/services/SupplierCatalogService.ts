/**
 * SupplierCatalogService
 *
 * Search, browse, and batch-ingest supplier catalog items.
 * Handles dedup by GTIN within a supplier and quarantines malformed rows.
 */

import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

export interface CatalogSearchParams {
  supplierId?: string;
  query?: string;
  brand?: string;
  gtin?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

function msrpToCents(msrp: Prisma.Decimal | null | undefined): number | null {
  if (!msrp) return null;
  return Number(msrp) * 100;
}

export interface CatalogSearchResult {
  items: CatalogItemDTO[];
  total: number;
  limit: number;
  offset: number;
}

export interface CatalogItemDTO {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  supplier_sku: string;
  gtin: string | null;
  name: string;
  brand: string | null;
  description: string | null;
  category: string | null;
  image_url: string | null;
  msrp_cents: number | null;
  attrs: any;
  availability: string;
  updated_at: Date;
}

export interface BatchIngestRow {
  supplier_sku: string;
  gtin?: string | null;
  name: string;
  brand?: string | null;
  description?: string | null;
  category?: string | null;
  image_url?: string | null;
  msrp_cents?: number | null;
  attrs?: any;
}

export interface BatchIngestResult {
  inserted: number;
  updated: number;
  quarantined: number;
  errors: { row: number; sku: string; error: string }[];
}

class SupplierCatalogServiceClass {
  /**
   * Search catalog items with filtering and pagination
   */
  async searchCatalog(params: CatalogSearchParams): Promise<CatalogSearchResult> {
    const limit = Math.min(params.limit || 50, 200);
    const offset = params.offset || 0;

    const where: Prisma.supplier_catalog_itemWhereInput = {
      ...(params.supplierId && { supplier_id: params.supplierId }),
      ...(params.gtin && { gtin: params.gtin }),
      ...(params.brand && { brand: { contains: params.brand, mode: 'insensitive' } }),
      ...(params.category && { category: { contains: params.category, mode: 'insensitive' } }),
      ...(params.query && {
        OR: [
          { name: { contains: params.query, mode: 'insensitive' } },
          { brand: { contains: params.query, mode: 'insensitive' } },
          { gtin: { contains: params.query } },
          { supplier_sku: { contains: params.query } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.supplier_catalog_item.findMany({
        where,
        include: { supplier: { select: { name: true } } },
        orderBy: { updated_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.supplier_catalog_item.count({ where }),
    ]);

    return {
      items: items.map((i) => this.toDTO(i)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get a single catalog item by ID
   */
  async getCatalogItem(id: string) {
    return prisma.supplier_catalog_item.findUnique({
      where: { id },
      include: { supplier: { select: { name: true } } },
    });
  }

  /**
   * Lookup catalog item by barcode/GTIN (used by ItemCreationWizard Step 0)
   */
  async lookupByBarcode(gtin: string, supplierId?: string) {
    const where: Prisma.supplier_catalog_itemWhereInput = {
      gtin,
      ...(supplierId && { supplier_id: supplierId }),
    };

    const items = await prisma.supplier_catalog_item.findMany({
      where,
      include: { supplier: { select: { name: true } } },
      take: 10,
      orderBy: { updated_at: 'desc' },
    });

    return items.map((i) => this.toDTO(i));
  }

  /**
   * Batch ingest catalog rows for a supplier.
   * Deduplicates by (supplier_id, sku) — updates existing, inserts new.
   * Rows with missing required fields are quarantined.
   */
  async batchIngest(supplierId: string, rows: BatchIngestRow[]): Promise<BatchIngestResult> {
    let inserted = 0;
    let updated = 0;
    let quarantined = 0;
    const errors: BatchIngestResult['errors'] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];

      if (!row.supplier_sku || !row.name) {
        await prisma.catalog_quarantine.create({
          data: {
            supplier_id: supplierId,
            raw_payload: row as any,
            error_code: !row.supplier_sku ? 'MISSING_SKU' : 'MISSING_NAME',
            error_message: !row.supplier_sku ? 'Missing supplier_sku' : 'Missing name',
          },
        });
        quarantined++;
        errors.push({ row: idx, sku: row.supplier_sku || '', error: 'Missing required fields' });
        continue;
      }

      try {
        const existing = await prisma.supplier_catalog_item.findUnique({
          where: {
            supplier_id_supplier_sku: { supplier_id: supplierId, supplier_sku: row.supplier_sku },
          },
        });

        const msrpDecimal = row.msrp_cents ? new Prisma.Decimal(row.msrp_cents / 100) : null;

        if (existing) {
          await prisma.supplier_catalog_item.update({
            where: { id: existing.id },
            data: {
              gtin: row.gtin || existing.gtin,
              name: row.name,
              brand: row.brand || existing.brand,
              description: row.description || existing.description,
              category: row.category || existing.category,
              image_url: row.image_url || existing.image_url,
              msrp: msrpDecimal ?? existing.msrp,
              attrs: row.attrs || existing.attrs,
              updated_at: new Date(),
            },
          });
          updated++;
        } else {
          await prisma.supplier_catalog_item.create({
            data: {
              supplier_id: supplierId,
              supplier_sku: row.supplier_sku,
              gtin: row.gtin || null,
              name: row.name,
              brand: row.brand || null,
              description: row.description || null,
              category: row.category || null,
              image_url: row.image_url || null,
              msrp: msrpDecimal,
              attrs: row.attrs || {},
            },
          });
          inserted++;
        }
      } catch (err) {
        await prisma.catalog_quarantine.create({
          data: {
            supplier_id: supplierId,
            raw_payload: row as any,
            error_code: 'INGEST_ERROR',
            error_message: err instanceof Error ? err.message : 'Unknown error',
          },
        });
        quarantined++;
        errors.push({
          row: idx,
          sku: row.supplier_sku,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return { inserted, updated, quarantined, errors };
  }

  /**
   * Get quarantined items for a supplier
   */
  async getQuarantinedItems(supplierId: string, limit = 50) {
    return prisma.catalog_quarantine.findMany({
      where: { supplier_id: supplierId, replayed_at: null },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Replay a quarantined item — re-attempts ingestion of the raw payload.
   * If ingestion succeeds, marks the quarantine row as replayed.
   * If ingestion fails again, updates the error message and leaves unreplayed.
   */
  async replayQuarantine(id: string): Promise<{ success: boolean; error?: string }> {
    const quarantined = await prisma.catalog_quarantine.findUnique({ where: { id } });
    if (!quarantined) {
      return { success: false, error: 'Quarantined item not found' };
    }

    const row = quarantined.raw_payload as unknown as BatchIngestRow;

    // Validate required fields
    if (!row.supplier_sku || !row.name) {
      return { success: false, error: 'Missing required fields (supplier_sku, name)' };
    }

    try {
      const result = await this.batchIngest(quarantined.supplier_id, [row]);

      if (result.errors.length > 0) {
        // Re-ingestion failed — update error message but don't mark as replayed
        await prisma.catalog_quarantine.update({
          where: { id },
          data: { error_message: `Replay failed: ${result.errors[0].error}` },
        });
        return { success: false, error: result.errors[0].error };
      }

      // Success — mark as replayed
      await prisma.catalog_quarantine.update({
        where: { id },
        data: { replayed_at: new Date() },
      });
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      await prisma.catalog_quarantine.update({
        where: { id },
        data: { error_message: `Replay error: ${errorMsg}` },
      });
      return { success: false, error: errorMsg };
    }
  }

  private toDTO(item: any): CatalogItemDTO {
    return {
      id: item.id,
      supplier_id: item.supplier_id,
      supplier_name: item.supplier?.name,
      supplier_sku: item.supplier_sku,
      gtin: item.gtin,
      name: item.name,
      brand: item.brand,
      description: item.description,
      category: item.category,
      image_url: item.image_url,
      msrp_cents: msrpToCents(item.msrp),
      attrs: item.attrs,
      availability: item.availability,
      updated_at: item.updated_at,
    };
  }
}

export const SupplierCatalogService = new SupplierCatalogServiceClass();
export default SupplierCatalogService;
