/**
 * SupplierImportService
 *
 * Imports supplier catalog items into a tenant's inventory_items table.
 * Creates supplier_mappings for ongoing sync. Detects conflicts (GTIN already
 * exists, SKU already exists, discontinued items).
 */

import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';
import { generateProductCatId } from '../lib/id-generator';

export interface ImportSelection {
  catalog_item_id: string;
  price_cents?: number;
  stock?: number;
  name_override?: string;
  image_override?: string;
}

function msrpToCents(msrp: Prisma.Decimal | null | undefined): number | null {
  if (!msrp) return null;
  return Number(msrp) * 100;
}

export interface ConflictCheckResult {
  can_import: boolean;
  conflicts: {
    catalog_item_id: string;
    sku: string;
    gtin: string | null;
    status: 'can_import' | 'already_in_catalog' | 'gtin_conflict' | 'discontinued';
    existing_item_id?: string;
    existing_item_name?: string;
  }[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { catalog_item_id: string; error: string }[];
  created_item_ids: string[];
}

class SupplierImportServiceClass {
  /**
   * Pre-flight conflict check for selected catalog items
   */
  async checkConflicts(
    tenantId: string,
    selections: ImportSelection[]
  ): Promise<ConflictCheckResult> {
    const conflicts: ConflictCheckResult['conflicts'] = [];

    for (const sel of selections) {
      const catalogItem = await prisma.supplier_catalog_item.findUnique({
        where: { id: sel.catalog_item_id },
      });

      if (!catalogItem) {
        conflicts.push({
          catalog_item_id: sel.catalog_item_id,
          sku: '',
          gtin: null,
          status: 'discontinued',
        });
        continue;
      }

      if (catalogItem.availability === 'discontinued') {
        conflicts.push({
          catalog_item_id: sel.catalog_item_id,
          sku: catalogItem.supplier_sku,
          gtin: catalogItem.gtin,
          status: 'discontinued',
        });
        continue;
      }

      // Check if mapping already exists for this tenant + supplier + SKU
      const existingMapping = await prisma.supplier_mapping.findFirst({
        where: {
          tenant_id: tenantId,
          supplier_id: catalogItem.supplier_id,
          supplier_sku: catalogItem.supplier_sku,
        },
      });

      if (existingMapping) {
        const existingItem = await prisma.inventory_items.findUnique({
          where: { id: existingMapping.inventory_item_id },
          select: { id: true, name: true },
        });
        conflicts.push({
          catalog_item_id: sel.catalog_item_id,
          sku: catalogItem.supplier_sku,
          gtin: catalogItem.gtin,
          status: 'already_in_catalog',
          existing_item_id: existingItem?.id,
          existing_item_name: existingItem?.name,
        });
        continue;
      }

      // Check GTIN conflict
      if (catalogItem.gtin) {
        const gtinMatch = await prisma.inventory_items.findFirst({
          where: { tenant_id: tenantId, gtin: catalogItem.gtin },
          select: { id: true, name: true },
        });

        if (gtinMatch) {
          conflicts.push({
            catalog_item_id: sel.catalog_item_id,
            sku: catalogItem.supplier_sku,
            gtin: catalogItem.gtin,
            status: 'gtin_conflict',
            existing_item_id: gtinMatch.id,
            existing_item_name: gtinMatch.name,
          });
          continue;
        }
      }

      conflicts.push({
        catalog_item_id: sel.catalog_item_id,
        sku: catalogItem.supplier_sku,
        gtin: catalogItem.gtin,
        status: 'can_import',
      });
    }

    return {
      can_import: conflicts.every((c) => c.status === 'can_import'),
      conflicts,
    };
  }

  /**
   * Execute import: create inventory_items + supplier_mappings
   */
  async executeImport(
    tenantId: string,
    selections: ImportSelection[]
  ): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;
    const errors: ImportResult['errors'] = [];
    const created_item_ids: string[] = [];

    for (const sel of selections) {
      try {
        const catalogItem = await prisma.supplier_catalog_item.findUnique({
          where: { id: sel.catalog_item_id },
          include: { supplier: { select: { id: true, name: true } } },
        });

        if (!catalogItem || catalogItem.availability === 'discontinued') {
          skipped++;
          errors.push({
            catalog_item_id: sel.catalog_item_id,
            error: 'Catalog item not found or discontinued',
          });
          continue;
        }

        // Check for existing mapping
        const existingMapping = await prisma.supplier_mapping.findFirst({
          where: {
            tenant_id: tenantId,
            supplier_id: catalogItem.supplier_id,
            supplier_sku: catalogItem.supplier_sku,
          },
        });

        if (existingMapping) {
          skipped++;
          errors.push({
            catalog_item_id: sel.catalog_item_id,
            error: 'Already imported (mapping exists)',
          });
          continue;
        }

        const itemId = generateProductCatId(tenantId);
        const name = sel.name_override || catalogItem.name;
        const priceCents = sel.price_cents ?? msrpToCents(catalogItem.msrp) ?? 0;
        const stock = sel.stock ?? 0;

        // Create inventory item
        await prisma.inventory_items.create({
          data: {
            id: itemId,
            tenant_id: tenantId,
            name,
            title: name,
            brand: catalogItem.brand || 'Unknown',
            sku: catalogItem.supplier_sku,
            gtin: catalogItem.gtin,
            description: catalogItem.description,
            image_url: sel.image_override || catalogItem.image_url,
            price_cents: priceCents,
            price: priceCents / 100,
            stock,
            availability: stock > 0 ? 'in_stock' : 'out_of_stock',
            condition: 'brand_new',
            product_type: 'physical',
            item_status: 'active',
            visibility: 'public',
            source: 'API_IMPORT',
            source_type: 'supplier_catalog',
            supplier_catalog_item_id: catalogItem.id,
            updated_at: new Date(),
            metadata: {
              supplier_name: catalogItem.supplier.name,
              supplier_id: catalogItem.supplier.id,
              attrs: catalogItem.attrs,
            },
          },
        });

        // Create supplier mapping
        await prisma.supplier_mapping.create({
          data: {
            tenant_id: tenantId,
            supplier_id: catalogItem.supplier_id,
            supplier_sku: catalogItem.supplier_sku,
            inventory_item_id: itemId,
            sync_mode: 'manual',
          },
        });

        created_item_ids.push(itemId);
        imported++;
      } catch (err) {
        skipped++;
        errors.push({
          catalog_item_id: sel.catalog_item_id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return { imported, skipped, errors, created_item_ids };
  }

  /**
   * List supplier mappings for a tenant
   */
  async getMappings(tenantId: string, supplierId?: string) {
    const mappings = await prisma.supplier_mapping.findMany({
      where: {
        tenant_id: tenantId,
        ...(supplierId && { supplier_id: supplierId }),
      },
      include: {
        supplier: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    // Fetch inventory items separately (no relation on supplier_mapping)
    const itemIds = mappings.map((m) => m.inventory_item_id);
    const items = await prisma.inventory_items.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, price_cents: true },
    });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    return mappings.map((m) => ({
      ...m,
      inventory_items: itemMap.get(m.inventory_item_id) || null,
    }));
  }

  /**
   * Update sync mode for a mapping
   */
  async updateSyncMode(mappingId: string, syncMode: 'manual' | 'auto') {
    return prisma.supplier_mapping.update({
      where: { id: mappingId },
      data: { sync_mode: syncMode, last_sync: new Date() },
    });
  }

  /**
   * Unlink a supplier mapping (does not delete the inventory item)
   */
  async unlinkMapping(mappingId: string) {
    const mapping = await prisma.supplier_mapping.findUnique({
      where: { id: mappingId },
    });

    if (!mapping) {
      throw new Error('Mapping not found');
    }

    // Clear supplier reference on inventory item
    if (mapping.inventory_item_id) {
      await prisma.inventory_items.update({
        where: { id: mapping.inventory_item_id },
        data: {
          source_type: 'manual',
          supplier_catalog_item_id: null,
        },
      });
    }

    return prisma.supplier_mapping.delete({ where: { id: mappingId } });
  }
}

export const SupplierImportService = new SupplierImportServiceClass();
export default SupplierImportService;
