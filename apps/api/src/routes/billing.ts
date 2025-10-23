// v3.5 Billing Counters API (RVP-API-2403)
import { Hono } from 'hono';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const billing = new Hono();

// GET /tenant/billing/counters - Get SKU counters for tenant
billing.get('/tenant/billing/counters', requireAuth, async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;

  // Query the tenant_sku_counters view
  const result = await prisma.$queryRaw<any[]>`
    SELECT * FROM tenant_sku_counters
    WHERE "tenantId" = ${tenantId}
  `;

  if (!result || result.length === 0) {
    return c.json({
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
    });
  }

  const counters = result[0];
  
  // Get tenant's plan limit from metadata
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { metadata: true },
  });

  const limit = tenant?.metadata?.sku_limit || null;

  return c.json({
    tenantId,
    counts: {
      active_total: Number(counters.active_total),
      inactive_total: Number(counters.inactive_total),
      archived_total: Number(counters.archived_total),
      active_public: Number(counters.active_public),
      active_private: Number(counters.active_private),
      billable_sku_count: Number(counters.billable_sku_count),
    },
    policySnapshot: counters.policy_snapshot,
    limit,
    status: limit && Number(counters.billable_sku_count) >= limit ? 'at_limit' : 'ok',
  });
});

// GET /tenant/billing/status - Get tier status
billing.get('/tenant/billing/status', requireAuth, async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;

  // Query the tenant_tier_status view
  const result = await prisma.$queryRaw<any[]>`
    SELECT * FROM tenant_tier_status
    WHERE "tenantId" = ${tenantId}
  `;

  if (!result || result.length === 0) {
    return c.json({
      tenantId,
      billableSkuCount: 0,
      currentTier: null,
      skuLimit: null,
      status: 'ok',
    });
  }

  const status = result[0];

  return c.json({
    tenantId,
    billableSkuCount: Number(status.billable_sku_count),
    currentTier: status.current_tier,
    skuLimit: status.sku_limit ? Number(status.sku_limit) : null,
    status: status.status,
  });
});

// POST /admin/billing/override - Set tenant SKU limit override
billing.post('/admin/billing/override', requireAuth, async (c) => {
  // TODO: Add admin check
  const body = await c.req.json();
  const { tenantId, skuLimit } = body;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      metadata: {
        sku_limit: skuLimit,
      },
    },
  });

  return c.json({ success: true, tenantId, skuLimit });
});

// GET /metrics/counters - Real-time counter stream (SSE)
billing.get('/metrics/counters', requireAuth, async (c) => {
  const user = c.get('user');
  const tenantId = user.tenantId;

  // Set up SSE
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  // Send initial data
  const result = await prisma.$queryRaw<any[]>`
    SELECT * FROM tenant_sku_counters
    WHERE "tenantId" = ${tenantId}
  `;

  if (result && result.length > 0) {
    const data = JSON.stringify(result[0]);
    c.body(`data: ${data}\n\n`);
  }

  // TODO: Set up LISTEN/NOTIFY subscriber
  // For now, just send initial data and close
  return c.body('');
});

export default billing;
