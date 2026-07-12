/**
 * SupplierService
 *
 * CRUD operations for supplier records.
 * Manages both built-in open-source suppliers (Open Food Facts, UPC Database,
 * Open Beauty Facts) and custom supplier connections (CSV, SFTP, custom API).
 *
 * Related services:
 * - SupplierImportService — imports supplier catalog items into tenant inventory,
 *   barcode/GTIN enrichment via open-source and commercial APIs
 * - WholesaleMatchingService — B2B wholesale supplier matching by GTIN, Faire
 *   supplier search, affiliate link generation with click tracking, brand
 *   partner claim management (verified/preferred/exclusive hierarchy)
 *
 * Database tables:
 * - suppliers — supplier connection records (open-source, CSV, commercial APIs)
 * - supplier_mappings — tenant-to-supplier sync mappings
 * - product_suppliers — GTIN-indexed wholesale supplier matches (global)
 * - affiliate_clicks — tenant-scoped affiliate click tracking (pending → converted → expired)
 * - brand_partner_claims — brand partner ownership claims (admin-approved)
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
   * Delete a supplier.
   * Custom suppliers can always be deleted.
   * Built-in suppliers can be deleted only if they have 0 catalog items and 0 mappings.
   */
  async deleteSupplier(id: string) {
    const supplier = await prisma.supplier.findUnique({
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
    if (!supplier) {
      throw new Error('Supplier not found');
    }
    if (supplier.is_builtin && (supplier._count.supplier_catalog_item > 0 || supplier._count.supplier_mapping > 0)) {
      throw new Error('Built-in suppliers with catalog items or mappings cannot be deleted');
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

  /**
   * Get health dashboard data for all suppliers.
   * Aggregates metrics: success %, dedup %, GTIN coverage %, freshness lag, alerts.
   */
  async getHealthDashboard() {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: {
          select: {
            supplier_catalog_item: true,
            supplier_mapping: true,
            catalog_quarantine: true,
          },
        },
      },
      orderBy: [{ is_builtin: 'desc' }, { name: 'asc' }],
    });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const supplierMetrics = await Promise.all(
      suppliers.map(async (s) => {
        const itemsWithGtin = await prisma.supplier_catalog_item.count({
          where: { supplier_id: s.id, gtin: { not: null } },
        });

        const unreplayedQuarantine = await prisma.catalog_quarantine.count({
          where: { supplier_id: s.id, replayed_at: null },
        });

        const recentQuarantine = await prisma.catalog_quarantine.count({
          where: {
            supplier_id: s.id,
            replayed_at: null,
            created_at: { gt: twentyFourHoursAgo },
          },
        });

        const recentItems = await prisma.supplier_catalog_item.count({
          where: { supplier_id: s.id, updated_at: { gt: twentyFourHoursAgo } },
        });

        const latestItem = await prisma.supplier_catalog_item.findFirst({
          where: { supplier_id: s.id },
          orderBy: { updated_at: 'desc' },
          select: { updated_at: true },
        });

        const totalCatalogItems = s._count.supplier_catalog_item;
        const totalQuarantine = s._count.catalog_quarantine;
        const totalAttempts = totalCatalogItems + totalQuarantine;
        const successRate = totalAttempts > 0 ? Math.round((totalCatalogItems / totalAttempts) * 100) : 100;
        const dedupRate = totalCatalogItems > 0 ? Math.round(((totalCatalogItems - recentItems) / totalCatalogItems) * 100) : 0;
        const gtinCoveragePct = totalCatalogItems > 0 ? Math.round((itemsWithGtin / totalCatalogItems) * 100) : 0;

        const freshnessLagHours = latestItem
          ? Math.round((Date.now() - latestItem.updated_at.getTime()) / (1000 * 60 * 60))
          : null;

        const freshnessAlert = freshnessLagHours !== null && freshnessLagHours > 24;

        return {
          supplier_id: s.id,
          supplier_name: s.name,
          active: s.active,
          is_builtin: s.is_builtin,
          connection_type: s.connection_type,
          total_catalog_items: totalCatalogItems,
          total_mappings: s._count.supplier_mapping,
          items_with_gtin: itemsWithGtin,
          gtin_coverage_pct: gtinCoveragePct,
          success_rate_pct: successRate,
          dedup_rate_pct: dedupRate,
          items_updated_24h: recentItems,
          quarantined_items: totalQuarantine,
          unreplayed_quarantine_24h: recentQuarantine,
          freshness_lag_hours: freshnessLagHours,
          freshness_alert: freshnessAlert,
          last_updated: latestItem?.updated_at || null,
        };
      })
    );

    // Aggregate summary
    const totalSuppliers = suppliers.length;
    const activeSuppliers = suppliers.filter(s => s.active).length;
    const totalCatalogItems = supplierMetrics.reduce((sum, m) => sum + m.total_catalog_items, 0);
    const totalMappings = supplierMetrics.reduce((sum, m) => sum + m.total_mappings, 0);
    const totalQuarantined = supplierMetrics.reduce((sum, m) => sum + m.quarantined_items, 0);
    const avgGtinCoverage = totalSuppliers > 0
      ? Math.round(supplierMetrics.reduce((sum, m) => sum + m.gtin_coverage_pct, 0) / totalSuppliers)
      : 0;
    const avgSuccessRate = totalSuppliers > 0
      ? Math.round(supplierMetrics.reduce((sum, m) => sum + m.success_rate_pct, 0) / totalSuppliers)
      : 100;
    const alertsCount = supplierMetrics.filter(m => m.freshness_alert).length;

    return {
      summary: {
        total_suppliers: totalSuppliers,
        active_suppliers: activeSuppliers,
        total_catalog_items: totalCatalogItems,
        total_mappings: totalMappings,
        total_quarantined: totalQuarantined,
        avg_gtin_coverage_pct: avgGtinCoverage,
        avg_success_rate_pct: avgSuccessRate,
        alerts_count: alertsCount,
      },
      suppliers: supplierMetrics,
    };
  }
}

export const SupplierService = new SupplierServiceClass();
export default SupplierService;
