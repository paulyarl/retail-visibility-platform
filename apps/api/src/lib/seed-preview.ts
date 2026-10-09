/**
 * Seed preview storefronts (demo_template = 'seed_preview') never take real
 * payment or create orders. Shared guard for checkout entry points —
 * spec: docs/LocalBiz/SEED_PREVIEW_STOREFRONT_SPEC.md §5b.
 */
import { prisma } from '../prisma';
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

export const SEED_PREVIEW_TEMPLATE = 'seed_preview';

export async function isSeedPreviewTenant(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId || tenantId === 'demo-tenant') return false;
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { demo_template: true },
  });
  return tenant?.demo_template === SEED_PREVIEW_TEMPLATE;
}

export const SEED_PREVIEW_SANDBOX_RESPONSE = {
  success: true,
  sandbox: true,
  demo_checkout: true,
  message: 'Demo checkout. No payment is taken and no order is placed.',
} as const;

/** MVs that must be refreshed when a seed-preview lifecycle event commits:
 *  - mv_storefront_discovery feeds the public /shops/[slug] product read.
 *  - mv_tenant_effective_capabilities feeds feature resolution — a brand-new
 *    preview tenant has NO rows there until refresh, so its storefront would
 *    resolve an empty capability set (no commerce surface) without this.
 *  - storefront_category_counts feeds the Store Aisle sidebar on
 *    /tenant/[id]. generateQuickStartProducts refreshes it on a pooled
 *    connection INSIDE the creation transaction, where the preview's
 *    products/categories are still invisible — the post-commit refresh here
 *    is the only one that can see them.
 *  All refresh on demand only; no scheduled job covers them (spec C-9). */
const SEED_PREVIEW_MVS = [
  'mv_storefront_discovery',
  'mv_tenant_effective_capabilities',
  'storefront_category_counts',
] as const;

/**
 * Storefront/capability reads run off materialized views, which are only
 * refreshed on demand. Any lifecycle change that should take effect on the
 * public storefront (preview creation, product archival, tenant retirement)
 * must call this after the writes commit — REFRESH ... CONCURRENTLY cannot
 * run inside a transaction (spec §5e, gap B-1).
 */
export async function refreshStorefrontDiscoveryMv(): Promise<void> {
  const pool = getDirectPool();
  for (const view of SEED_PREVIEW_MVS) {
    try {
      await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
    } catch (err: any) {
      if (err?.code === '55000') {
        await pool.query(`REFRESH MATERIALIZED VIEW ${view}`);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Archive a tenant's sellable catalog without deleting it — sample products
 * stay in the table for audit but drop out of the storefront MV on the next
 * refresh. Returns the number of rows archived.
 */
export async function archiveTenantProducts(tenantId: string): Promise<number> {
  const result = await prisma.inventory_items.updateMany({
    where: {
      tenant_id: tenantId,
      item_status: { in: ['active', 'inactive'] },
    },
    data: { item_status: 'archived' },
  });
  return result.count;
}

/**
 * Retire every live seed-preview storefront sourced from the given tenant.
 * Called when the source seed is claimed — the owner now controls the real
 * tenant, so no preview may remain publicly visible (spec §5e).
 */
export async function retireSeedPreviewsForSource(sourceTenantId: string): Promise<number> {
  const previews = await prisma.tenants.findMany({
    where: {
      demo_source_tenant_id: sourceTenantId,
      is_demo: true,
      demo_template: SEED_PREVIEW_TEMPLATE,
      location_status: 'active',
    },
    select: { id: true },
  });

  if (previews.length === 0) return 0;

  const { default: demoTenantService } = await import('../services/DemoTenantService');
  for (const preview of previews) {
    try {
      await demoTenantService.expireDemoTenant(preview.id);
    } catch (err: any) {
      logger.error('[seed-preview] Failed to retire preview storefront on claim', undefined, {
        previewTenantId: preview.id,
        sourceTenantId,
        error: { name: err?.name || 'Error', message: err?.message || String(err) },
      });
    }
  }
  return previews.length;
}
