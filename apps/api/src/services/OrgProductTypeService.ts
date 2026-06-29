/**
 * Organization Product Type Service
 *
 * Aggregates product type data across all tenants in an organization.
 * Provides:
 * - Per-tenant product type capability state (enabled, allowed types, selected types)
 * - Org-wide product mix (SKU counts grouped by product_type)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import ProductTypeService, { ProductType } from './ProductTypeService';

export interface OrgProductTypeLocationState {
  tenantId: string;
  tenantName: string;
  enabled: boolean;
  type: ProductType;
  isFlexible: boolean;
  allowedTypes: ProductType[];
  selectedTypes: string[];
}

export interface OrgProductTypeRollup {
  totalLocations: number;
  locations: OrgProductTypeLocationState[];
  summary: {
    enabledCount: number;
    disabledCount: number;
    typeDistribution: Record<string, number>;
    misalignedCount: number;
  };
}

export interface ProductMixEntry {
  productType: string;
  count: number;
  percentage: number;
}

export interface OrgProductMix {
  totalItems: number;
  mix: ProductMixEntry[];
  perLocation: Array<{
    tenantId: string;
    tenantName: string;
    totalItems: number;
    mix: ProductMixEntry[];
  }>;
}

class OrgProductTypeService {
  private static instance: OrgProductTypeService;

  private constructor() {}

  static getInstance(): OrgProductTypeService {
    if (!OrgProductTypeService.instance) {
      OrgProductTypeService.instance = new OrgProductTypeService();
    }
    return OrgProductTypeService.instance;
  }

  /**
   * Get product type capability state for all tenants in an organization.
   */
  async getProductTypeRollup(orgId: string): Promise<OrgProductTypeRollup | null> {
    const org = await prisma.organizations_list.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        tenants: { select: { id: true, name: true } },
      },
    });

    if (!org) return null;

    const totalLocations = org.tenants.length;
    if (totalLocations === 0) {
      return {
        totalLocations: 0,
        locations: [],
        summary: {
          enabledCount: 0,
          disabledCount: 0,
          typeDistribution: {},
          misalignedCount: 0,
        },
      };
    }

    const productTypeService = ProductTypeService.getInstance();

    const results = await Promise.allSettled(
      org.tenants.map(async (tenant) => {
        const [state, settings] = await Promise.all([
          productTypeService.resolveProductTypeState(tenant.id),
          prisma.tenant_product_types_settings.findUnique({
            where: { tenant_id: tenant.id },
            select: {
              product_types_enabled: true,
              selected_product_type: true,
              selected_product_types: true,
            },
          }),
        ]);

        const selectedTypes = settings?.selected_product_types
          ? Array.isArray(settings.selected_product_types)
            ? settings.selected_product_types as string[]
            : []
          : settings?.selected_product_type
            ? [settings.selected_product_type]
            : state.type !== 'none' && state.type !== 'flexible'
              ? [state.type]
              : [];

        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          enabled: state.enabled,
          type: state.type,
          isFlexible: state.isFlexible,
          allowedTypes: state.allowedTypes,
          selectedTypes,
        } as OrgProductTypeLocationState;
      })
    );

    const locations: OrgProductTypeLocationState[] = results.map((result, i) => {
      const tenant = org.tenants[i];
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        enabled: false,
        type: 'none' as ProductType,
        isFlexible: false,
        allowedTypes: [],
        selectedTypes: [],
      };
    });

    const enabledCount = locations.filter((l) => l.enabled).length;
    const typeDistribution: Record<string, number> = {};
    for (const loc of locations) {
      const key = loc.enabled ? loc.type : 'disabled';
      typeDistribution[key] = (typeDistribution[key] || 0) + 1;
    }

    const enabledLocations = locations.filter((l) => l.enabled);
    const allAllowed = new Set<string>();
    for (const loc of enabledLocations) {
      for (const t of loc.allowedTypes) allAllowed.add(t);
    }
    const misalignedCount = enabledLocations.filter(
      (loc) => loc.allowedTypes.length > 0 && !loc.allowedTypes.every((t) => allAllowed.has(t))
    ).length;

    return {
      totalLocations,
      locations,
      summary: {
        enabledCount,
        disabledCount: totalLocations - enabledCount,
        typeDistribution,
        misalignedCount,
      },
    };
  }

  /**
   * Get product mix (SKU counts by product_type) across all tenants in an organization.
   */
  async getProductMix(orgId: string): Promise<OrgProductMix | null> {
    const org = await prisma.organizations_list.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        tenants: { select: { id: true, name: true } },
      },
    });

    if (!org) return null;

    if (org.tenants.length === 0) {
      return { totalItems: 0, mix: [], perLocation: [] };
    }

    const tenantIds = org.tenants.map((t) => t.id);

    const grouped = await prisma.inventory_items.groupBy({
      by: ['product_type'],
      where: { tenant_id: { in: tenantIds } },
      _count: { id: true },
    });

    const totalItems = grouped.reduce((sum, g) => sum + g._count.id, 0);

    const mix: ProductMixEntry[] = grouped
      .map((g) => ({
        productType: g.product_type || 'unknown',
        count: g._count.id,
        percentage: totalItems > 0 ? (g._count.id / totalItems) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const perLocation = await Promise.all(
      org.tenants.map(async (tenant) => {
        const locGrouped = await prisma.inventory_items.groupBy({
          by: ['product_type'],
          where: { tenant_id: tenant.id },
          _count: { id: true },
        });

        const locTotal = locGrouped.reduce((sum, g) => sum + g._count.id, 0);

        const locMix: ProductMixEntry[] = locGrouped
          .map((g) => ({
            productType: g.product_type || 'unknown',
            count: g._count.id,
            percentage: locTotal > 0 ? (g._count.id / locTotal) * 100 : 0,
          }))
          .sort((a, b) => b.count - a.count);

        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          totalItems: locTotal,
          mix: locMix,
        };
      })
    );

    return { totalItems, mix, perLocation };
  }
}

export default OrgProductTypeService;
