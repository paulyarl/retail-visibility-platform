// v3.5 Billing Counters API - Express version
import { Router } from 'express';
import { prisma } from '../prisma';
import { requireAuth, requireAdmin, getTenantId } from '../middleware/auth';

const router = Router();

// GET /tenant/billing/counters - Get SKU counters for tenant
router.get('/tenant/billing/counters', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId_required' });
    }

    // Query the tenant_sku_counters view
    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM tenant_sku_counters
      WHERE "tenantId" = ${tenantId}
    `;

    if (!result || result.length === 0) {
      return res.json({
        tenantId,
        counts: {
          active_total: 0,
          inactive_total: 0,
          archived_total: 0,
          active_public: 0,
          active_private: 0,
          billable_sku_count: 0,
        },
        policySnapshot: null,
        limit: null,
        status: 'ok',
      });
    }

    const counters = result[0];
    
    // Get tenant's plan limit from metadata
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });

    const metadata = tenant?.metadata as any;
    const limit = metadata?.sku_limit || null;
    const billableCount = Number(counters.billable_sku_count);

    res.json({
      tenantId,
      counts: {
        active_total: Number(counters.active_total),
        inactive_total: Number(counters.inactive_total),
        archived_total: Number(counters.archived_total),
        active_public: Number(counters.active_public),
        active_private: Number(counters.active_private),
        billable_sku_count: billableCount,
      },
      policySnapshot: counters.policy_snapshot,
      limit,
      status: limit && billableCount >= limit ? 'at_limit' : 
              limit && billableCount >= limit * 0.9 ? 'warning' : 'ok',
    });
  } catch (error: any) {
    console.error('[Billing] Counters error:', error);
    res.status(500).json({ error: 'failed_to_fetch_counters' });
  }
});

// GET /tenant/billing/status - Get tier status
router.get('/tenant/billing/status', requireAuth, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId_required' });
    }

    // Query the tenant_tier_status view
    const result = await prisma.$queryRaw<any[]>`
      SELECT * FROM tenant_tier_status
      WHERE "tenantId" = ${tenantId}
    `;

    if (!result || result.length === 0) {
      return res.json({
        tenantId,
        billableSkuCount: 0,
        currentTier: null,
        skuLimit: null,
        status: 'ok',
      });
    }

    const status = result[0];

    res.json({
      tenantId,
      billableSkuCount: Number(status.billable_sku_count),
      currentTier: status.current_tier,
      skuLimit: status.sku_limit ? Number(status.sku_limit) : null,
      status: status.status,
    });
  } catch (error: any) {
    console.error('[Billing] Status error:', error);
    res.status(500).json({ error: 'failed_to_fetch_status' });
  }
});

// POST /admin/billing/override - Set tenant SKU limit override
router.post('/admin/billing/override', requireAdmin, async (req, res) => {
  try {
    const { tenantId, skuLimit } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId_required' });
    }

    // Get existing metadata
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });

    const metadata = (tenant?.metadata as any) || {};

    // Update with new limit
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        metadata: {
          ...metadata,
          sku_limit: skuLimit,
        },
      },
    });

    res.json({ success: true, tenantId, skuLimit });
  } catch (error: any) {
    console.error('[Billing] Override error:', error);
    res.status(500).json({ error: 'failed_to_set_override' });
  }
});

// GET /organization/billing/counters - Get SKU counters for entire organization
router.get('/organization/billing/counters', requireAuth, async (req, res) => {
  try {
    const organizationId = req.query.organizationId as string;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'organization_id_required' });
    }

    // Get organization with all tenants
    const org = await prisma.organizations_list.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        max_locations: true,
        max_total_skus: true, 
        subscription_tier: true,
        subscription_status: true,
        tenants: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                inventory_items: true,
              },
            },
          },
        },
      },
    });

    if (!org) {
      return res.status(404).json({ error: 'organization_not_found' });
    }

    // Calculate totals
    const totalLocations = org.tenants.length;
    const totalSKUs = org.tenants.reduce((sum, t) => sum + t._count.inventory_items, 0);
    const locationBreakdown = org.tenants.map(t => ({
      tenantId: t.id,
      tenantName: t.name,
      skuCount: t._count.inventory_items,
    }));

    // Calculate status
    const locationStatus = totalLocations >= org.max_locations ? 'at_limit' :
                          totalLocations >= org.max_locations * 0.9 ? 'warning' : 'ok';
    
    const skuStatus = totalSKUs >= org.max_total_skus ? 'at_limit' :
                     totalSKUs >= org.max_total_skus * 0.9 ? 'warning' : 'ok';

    res.json({
      organizationId: org.id,
      organizationName: org.name,
      subscription_tier: org.subscription_tier,
      subscription_status: org.subscription_status,
      limits: {
        maxLocations: org.max_locations,
        maxTotalSKUs: org.max_total_skus,
      },
      current: {
        totalLocations,
        totalSKUs,
      },
      status: {
        locations: locationStatus,
        skus: skuStatus,
        overall: locationStatus === 'at_limit' || skuStatus === 'at_limit' ? 'at_limit' :
                locationStatus === 'warning' || skuStatus === 'warning' ? 'warning' : 'ok',
      },
      locationBreakdown,
    });
  } catch (error: any) {
    console.error('[Organization Billing] Counters error:', error);
    res.status(500).json({ error: 'failed_to_fetch_counters' });
  }
});

// POST /admin/organization/override - Set organization limits
router.post('/admin/organization/override', requireAdmin, async (req, res) => {
  try {
    const { organizationId, maxLocations, maxTotalSKUs } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'organization_id_required' });
    }

    const updateData: any = {};
    if (maxLocations !== undefined) updateData.maxLocations = maxLocations;
    if (maxTotalSKUs !== undefined) updateData.maxTotalSKUs = maxTotalSKUs;

    await prisma.organizations_list.update({
      where: { id: organizationId },
      data: updateData,
    });

    res.json({ success: true, organizationId, ...updateData });
  } catch (error: any) {
    console.error('[Organization Billing] Override error:', error);
    res.status(500).json({ error: 'failed_to_set_override' });
  }
});

export default router;
