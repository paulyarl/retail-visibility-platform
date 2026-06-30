/**
 * SupplierService
 *
 * CRUD operations for supplier records.
 * Manages both built-in open-source suppliers (Open Food Facts, UPC Database,
 * Open Beauty Facts) and custom supplier connections (CSV, SFTP, custom API).
 */

import { prisma } from '../prisma';

export interface SupplierWithCounts {
  id: string;
  name: string;
  connection_type: string;
  api_url: string | null;
  api_key_env: string | null;
  active: boolean;
  is_builtin: boolean;
  metadata: any;
  created_at: Date;
  updated_at: Date;
  catalog_item_count?: number;
  mapping_count?: number;
}

class SupplierServiceClass {
  /**
   * List all suppliers with optional active-only filter
   */
  async listSuppliers(activeOnly = false): Promise<SupplierWithCounts[]> {
    const suppliers = await prisma.supplier.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: [{ is_builtin: 'desc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            supplier_catalog_item: true,
            supplier_mapping: true,
          },
        },
      },
    });

    return suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      connection_type: s.connection_type,
      api_url: s.api_url,
      api_key_env: s.api_key_env,
      active: s.active,
      is_builtin: s.is_builtin,
      metadata: s.metadata,
      created_at: s.created_at,
      updated_at: s.updated_at,
      catalog_item_count: s._count.supplier_catalog_item,
      mapping_count: s._count.supplier_mapping,
    }));
  }

  /**
   * Get a single supplier by ID
   */
  async getSupplier(id: string) {
    return prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            supplier_catalog_item: true,
            supplier_mapping: true,
          },
        },
      },
    });
  }

  /**
   * Create a new custom supplier
   */
  async createSupplier(data: {
    id?: string;
    name: string;
    connection_type: string;
    api_url?: string;
    api_key_env?: string;
    metadata?: any;
  }) {
    const id = data.id || `supplier-custom-${Date.now()}`;
    return prisma.supplier.create({
      data: {
        id,
        name: data.name,
        connection_type: data.connection_type,
        api_url: data.api_url || null,
        api_key_env: data.api_key_env || null,
        is_builtin: false,
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Update an existing supplier
   */
  async updateSupplier(
    id: string,
    data: {
      name?: string;
      connection_type?: string;
      api_url?: string;
      api_key_env?: string;
      active?: boolean;
      metadata?: any;
    }
  ) {
    return prisma.supplier.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.connection_type !== undefined && { connection_type: data.connection_type }),
        ...(data.api_url !== undefined && { api_url: data.api_url }),
        ...(data.api_key_env !== undefined && { api_key_env: data.api_key_env }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
        updated_at: new Date(),
      },
    });
  }

  /**
   * Delete a supplier (only custom suppliers can be deleted)
   */
  async deleteSupplier(id: string) {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) {
      throw new Error('Supplier not found');
    }
    if (supplier.is_builtin) {
      throw new Error('Built-in suppliers cannot be deleted');
    }
    return prisma.supplier.delete({ where: { id } });
  }

  /**
   * Get supplier health metrics
   */
  async getSupplierHealth(id: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            supplier_catalog_item: true,
            supplier_mapping: true,
            catalog_quarantine: true,
          },
        },
      },
    });

    if (!supplier) {
      return null;
    }

    const itemsWithGtin = await prisma.supplier_catalog_item.count({
      where: { supplier_id: id, gtin: { not: null } },
    });

    const recentQuarantine = await prisma.catalog_quarantine.count({
      where: {
        supplier_id: id,
        replayed_at: null,
        created_at: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    const recentItems = await prisma.supplier_catalog_item.count({
      where: {
        supplier_id: id,
        updated_at: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    return {
      supplier_id: id,
      supplier_name: supplier.name,
      active: supplier.active,
      total_catalog_items: supplier._count.supplier_catalog_item,
      total_mappings: supplier._count.supplier_mapping,
      items_with_gtin: itemsWithGtin,
      gtin_coverage_pct:
        supplier._count.supplier_catalog_item > 0
          ? Math.round((itemsWithGtin / supplier._count.supplier_catalog_item) * 100)
          : 0,
      items_updated_24h: recentItems,
      quarantined_items: supplier._count.catalog_quarantine,
      unreplayed_quarantine_24h: recentQuarantine,
    };
  }
}

export const SupplierService = new SupplierServiceClass();
export default SupplierService;
